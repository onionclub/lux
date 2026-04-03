import React, { useState, useEffect } from 'react'

interface BeliefMapEntry {
  id: string
  sessionId: string
  beliefStatement: string
  createdAt: string
}

export default function BeliefMap() {
  const [entries, setEntries] = useState<BeliefMapEntry[]>([])

  useEffect(() => {
    window.lux.shadow.beliefMap().then(setEntries)
  }, [])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lucent-muted text-sm text-center max-w-xs">
          The record begins with the first session.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <h2 className="text-base font-medium text-lucent-text mb-1">The Interior Record</h2>
      <p className="text-xs text-lucent-muted mb-6">
        What Has Been Identified
      </p>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="passage-card">
            <p className="reading-text text-sm">{e.beliefStatement}</p>
            <p className="text-xs text-lucent-muted mt-2">
              {new Date(e.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
