import React, { useState } from 'react'
import EntryGate from './EntryGate'
import PhaseOne from './PhaseOne'
import PhaseTwo from './PhaseTwo'
import BeliefMap from './BeliefMap'

type ShadowView = 'home' | 'phase1' | 'phase2' | 'complete' | 'belief-map'

interface ActiveSession {
  id: string
  narrative: string
  phaseOneSelection?: string
  completedBelief?: string
}

export default function ShadowWork() {
  const [view, setView] = useState<ShadowView>('home')
  const [session, setSession] = useState<ActiveSession | null>(null)

  const handleEnter = (sessionId: string, narrative: string) => {
    setSession({ id: sessionId, narrative })
    setView('phase1')
  }

  const handlePhaseOneDone = (selectedText: string) => {
    setSession((s) => s ? { ...s, phaseOneSelection: selectedText } : null)
    setView('phase2')
  }

  const handlePhaseTwoDone = (beliefStatement: string) => {
    setSession((s) => s ? { ...s, completedBelief: beliefStatement } : null)
    setView('complete')
  }

  const handleRestart = () => {
    setSession(null)
    setView('home')
  }

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="w-48 border-r border-lucent-border flex flex-col">
        <div className="surface-header">
          <h2 className="text-sm font-medium">The Chamber</h2>
        </div>
        <div className="py-2">
          <button
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-lucent-surface ${
              (view === 'home' || view === 'phase1' || view === 'phase2' || view === 'complete')
                ? 'text-lucent-text border-l-2 border-lucent-accent bg-lucent-surface'
                : 'text-lucent-muted'
            }`}
            onClick={() => { setSession(null); setView('home') }}
          >
            New session
          </button>
          <button
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-lucent-surface ${
              view === 'belief-map'
                ? 'text-lucent-text border-l-2 border-lucent-accent bg-lucent-surface'
                : 'text-lucent-muted'
            }`}
            onClick={() => setView('belief-map')}
          >
            The Interior Record
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <EntryGate onEnter={handleEnter} />
        )}

        {view === 'phase1' && session && (
          <PhaseOne
            sessionId={session.id}
            narrative={session.narrative}
            onComplete={handlePhaseOneDone}
          />
        )}

        {view === 'phase2' && session && session.phaseOneSelection && (
          <PhaseTwo
            sessionId={session.id}
            narrative={session.narrative}
            phaseOneSelection={session.phaseOneSelection}
            onComplete={handlePhaseTwoDone}
          />
        )}

        {view === 'complete' && session && (
          <div className="max-w-lg mx-auto px-6 py-12">
            <h2 className="text-xl font-medium text-lucent-text mb-4">Session complete</h2>
            <p className="text-xs text-lucent-muted uppercase tracking-wider mb-1">Belief identified</p>
            <div className="passage-card mb-6">
              <p className="reading-text text-sm">{session.completedBelief}</p>
            </div>
            <p className="text-xs text-lucent-muted mb-6">
              This has been added to The Interior Record.
            </p>
            <div className="flex gap-3">
              <button className="btn-outline" onClick={handleRestart}>
                New session
              </button>
              <button className="btn-ghost" onClick={() => setView('belief-map')}>
                View record
              </button>
            </div>
          </div>
        )}

        {view === 'belief-map' && <BeliefMap />}
      </div>
    </div>
  )
}
