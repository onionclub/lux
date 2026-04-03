import React, { useState } from 'react'

interface EntryGateProps {
  onEnter: (sessionId: string, narrative: string) => void
}

export default function EntryGate({ onEnter }: EntryGateProps) {
  const [narrative, setNarrative] = useState('')
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    if (!narrative.trim()) return
    setStarting(true)
    const session = await window.lux.shadow.start()
    await window.lux.shadow.updateNarrative(session.id, narrative.trim())
    onEnter(session.id, narrative.trim())
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <h2 className="text-xl font-medium text-lucent-text mb-2">The Chamber</h2>
      <p className="text-sm text-lucent-muted mb-8 leading-relaxed">
        Name something from your life you can currently hold.
      </p>

      <textarea
        className="input-lucent h-36 resize-none reading-text"
        placeholder="What is present for you right now…"
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
        autoFocus
      />

      <div className="mt-4 flex justify-end">
        <button
          className="btn-accent"
          onClick={handleStart}
          disabled={!narrative.trim() || starting}
        >
          {starting ? 'Beginning…' : 'Begin'}
        </button>
      </div>
    </div>
  )
}
