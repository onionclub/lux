import React from 'react'
import { useAppStore, Surface } from './store'
import Reader from './components/Reader'
import KnowledgeBase from './components/KnowledgeBase'
import ConceptGraph from './components/ConceptGraph'
import ShadowWork from './components/ShadowWork'

const NAV_ITEMS: Array<{ id: Surface; label: string; symbol: string }> = [
  { id: 'reader', label: 'Text', symbol: '⬜' },
  { id: 'knowledge', label: 'Gathered', symbol: '⬡' },
  { id: 'graph', label: 'Map', symbol: '⊕' },
  { id: 'shadow', label: 'Chamber', symbol: '◐' },
]

export default function App() {
  const { surface, setSurface } = useAppStore()

  return (
    <div className="flex h-screen overflow-hidden bg-lucent-bg">
      {/* Sidebar nav */}
      <nav className="w-16 bg-lucent-surface border-r border-lucent-border flex flex-col items-center py-4 flex-shrink-0">
        <div className="mb-6">
          <div
            className="w-8 h-8 rounded-sm flex items-center justify-center"
            style={{ background: '#C9A96E' }}
            title="Lux"
          >
            <span className="text-white font-medium text-xs">L</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              title={item.label}
              className={`w-10 h-10 rounded-sm flex flex-col items-center justify-center gap-0.5 transition-colors ${
                surface === item.id
                  ? 'bg-lucent-accent/10 text-lucent-accent'
                  : 'text-lucent-muted hover:text-lucent-text hover:bg-lucent-border/30'
              }`}
              onClick={() => setSurface(item.id)}
            >
              <span className="text-sm">{item.symbol}</span>
              <span className="text-[9px] leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {surface === 'reader' && <Reader />}
        {surface === 'knowledge' && <KnowledgeBase />}
        {surface === 'graph' && <ConceptGraph />}
        {surface === 'shadow' && <ShadowWork />}
      </main>
    </div>
  )
}
