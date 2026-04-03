import React, { useEffect, useState } from 'react'
import ContainmentGate from './ContainmentGate'

interface PhaseOneProps {
  sessionId: string
  narrative: string
  onComplete: (selectedText: string) => void
}

export default function PhaseOne({ sessionId, narrative, onComplete }: PhaseOneProps) {
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    window.lux.shadow.phaseOptions(1).then((opts: string[]) => {
      setOptions(opts)
      setLoading(false)
    })
  }, [])

  const handleSelect = async (idx: number, text: string) => {
    setSelected(idx)
    await window.lux.shadow.recordChoice({
      sessionId,
      phase: 1,
      optionIndex: idx,
      optionText: text,
    })
    setTimeout(() => onComplete(text), 400)
  }

  return (
    <ContainmentGate>
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-6">
          <p className="text-xs text-lucent-muted uppercase tracking-wider mb-1">Situation</p>
          <p className="reading-text text-sm text-lucent-text italic">{narrative}</p>
        </div>

        <p className="text-sm text-lucent-muted mb-6">
          What is most true about what happened?
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
    </ContainmentGate>
  )
}
