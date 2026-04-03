import React, { useState, useCallback, useEffect, useRef } from 'react'
import ActionMenu from './ActionMenu'

interface PassageState {
  state: 'resonant' | 'latent' | 'recontextualized'
}

interface Passage {
  id: string
  textId: string
  paragraphIndex: number
  content: string
  chapterIndex: number
}

interface PassageViewProps {
  passage: Passage
  currentState: PassageState | null
  isPinned: boolean
  onStateChange: (passageId: string, state: 'resonant' | 'latent' | 'recontextualized') => void
  onConceptRetrieval: (text: string) => void
  onScopedQuestion: (passageId: string, text: string) => void
  onCrossTradition: (passageId: string, text: string) => void
  onPin: (passageId: string) => void
}

const STATE_LABELS: Record<string, string> = {
  resonant: 'RESONANT',
  latent: 'LATENT',
  recontextualized: 'RECONTEXTUALIZED',
}

const STATE_COLORS: Record<string, string> = {
  resonant: '#C8860A',
  latent: '#8B7355',
  recontextualized: '#6B6560',
}

// Valid transition targets per current state
const STATE_OPTIONS: Record<string, Array<'resonant' | 'latent' | 'recontextualized'>> = {
  resonant: ['latent', 'recontextualized'],
  latent: ['resonant', 'recontextualized'],
  recontextualized: ['resonant', 'latent'],
}

export default function PassageView({
  passage,
  currentState,
  isPinned,
  onStateChange,
  onConceptRetrieval,
  onScopedQuestion,
  onCrossTradition,
  onPin,
}: PassageViewProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; text: string } | null>(null)
  const [showStatePopover, setShowStatePopover] = useState(false)
  const [labelHover, setLabelHover] = useState(false)

  // Label animation state — managed locally for smooth transition
  const [labelColor, setLabelColor] = useState(
    currentState ? STATE_COLORS[currentState.state] : '#8B7355'
  )
  const [displayLabel, setDisplayLabel] = useState(
    currentState ? STATE_LABELS[currentState.state] : ''
  )
  const [labelTransitioning, setLabelTransitioning] = useState(false)

  // Landing note state
  const [landingNotePresent, setLandingNotePresent] = useState(false)
  const [landingNoteExpanded, setLandingNoteExpanded] = useState(false)
  const [landingNoteText, setLandingNoteText] = useState('')
  const [landingNoteSaved, setLandingNoteSaved] = useState(false)

  // Rapid re-trigger prevention (800ms debounce)
  const debounceRef = useRef(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLButtonElement>(null)

  // Sync label when parent state initialises (e.g., on text load)
  useEffect(() => {
    if (currentState && !labelTransitioning) {
      setLabelColor(STATE_COLORS[currentState.state])
      setDisplayLabel(STATE_LABELS[currentState.state])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState?.state])

  // Dismiss state popover on outside click or Escape
  useEffect(() => {
    if (!showStatePopover) return
    const onMouse = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        labelRef.current && !labelRef.current.contains(e.target as Node)
      ) {
        setShowStatePopover(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowStatePopover(false)
    }
    document.addEventListener('mousedown', onMouse)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      window.removeEventListener('keydown', onKey)
    }
  }, [showStatePopover])

  // Dismiss landing note on Escape
  useEffect(() => {
    if (!landingNotePresent) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismissLandingNote()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingNotePresent, landingNoteText, landingNoteSaved])

  const showLandingNote = useCallback(() => {
    setLandingNotePresent(true)
    // Double rAF to ensure DOM is mounted before triggering CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLandingNoteExpanded(true))
    })
  }, [])

  const handleDismissLandingNote = useCallback(() => {
    if (landingNoteText.trim() && !landingNoteSaved) {
      window.lux.passages.updateInsightNote(passage.id, landingNoteText.trim())
    }
    setLandingNoteExpanded(false)
    setTimeout(() => {
      setLandingNotePresent(false)
      setLandingNoteText('')
      setLandingNoteSaved(false)
    }, 200)
  }, [landingNoteText, landingNoteSaved, passage.id])

  const handleLandingNoteBlur = useCallback(() => {
    if (landingNoteText.trim()) {
      window.lux.passages.updateInsightNote(passage.id, landingNoteText.trim())
      setLandingNoteSaved(true)
    }
  }, [landingNoteText, passage.id])

  const handleStateSelect = useCallback(
    (newState: 'resonant' | 'latent' | 'recontextualized') => {
      if (debounceRef.current) return
      const prevState = currentState?.state

      debounceRef.current = true
      setTimeout(() => { debounceRef.current = false }, 800)

      // Close popover; after 100ms popover-close + 80ms pause, start transition
      setShowStatePopover(false)

      setTimeout(() => {
        setLabelTransitioning(true)
        setLabelColor(STATE_COLORS[newState])

        // Text swap at 200ms — midpoint of 400ms ease-in-out
        setTimeout(() => {
          setDisplayLabel(STATE_LABELS[newState])
        }, 200)

        // Transition settled at 400ms
        setTimeout(() => {
          setLabelTransitioning(false)
        }, 400)

        // Landing note appears at 600ms from transition start (Latent → Resonant only)
        if (prevState === 'latent' && newState === 'resonant') {
          setTimeout(() => showLandingNote(), 600)
        }
      }, 180) // 100ms popover fade + 80ms pause

      onStateChange(passage.id, newState)
    },
    [currentState, onStateChange, passage.id, showLandingNote]
  )

  const handleInitialMark = useCallback(
    (newState: 'resonant' | 'latent' | 'recontextualized') => {
      setDisplayLabel(STATE_LABELS[newState])
      setLabelColor(STATE_COLORS[newState])
      setShowStatePopover(false)
      onStateChange(passage.id, newState)
    },
    [onStateChange, passage.id]
  )

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return
    const text = sel.toString().trim()
    if (text.length < 5) return
    setMenu({ x: e.clientX, y: e.clientY + 8, text })
  }, [])

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
    fontWeight: 400,
    color: labelColor,
    opacity: labelHover ? 1 : 0.65,
    transition: labelTransitioning
      ? 'color 400ms ease-in-out, opacity 400ms ease-in-out'
      : 'opacity 150ms ease-in-out',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'block',
    whiteSpace: 'nowrap',
  }

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    background: '#FAF9F6',
    border: '1px solid #C8BCA8',
    borderRadius: 0,
    padding: '10px 14px',
    left: 0,
    bottom: 'calc(100% + 4px)',
    zIndex: 50,
    animation: 'popoverFadeIn 120ms ease-in forwards',
    minWidth: 160,
    boxShadow: 'none',
  }

  const popoverOptionStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
    fontWeight: 400,
    color: '#1A1A1A',
    padding: '5px 0',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'block',
  }

  return (
    <div className="flex items-start mb-4 group" onMouseUp={handleMouseUp}>
      {/* Text column */}
      <div className="flex-1 min-w-0">
        <div
          className="reading-text px-6 py-4 bg-lucent-surface border border-lucent-border cursor-text select-text"
          style={{ borderRadius: 0, transition: 'border-color 150ms ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C9A96E')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
        >
          {passage.content}
        </div>

        {/* Landing note area — grid-based height animation */}
        {landingNotePresent && (
          <div
            style={{
              display: 'grid',
              gridTemplateRows: landingNoteExpanded ? '1fr' : '0fr',
              opacity: landingNoteExpanded ? 1 : 0,
              transition: 'grid-template-rows 280ms ease-in-out, opacity 280ms ease-in-out',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div
                className="relative"
                style={{
                  background: '#F0EDE4',
                  borderTop: '1px solid #C8BCA8',
                  padding: '14px 20px',
                }}
              >
                {/* Dismiss control */}
                <button
                  onClick={handleDismissLandingNote}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 14,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: '#6B6560',
                    opacity: 0.6,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    lineHeight: 1,
                    transition: 'opacity 150ms ease-in-out',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.6')}
                >
                  ×
                </button>

                <textarea
                  className="landing-note-textarea"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 64,
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: '#1A1A1A',
                  }}
                  placeholder="Record a Landing note."
                  value={landingNoteText}
                  onChange={(e) => setLandingNoteText(e.target.value)}
                  onBlur={handleLandingNoteBlur}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right margin — state label column */}
      <div className="w-28 pl-5 pt-[14px] flex-shrink-0 relative">
        {currentState ? (
          <>
            <button
              ref={labelRef}
              style={labelStyle}
              onMouseEnter={() => setLabelHover(true)}
              onMouseLeave={() => setLabelHover(false)}
              onClick={() => !debounceRef.current && setShowStatePopover((v) => !v)}
            >
              {displayLabel}
            </button>

            {showStatePopover && (
              <div ref={popoverRef} style={popoverStyle}>
                {(STATE_OPTIONS[currentState.state] || []).map((opt) => (
                  <div
                    key={opt}
                    style={popoverOptionStyle}
                    onClick={() => handleStateSelect(opt)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.color = '#8B7355')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.color = '#1A1A1A')}
                  >
                    {STATE_LABELS[opt]}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Subtle mark affordance — visible on group hover */}
            <button
              ref={labelRef}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                fontWeight: 400,
                color: '#8B7355',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'block',
              }}
              onClick={() => setShowStatePopover((v) => !v)}
            >
              mark
            </button>

            {showStatePopover && (
              <div ref={popoverRef} style={popoverStyle}>
                {(['resonant', 'latent', 'recontextualized'] as const).map((opt) => (
                  <div
                    key={opt}
                    style={popoverOptionStyle}
                    onClick={() => handleInitialMark(opt)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.color = '#8B7355')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.color = '#1A1A1A')}
                  >
                    {STATE_LABELS[opt]}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {isPinned && (
          <span
            className="block mt-1"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 10,
              color: '#C8860A',
              opacity: 0.65,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            pinned
          </span>
        )}
      </div>

      {/* Action menu on text selection */}
      {menu && (
        <ActionMenu
          x={menu.x}
          y={menu.y}
          selectedText={menu.text}
          passageId={passage.id}
          onClose={() => setMenu(null)}
          onConceptRetrieval={onConceptRetrieval}
          onScopedQuestion={onScopedQuestion}
          onCrossTradition={onCrossTradition}
          onPin={onPin}
        />
      )}
    </div>
  )
}
