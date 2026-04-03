import React from 'react'

interface ActionMenuProps {
  x: number
  y: number
  selectedText: string
  passageId: string
  onClose: () => void
  onConceptRetrieval: (text: string) => void
  onScopedQuestion: (passageId: string, text: string) => void
  onCrossTradition: (passageId: string, text: string) => void
  onPin: (passageId: string) => void
}

export default function ActionMenu({
  x,
  y,
  selectedText,
  passageId,
  onClose,
  onConceptRetrieval,
  onScopedQuestion,
  onCrossTradition,
  onPin,
}: ActionMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 200),
  }

  return (
    <div ref={menuRef} className="action-menu" style={style}>
      <button
        className="action-menu-item w-full text-left"
        onClick={() => { onConceptRetrieval(selectedText); onClose() }}
      >
        <span>⬡</span>
        Trace
      </button>
      <button
        className="action-menu-item w-full text-left"
        onClick={() => { onScopedQuestion(passageId, selectedText); onClose() }}
      >
        <span>?</span>
        Inquire
      </button>
      <button
        className="action-menu-item w-full text-left"
        onClick={() => { onCrossTradition(passageId, selectedText); onClose() }}
      >
        <span>⊕</span>
        Across Traditions
      </button>
      <div className="border-t border-lucent-border my-1" />
      <button
        className="action-menu-item w-full text-left"
        onClick={() => { onPin(passageId); onClose() }}
      >
        <span>◈</span>
        Hold
      </button>
    </div>
  )
}
