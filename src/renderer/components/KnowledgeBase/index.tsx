import React, { useState, useEffect } from 'react'

interface Concept {
  id: string
  name: string
  traditionOfOrigin: string | null
  firstEncounteredAt: string
  summary: string | null
}

interface PinnedPassage {
  passageId: string
  pinnedAt: string
  note: string | null
}

interface OutsideInsight {
  id: string
  content: string
  recordedAt: string
  approximateContext: string | null
  linkedPassageIds: string | null
}

type Tab = 'concepts' | 'pinned' | 'insights'

export default function KnowledgeBase() {
  const [tab, setTab] = useState<Tab>('concepts')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [pinned, setPinned] = useState<PinnedPassage[]>([])
  const [insights, setInsights] = useState<OutsideInsight[]>([])
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null)
  const [showCreateConcept, setShowCreateConcept] = useState(false)
  const [showInsightForm, setShowInsightForm] = useState(false)
  const [newConcept, setNewConcept] = useState({ name: '', traditionOfOrigin: '', summary: '' })
  const [newInsight, setNewInsight] = useState({ content: '', approximateContext: '' })
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [connectTarget, setConnectTarget] = useState('')
  const [connectNote, setConnectNote] = useState('')

  useEffect(() => {
    window.lux.concepts.list().then(setConcepts)
    window.lux.passages.getPinned().then(setPinned)
    window.lux.passages.listOutsideInsights().then(setInsights)
  }, [])

  const handleCreateConcept = async () => {
    if (!newConcept.name) return
    const c = await window.lux.concepts.create({
      name: newConcept.name,
      traditionOfOrigin: newConcept.traditionOfOrigin || undefined,
      summary: newConcept.summary || undefined,
    })
    setConcepts((prev) => [c, ...prev])
    setNewConcept({ name: '', traditionOfOrigin: '', summary: '' })
    setShowCreateConcept(false)
  }

  const handleCreateInsight = async () => {
    if (!newInsight.content) return
    const i = await window.lux.passages.recordOutsideInsight({
      content: newInsight.content,
      approximateContext: newInsight.approximateContext || undefined,
    })
    setInsights((prev) => [i, ...prev])
    setNewInsight({ content: '', approximateContext: '' })
    setShowInsightForm(false)
  }

  const handleConnect = async () => {
    if (!selectedConcept || !connectTarget) return
    const target = concepts.find((c) => c.name.toLowerCase() === connectTarget.toLowerCase())
    if (!target) return
    await window.lux.concepts.connect({
      conceptIdA: selectedConcept.id,
      conceptIdB: target.id,
      note: connectNote || undefined,
    })
    setShowConnectForm(false)
    setConnectTarget('')
    setConnectNote('')
  }

  return (
    <div className="flex h-full">
      {/* Left: tab navigation + list */}
      <div className="w-72 border-r border-lucent-border flex flex-col">
        <div className="surface-header">
          <h2 className="text-sm font-medium">The Gathered</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-lucent-border">
          {(['concepts', 'pinned', 'insights'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t
                  ? 'text-lucent-accent border-b-2 border-lucent-accent'
                  : 'text-lucent-muted hover:text-lucent-text'
              }`}
              onClick={() => setTab(t)}
            >
              {t === 'concepts' && 'Concepts in Common'}
              {t === 'pinned' && 'Passages Held'}
              {t === 'insights' && 'Field Notes'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'concepts' && (
            <>
              <div className="p-3">
                <button
                  className="btn-accent w-full text-xs"
                  onClick={() => setShowCreateConcept(true)}
                >
                  + New concept
                </button>
              </div>
              {concepts.map((c) => (
                <button
                  key={c.id}
                  className={`w-full text-left px-4 py-3 hover:bg-lucent-surface transition-colors ${
                    selectedConcept?.id === c.id ? 'bg-lucent-surface border-l-2 border-lucent-accent' : ''
                  }`}
                  onClick={() => setSelectedConcept(c)}
                >
                  <div className="text-sm font-medium text-lucent-text">{c.name}</div>
                  {c.traditionOfOrigin && (
                    <div className="text-xs text-lucent-accent">{c.traditionOfOrigin}</div>
                  )}
                  <div className="text-xs text-lucent-muted">
                    {new Date(c.firstEncounteredAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
              {concepts.length === 0 && (
                <p className="px-4 py-6 text-xs text-lucent-muted text-center">
                  No concepts yet. Mark concepts from the Reader.
                </p>
              )}
            </>
          )}

          {tab === 'pinned' && (
            <div className="p-3 space-y-2">
              {pinned.map((p) => (
                <div key={p.passageId} className="passage-card text-xs">
                  <p className="text-lucent-muted text-xs mb-1">
                    Pinned {new Date(p.pinnedAt).toLocaleDateString()}
                  </p>
                  {p.note && <p className="text-lucent-text italic">{p.note}</p>}
                </div>
              ))}
              {pinned.length === 0 && (
                <p className="py-6 text-xs text-lucent-muted text-center">
                  Nothing has been held yet.
                </p>
              )}
            </div>
          )}

          {tab === 'insights' && (
            <>
              <div className="p-3">
                <button
                  className="btn-accent w-full text-xs"
                  onClick={() => setShowInsightForm(true)}
                >
                  + Record Field Note
                </button>
              </div>
              <div className="p-3 space-y-3">
                {insights.map((i) => (
                  <div key={i.id} className="passage-card">
                    <p className="reading-text text-sm">{i.content}</p>
                    {i.approximateContext && (
                      <p className="text-xs text-lucent-muted mt-2">
                        Context: {i.approximateContext}
                      </p>
                    )}
                    <p className="text-xs text-lucent-muted mt-1">
                      {new Date(i.recordedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {insights.length === 0 && (
                  <p className="py-4 text-xs text-lucent-muted text-center">
                    No Field Notes.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: concept detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedConcept ? (
          <div className="max-w-lg mx-auto px-6 py-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-xl font-medium text-lucent-text">{selectedConcept.name}</h1>
                {selectedConcept.traditionOfOrigin && (
                  <p className="text-sm text-lucent-accent mt-1">{selectedConcept.traditionOfOrigin}</p>
                )}
                <p className="text-xs text-lucent-muted mt-1">
                  First encountered {new Date(selectedConcept.firstEncounteredAt).toLocaleDateString()}
                </p>
              </div>
              <button
                className="btn-outline text-xs"
                onClick={() => setShowConnectForm(true)}
              >
                Connect to concept
              </button>
            </div>

            {selectedConcept.summary && (
              <div className="mb-6">
                <h3 className="text-xs font-medium uppercase tracking-wider text-lucent-muted mb-2">Summary</h3>
                <p className="reading-text text-sm">{selectedConcept.summary}</p>
              </div>
            )}

            {showConnectForm && (
              <div className="bg-lucent-surface border border-lucent-border rounded p-4 mb-4">
                <h3 className="text-xs font-medium mb-3">Connect to another concept</h3>
                <input
                  className="input-lucent mb-2"
                  placeholder="Concept name (exact)"
                  value={connectTarget}
                  onChange={(e) => setConnectTarget(e.target.value)}
                  list="concept-names"
                />
                <datalist id="concept-names">
                  {concepts.filter((c) => c.id !== selectedConcept.id).map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <input
                  className="input-lucent mb-3"
                  placeholder="Note on connection (optional)"
                  value={connectNote}
                  onChange={(e) => setConnectNote(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button className="btn-ghost text-xs" onClick={() => setShowConnectForm(false)}>Cancel</button>
                  <button className="btn-accent text-xs" onClick={handleConnect}>Connect</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-lucent-muted text-sm">Select a concept to view its details.</p>
          </div>
        )}
      </div>

      {/* Create concept modal */}
      {showCreateConcept && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-lucent-bg border border-lucent-border rounded shadow-xl p-6 w-96">
            <h2 className="text-base font-medium mb-4">New concept</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Name *</label>
                <input
                  className="input-lucent"
                  value={newConcept.name}
                  onChange={(e) => setNewConcept((m) => ({ ...m, name: e.target.value }))}
                  placeholder="Concept name"
                />
              </div>
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Tradition of origin</label>
                <input
                  className="input-lucent"
                  value={newConcept.traditionOfOrigin}
                  onChange={(e) => setNewConcept((m) => ({ ...m, traditionOfOrigin: e.target.value }))}
                  placeholder="e.g. Advaita Vedanta"
                />
              </div>
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Summary</label>
                <textarea
                  className="input-lucent h-20 resize-none"
                  value={newConcept.summary}
                  onChange={(e) => setNewConcept((m) => ({ ...m, summary: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-ghost" onClick={() => setShowCreateConcept(false)}>Cancel</button>
              <button
                className="btn-accent"
                onClick={handleCreateConcept}
                disabled={!newConcept.name}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record insight modal */}
      {showInsightForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-lucent-bg border border-lucent-border rounded shadow-xl p-6 w-96">
            <h2 className="text-base font-medium mb-1">Field Note</h2>
            <p className="text-xs text-lucent-muted mb-4">
              An understanding that arrived outside a reading session.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Note *</label>
                <textarea
                  className="input-lucent h-28 resize-none"
                  value={newInsight.content}
                  onChange={(e) => setNewInsight((m) => ({ ...m, content: e.target.value }))}
                  placeholder="What arrived…"
                />
              </div>
              <div>
                <label className="text-xs text-lucent-muted block mb-1">Approximate context</label>
                <input
                  className="input-lucent"
                  value={newInsight.approximateContext}
                  onChange={(e) => setNewInsight((m) => ({ ...m, approximateContext: e.target.value }))}
                  placeholder="e.g. during morning meditation, on a walk"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-ghost" onClick={() => setShowInsightForm(false)}>Cancel</button>
              <button
                className="btn-accent"
                onClick={handleCreateInsight}
                disabled={!newInsight.content}
              >
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
