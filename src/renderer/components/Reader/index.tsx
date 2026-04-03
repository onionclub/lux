import React, { useState, useEffect, useCallback, useRef } from 'react'
import PassageView from './PassageView'
import { useAppStore } from '../../store'

interface Text {
  id: string
  title: string
  author: string | null
  tradition: string | null
  importedAt: string
  isPartial: number
}

interface Passage {
  id: string
  textId: string
  paragraphIndex: number
  content: string
  chapterIndex: number
}

interface PassageState {
  state: 'resonant' | 'latent' | 'recontextualized'
}

interface AIPanel {
  requestId: string
  type: 'search' | 'scoped_question' | 'cross_tradition'
  query?: string
  passageId?: string
}

export default function Reader() {
  const { activeTextId, setActiveTextId } = useAppStore()
  const [texts, setTexts] = useState<Text[]>([])
  const [passages, setPassages] = useState<Passage[]>([])
  const [passageStates, setPassageStates] = useState<Record<string, PassageState | null>>({})
  const [pinnedPassages, setPinnedPassages] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMeta, setImportMeta] = useState({ title: '', author: '', tradition: '' })
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)

  type ImportStatus =
    | { phase: 'idle' }
    | { phase: 'receiving' }
    | { phase: 'done'; succeeded: number; total: number; singleTitle?: string; failed: Array<{ name: string; error: string }> }

  const [importStatus, setImportStatus] = useState<ImportStatus>({ phase: 'idle' })
  const [failedExpanded, setFailedExpanded] = useState(false)
  const [aiPanel, setAiPanel] = useState<AIPanel | null>(null)
  const [searchResults, setSearchResults] = useState<Array<{ passageId: string; content: string; score: number }> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { aiResponses, aiStreaming, appendAiChunk, setAiDone } = useAppStore()
  const unsubRef = useRef<(() => void) | null>(null)

  // Subscribe to AI stream
  useEffect(() => {
    unsubRef.current = window.lux.ai.onStream((data) => {
      if (data.chunk) appendAiChunk(data.requestId, data.chunk)
      if (data.done) setAiDone(data.requestId)
    })
    return () => { unsubRef.current?.() }
  }, [appendAiChunk, setAiDone])

  useEffect(() => {
    window.lux.corpus.list().then(setTexts)
    window.lux.passages.getPinned().then((pinned) => {
      setPinnedPassages(new Set(pinned.map((p: { passageId: string }) => p.passageId)))
    })
  }, [])

  useEffect(() => {
    if (!activeTextId) return
    window.lux.corpus.passages(activeTextId).then(async (ps: Passage[]) => {
      setPassages(ps)
      // Load states for all passages
      const states: Record<string, PassageState | null> = {}
      for (const p of ps) {
        states[p.id] = await window.lux.passages.currentState(p.id)
      }
      setPassageStates(states)
    })
  }, [activeTextId])

  const handleBrowseFile = async () => {
    const filePath = await window.lux.corpus.importDialog()
    if (!filePath) return
    setPendingFilePath(filePath)
    // Pre-fill title from filename
    const name = filePath.split(/[/\\]/).pop()?.replace(/\.(pdf|txt)$/i, '') || ''
    setImportMeta((m) => ({ ...m, title: name }))
    setShowImport(true)
  }

  const handleImport = async () => {
    if (!pendingFilePath || !importMeta.title) return
    const titleSnapshot = importMeta.title
    setImporting(true)
    setShowImport(false)
    setImportStatus({ phase: 'receiving' })

    try {
      await window.lux.corpus.import(pendingFilePath, {
        title: importMeta.title,
        author: importMeta.author || undefined,
        tradition: importMeta.tradition || undefined,
      })
      const updated = await window.lux.corpus.list()
      setTexts(updated)
      setImportStatus({
        phase: 'done',
        succeeded: 1,
        total: 1,
        singleTitle: titleSnapshot,
        failed: [],
      })
    } catch {
      const name = pendingFilePath.split(/[/\\]/).pop() || pendingFilePath
      setImportStatus({
        phase: 'done',
        succeeded: 0,
        total: 1,
        failed: [{ name, error: 'Could not be received.' }],
      })
    }

    setImporting(false)
    setImportMeta({ title: '', author: '', tradition: '' })
    setPendingFilePath(null)
  }

  const handleBatchImport = async () => {
    const filePaths = await window.lux.corpus.importBatchDialog()
    if (!filePaths || filePaths.length === 0) return

    setImportStatus({ phase: 'receiving' })
    setFailedExpanded(false)

    const result = await window.lux.corpus.importBatch(filePaths)
    const updated = await window.lux.corpus.list()
    setTexts(updated)

    setImportStatus({
      phase: 'done',
      succeeded: result.succeeded.length,
      total: filePaths.length,
      failed: result.failed,
    })
  }

  const handleStateChange = useCallback(
    async (passageId: string, state: 'resonant' | 'latent' | 'recontextualized') => {
      await window.lux.passages.setState(passageId, state)
      setPassageStates((prev) => ({ ...prev, [passageId]: { state } }))
    },
    []
  )

  const handlePin = useCallback(async (passageId: string) => {
    await window.lux.passages.pin(passageId)
    setPinnedPassages((prev) => new Set([...prev, passageId]))
  }, [])

  const handleConceptRetrieval = useCallback(async (text: string) => {
    const results = await window.lux.passages.search(text, 8)
    setSearchResults(results)
    setAiPanel({ requestId: '', type: 'search', query: text })
  }, [])

  const handleScopedQuestion = useCallback(async (passageId: string, text: string) => {
    const passage = passages.find((p) => p.id === passageId)
    if (!passage) return
    const requestId = await window.lux.ai.invoke({
      type: 'scoped_question',
      passage: passage.content,
      question: text,
    })
    setAiPanel({ requestId, type: 'scoped_question', passageId, query: text })
  }, [passages])

  const handleCrossTradition = useCallback(async (passageId: string, text: string) => {
    const passage = passages.find((p) => p.id === passageId)
    if (!passage) return
    const requestId = await window.lux.ai.invoke({
      type: 'cross_tradition',
      passage: passage.content,
      conceptName: text,
    })
    setAiPanel({ requestId, type: 'cross_tradition', passageId, query: text })
  }, [passages])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    const results = await window.lux.passages.search(searchQuery, 10)
    setSearchResults(results)
    setAiPanel({ requestId: '', type: 'search', query: searchQuery })
  }

  return (
    <div className="flex h-full">
      {/* Text list sidebar */}
      <div className="w-60 border-r border-lucent-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-lucent-border">
          <h2 className="text-xs font-medium uppercase tracking-wider text-lucent-muted mb-3">Corpus</h2>
          <div className="flex flex-col gap-2">
            <button className="btn-accent w-full" onClick={handleBrowseFile}>
              Import text
            </button>
            <button className="btn-outline w-full text-xs" onClick={handleBatchImport}>
              Import corpus
            </button>
          </div>
        </div>

        {/* Import status container — inline, same surface */}
        {importStatus.phase !== 'idle' && (
          <div
            className="border-b border-lucent-border"
            style={{
              background: '#FAF9F6',
              border: '1px solid #C8BCA8',
              borderLeft: 'none',
              borderRight: 'none',
              padding: '24px 20px',
              minHeight: 80,
            }}
          >
            {importStatus.phase === 'receiving' && (
              <span
                className="animate-receiving"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  color: '#6B6560',
                  animation: 'receivingPulse 2000ms ease-in-out infinite',
                }}
              >
                Receiving.
              </span>
            )}

            {importStatus.phase === 'done' && (() => {
              const { succeeded, total, failed } = importStatus
              const isPartial = failed.length > 0
              const SHOW_LIMIT = 5

              return (
                <div>
                  {/* Primary status line */}
                  <p style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontSize: 19,
                    fontWeight: 400,
                    lineHeight: 1.4,
                    color: '#1A1A1A',
                    marginBottom: 0,
                  }}>
                    {isPartial
                      ? `${succeeded} of ${total} texts received.`
                      : total === 1 && importStatus.phase === 'done' && importStatus.singleTitle
                        ? `${importStatus.singleTitle} has been received.`
                        : `${succeeded} texts received.`}
                  </p>

                  {/* Follow-up for successful imports */}
                  {!isPartial && (
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12,
                      color: '#6B6560',
                      marginTop: 8,
                    }}>
                      Mark as you read. The states will accumulate.
                    </p>
                  )}

                  {/* Failed files */}
                  {isPartial && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        fontWeight: 400,
                        color: '#6B6560',
                        opacity: 0.7,
                        marginBottom: 6,
                      }}>
                        Could not be received
                      </p>
                      <div>
                        {failed.slice(0, SHOW_LIMIT).map((f) => (
                          <p key={f.name} style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 13,
                            lineHeight: 1.75,
                            color: '#6B6560',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {f.name}
                            {f.error.toLowerCase().includes('only pdf') && (
                              <span style={{ marginLeft: 6, opacity: 0.7 }}>— unsupported format</span>
                            )}
                          </p>
                        ))}

                        {failed.length > SHOW_LIMIT && (
                          <>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateRows: failedExpanded ? '1fr' : '0fr',
                                transition: 'grid-template-rows 250ms ease-in-out',
                              }}
                            >
                              <div style={{ overflow: 'hidden' }}>
                                {failed.slice(SHOW_LIMIT).map((f) => (
                                  <p key={f.name} style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: 13,
                                    lineHeight: 1.75,
                                    color: '#6B6560',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {f.name}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => setFailedExpanded((v) => !v)}
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 13,
                                color: '#8B7355',
                                opacity: 0.8,
                                cursor: 'pointer',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                marginTop: 2,
                                transition: 'opacity 150ms ease-in-out',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.8')}
                            >
                              {failedExpanded
                                ? 'show fewer'
                                : `…and ${failed.length - SHOW_LIMIT} more`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <div className="overflow-y-auto flex-1 py-2">
          {texts.map((t) => (
            <button
              key={t.id}
              className={`group w-full text-left px-4 py-3 hover:bg-lucent-surface transition-colors ${
                activeTextId === t.id ? 'bg-lucent-surface border-l-2 border-lucent-accent' : ''
              }`}
              onClick={() => setActiveTextId(t.id)}
            >
              <div className="text-sm font-medium text-lucent-text truncate">{t.title}</div>
              {t.author && (
                <div className="text-xs text-lucent-muted truncate">{t.author}</div>
              )}
              {t.tradition && (
                <div className="text-xs text-lucent-accent truncate">{t.tradition}</div>
              )}
              {t.isPartial === 1 && (
                <div
                  className="group-hover:opacity-85 transition-opacity duration-150"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.10em',
                    fontWeight: 400,
                    color: '#6B6560',
                    opacity: 0.55,
                    marginTop: 3,
                  }}
                >
                  PARTIAL
                </div>
              )}
            </button>
          ))}
          {texts.length === 0 && (
            <p className="px-4 py-6 text-xs text-lucent-muted text-center">
              Your corpus is the territory.<br />Lux holds it.<br />Bring your texts.
            </p>
          )}
        </div>
      </div>

      {/* Main reading area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTextId ? (
          <>
            <div className="surface-header">
              <div>
                <h1 className="text-base font-medium">
                  {texts.find((t) => t.id === activeTextId)?.title}
                </h1>
                <p className="text-xs text-lucent-muted">
                  {passages.length} passages
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="input-lucent w-48 text-xs"
                  placeholder="Search corpus…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn-ghost text-xs" onClick={handleSearch}>Search</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-6 py-8">
                {passages.map((p) => (
                  <PassageView
                    key={p.id}
                    passage={p}
                    currentState={passageStates[p.id] || null}
                    isPinned={pinnedPassages.has(p.id)}
                    onStateChange={handleStateChange}
                    onConceptRetrieval={handleConceptRetrieval}
                    onScopedQuestion={handleScopedQuestion}
                    onCrossTradition={handleCrossTradition}
                    onPin={handlePin}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lucent-muted text-sm">No text selected.</p>
          </div>
        )}
      </div>

      {/* AI / search panel */}
      {aiPanel && (
        <div className="w-80 border-l border-lucent-border flex flex-col flex-shrink-0">
          <div className="surface-header">
            <span className="text-sm font-medium">
              {aiPanel.type === 'search' && 'Trace'}
              {aiPanel.type === 'scoped_question' && 'Inquire'}
              {aiPanel.type === 'cross_tradition' && 'Across Traditions'}
            </span>
            <button className="btn-ghost text-xs" onClick={() => setAiPanel(null)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {aiPanel.type === 'search' && searchResults && (
              <div>
                <p className="text-xs text-lucent-muted mb-3">
                  Results for: <em>&ldquo;{aiPanel.query}&rdquo;</em>
                </p>
                {searchResults.map((r) => (
                  <div key={r.passageId} className="passage-card mb-3 text-sm">
                    <p className="reading-text text-sm leading-relaxed">{r.content.slice(0, 200)}…</p>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <p className="text-xs text-lucent-muted">No matching passages found.</p>
                )}
              </div>
            )}
            {(aiPanel.type === 'scoped_question' || aiPanel.type === 'cross_tradition') && (
              <div>
                {aiStreaming[aiPanel.requestId] && (
                  <div className="text-xs text-lucent-muted mb-2">Responding…</div>
                )}
                <div className="text-sm reading-text whitespace-pre-wrap leading-relaxed">
                  {aiResponses[aiPanel.requestId] || (
                    <span className="text-lucent-muted">Waiting for response…</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-lucent-bg border border-lucent-border rounded shadow-xl p-6 w-96">
            <h2 className="text-base font-medium mb-4">Import text</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Title *</label>
                <input
                  className="input-lucent"
                  value={importMeta.title}
                  onChange={(e) => setImportMeta((m) => ({ ...m, title: e.target.value }))}
                  placeholder="Text title"
                />
              </div>
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Author</label>
                <input
                  className="input-lucent"
                  value={importMeta.author}
                  onChange={(e) => setImportMeta((m) => ({ ...m, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Tradition</label>
                <input
                  className="input-lucent"
                  value={importMeta.tradition}
                  onChange={(e) => setImportMeta((m) => ({ ...m, tradition: e.target.value }))}
                  placeholder="e.g. Advaita, Seth Material, Taoism"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                className="btn-ghost"
                onClick={() => { setShowImport(false); setPendingFilePath(null) }}
              >
                Cancel
              </button>
              <button
                className="btn-accent"
                onClick={handleImport}
                disabled={!importMeta.title || importing}
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
