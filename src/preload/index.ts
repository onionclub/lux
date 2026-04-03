import { contextBridge, ipcRenderer } from 'electron'

const lux = {
  // ─── Corpus ──────────────────────────────────────────────────────────────
  corpus: {
    list: () => ipcRenderer.invoke('corpus:list'),
    passages: (textId: string) => ipcRenderer.invoke('corpus:passages', textId),
    importDialog: () => ipcRenderer.invoke('corpus:importDialog'),
    import: (filePath: string, meta: { title: string; author?: string; tradition?: string }) =>
      ipcRenderer.invoke('corpus:import', filePath, meta),
    delete: (textId: string) => ipcRenderer.invoke('corpus:delete', textId),
    importBatchDialog: () => ipcRenderer.invoke('corpus:importBatchDialog'),
    importBatch: (filePaths: string[]) =>
      ipcRenderer.invoke('corpus:importBatch', filePaths),
  },

  // ─── Passage States ──────────────────────────────────────────────────────
  passages: {
    currentState: (passageId: string) => ipcRenderer.invoke('passages:currentState', passageId),
    stateHistory: (passageId: string) => ipcRenderer.invoke('passages:stateHistory', passageId),
    setState: (passageId: string, state: string, note?: string) =>
      ipcRenderer.invoke('passages:setState', passageId, state, note),
    crystallizationEvents: (passageId: string) =>
      ipcRenderer.invoke('passages:crystallizationEvents', passageId),
    recordCrystallization: (params: {
      passageId: string
      fromState?: string
      toState: string
      context: 'in_session' | 'outside_session'
      contextDetail?: string
      note?: string
    }) => ipcRenderer.invoke('passages:recordCrystallization', params),
    recordOutsideInsight: (params: {
      content: string
      approximateContext?: string
      linkedPassageIds?: string[]
      linkedConceptIds?: string[]
    }) => ipcRenderer.invoke('passages:recordOutsideInsight', params),
    listOutsideInsights: () => ipcRenderer.invoke('passages:listOutsideInsights'),
    pin: (passageId: string, note?: string) =>
      ipcRenderer.invoke('passages:pin', passageId, note),
    unpin: (passageId: string) => ipcRenderer.invoke('passages:unpin', passageId),
    getPinned: () => ipcRenderer.invoke('passages:getPinned'),
    isPinned: (passageId: string) => ipcRenderer.invoke('passages:isPinned', passageId),
    search: (query: string, limit?: number) =>
      ipcRenderer.invoke('passages:search', query, limit),
    updateInsightNote: (passageId: string, note: string) =>
      ipcRenderer.invoke('passages:updateInsightNote', passageId, note),
  },

  // ─── Knowledge Base ──────────────────────────────────────────────────────
  concepts: {
    list: () => ipcRenderer.invoke('concepts:list'),
    get: (id: string) => ipcRenderer.invoke('concepts:get', id),
    create: (params: { name: string; traditionOfOrigin?: string; summary?: string }) =>
      ipcRenderer.invoke('concepts:create', params),
    update: (
      id: string,
      updates: Partial<{ name: string; traditionOfOrigin: string; summary: string }>
    ) => ipcRenderer.invoke('concepts:update', id, updates),
    occurrences: (conceptId: string) => ipcRenderer.invoke('concepts:occurrences', conceptId),
    recordOccurrence: (conceptId: string, passageId: string) =>
      ipcRenderer.invoke('concepts:recordOccurrence', conceptId, passageId),
    connect: (params: {
      conceptIdA: string
      conceptIdB: string
      connectionType?: string
      note?: string
    }) => ipcRenderer.invoke('concepts:connect', params),
    graph: () => ipcRenderer.invoke('concepts:graph'),
  },

  // ─── AI Features ─────────────────────────────────────────────────────────
  ai: {
    available: () => ipcRenderer.invoke('ai:available'),
    invoke: (req: {
      type: 'scoped_question' | 'cross_tradition'
      passage: string
      neighborPassages?: string[]
      question?: string
      conceptName?: string
      traditions?: string[]
    }) => ipcRenderer.invoke('ai:invoke', req),
    onStream: (
      cb: (data: { requestId: string; chunk: string; done: boolean; error?: boolean }) => void
    ) => {
      const handler = (_: Electron.IpcRendererEvent, data: { requestId: string; chunk: string; done: boolean; error?: boolean }) => cb(data)
      ipcRenderer.on('ai:stream', handler)
      return () => ipcRenderer.removeListener('ai:stream', handler)
    },
  },

  // ─── Shadow Work ─────────────────────────────────────────────────────────
  shadow: {
    start: () => ipcRenderer.invoke('shadow:start'),
    updateNarrative: (sessionId: string, narrative: string) =>
      ipcRenderer.invoke('shadow:updateNarrative', sessionId, narrative),
    phaseOptions: (phase: 1 | 2) => ipcRenderer.invoke('shadow:phaseOptions', phase),
    recordChoice: (params: {
      sessionId: string
      phase: 1 | 2
      optionIndex: number
      optionText: string
    }) => ipcRenderer.invoke('shadow:recordChoice', params),
    complete: (sessionId: string, beliefStatement: string) =>
      ipcRenderer.invoke('shadow:complete', sessionId, beliefStatement),
    beliefMap: () => ipcRenderer.invoke('shadow:beliefMap'),
    sessions: () => ipcRenderer.invoke('shadow:sessions'),
    session: (id: string) => ipcRenderer.invoke('shadow:session', id),
    choices: (sessionId: string) => ipcRenderer.invoke('shadow:choices', sessionId),
  },
}

contextBridge.exposeInMainWorld('lux', lux)

export type LuxAPI = typeof lux
