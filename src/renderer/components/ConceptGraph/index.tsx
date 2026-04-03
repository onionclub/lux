import React, { useEffect, useState, useRef, useCallback } from 'react'

interface GraphNode {
  id: string
  name: string
  tradition: string | null
  occurrenceCount: number
  x?: number
  y?: number
}

interface GraphLink {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  type: string
  note: string | null
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

/**
 * ConceptGraph — strictly retrospective.
 * Renders ONLY what the practitioner has done.
 * No gap analysis, no suggestions, no unexplored area highlighting.
 * This constraint is enforced at the component contract level.
 */
export default function ConceptGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [ForceGraph, setForceGraph] = useState<React.ComponentType<{
    graphData: GraphData
    nodeLabel: (n: GraphNode) => string
    nodeVal: (n: GraphNode) => number
    nodeColor: () => string
    linkColor: () => string
    linkWidth: () => number
    onNodeClick: (n: GraphNode) => void
    backgroundColor: string
    width: number
    height: number
  }> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    // Dynamically import react-force-graph to avoid SSR issues
    import('react-force-graph').then((mod) => {
      setForceGraph(() => mod.ForceGraph2D as unknown as typeof ForceGraph)
    }).catch(() => {
      console.warn('[lux] react-force-graph not available')
    })
  }, [])

  useEffect(() => {
    window.lux.concepts.graph().then((data: GraphData) => {
      setGraphData(data)
    })
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  const nodeVal = useCallback((n: GraphNode) => Math.max(1, n.occurrenceCount) * 2, [])

  return (
    <div className="flex h-full">
      <div ref={containerRef} className="flex-1 relative">
        {graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-lucent-muted text-sm text-center max-w-xs">
              The map forms as you mark.
            </p>
          </div>
        ) : ForceGraph ? (
          <ForceGraph
            graphData={graphData}
            nodeLabel={(n: GraphNode) => n.name}
            nodeVal={nodeVal}
            nodeColor={() => '#C9A96E'}
            linkColor={() => '#E0D9CE'}
            linkWidth={() => 1}
            onNodeClick={handleNodeClick}
            backgroundColor="#FAF7F0"
            width={dimensions.width}
            height={dimensions.height}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-lucent-muted text-xs">Loading graph…</p>
          </div>
        )}
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <div className="w-64 border-l border-lucent-border flex flex-col">
          <div className="surface-header">
            <span className="text-sm font-medium">Concept</span>
            <button className="btn-ghost text-xs" onClick={() => setSelectedNode(null)}>✕</button>
          </div>
          <div className="p-4">
            <h2 className="text-base font-medium text-lucent-text">{selectedNode.name}</h2>
            {selectedNode.tradition && (
              <p className="text-xs text-lucent-accent mt-1">{selectedNode.tradition}</p>
            )}
            <p className="text-xs text-lucent-muted mt-2">
              {selectedNode.occurrenceCount} passage occurrence{selectedNode.occurrenceCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="px-4 pb-4">
            <p className="text-xs text-lucent-muted/60 italic">
              This graph reflects your engagement only.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
