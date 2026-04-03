import React, { useEffect, useState } from 'react'

interface PhaseTwoProps {
  sessionId: string
  narrative: string
  phaseOneSelection: string
  onComplete: (beliefStatement: string) => void
}

export default function PhaseTwo({ sessionId, narrative, phaseOneSelection, onComplete }: PhaseTwoProps) {
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    window.lux.shadow.phaseOptions(2).then((opts: string[]) => {
      setOptions(opts)
      setLoading(false)
    })
  }, [])

  const handleSelect = async (idx: number, beliefText: string) => {
    setSelected(idx)
    await window.lux.shadow.recordChoice({
      sessionId,
      phase: 2,
      optionIndex: idx,
      optionText: beliefText,
    })

    // Compound statement: situation + belief
    const compound = `${narrative} — ${beliefText}`
    await window.lux.shadow.complete(sessionId, compound)

    setTimeout(() => onComplete(compound), 400)
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <div className="mb-6 space-y-2">
        <div>
          <p className="text-xs text-lucent-muted uppercase tracking-wider mb-1">Situation</p>
          <p className="reading-text text-sm italic text-lucent-text">{narrative}</p>
        </div>
        <div>
          <p className="text-xs text-lucent-muted uppercase tracking-wider mb-1">What felt most alive</p>
          <p className="reading-text text-sm text-lucent-text">{phaseOneSelection}</p>
        </div>
      </div>

      <p className="text-sm text-lucent-muted mb-6">
        What is true for you underneath this?
      </p>

      {loading ? (
        <p className="text-lucent-muted text-xs">Loading…</p>
      ) : (
        <div className="space-y-3">
          {options.map((opt, idx) => (
            <button
              key={idx}
              className={`w-full text-left px-5 py-4 border rounded-sm reading-text text-sm transition-all ${
                selected === idx
                  ? 'border-lucent-accent bg-lucent-surface/60 text-lucent-text'
                  : 'border-lucent-border bg-lucent-surface hover:border-lucent-accent/50 text-lucent-text'
              }`}
              onClick={() => handleSelect(idx, opt)}
              disabled={selected !== null}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
