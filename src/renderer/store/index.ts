import { create } from 'zustand'

export type Surface = 'reader' | 'knowledge' | 'graph' | 'shadow'

interface AppState {
  surface: Surface
  setSurface: (s: Surface) => void

  activeTextId: string | null
  setActiveTextId: (id: string | null) => void

  selectedPassageId: string | null
  setSelectedPassageId: (id: string | null) => void

  aiResponses: Record<string, string>
  aiStreaming: Record<string, boolean>
  appendAiChunk: (requestId: string, chunk: string) => void
  setAiDone: (requestId: string) => void
  clearAiResponse: (requestId: string) => void

  searchQuery: string
  setSearchQuery: (q: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  surface: 'reader',
  setSurface: (surface) => set({ surface }),

  activeTextId: null,
  setActiveTextId: (activeTextId) => set({ activeTextId }),

  selectedPassageId: null,
  setSelectedPassageId: (selectedPassageId) => set({ selectedPassageId }),

  aiResponses: {},
  aiStreaming: {},
  appendAiChunk: (requestId, chunk) =>
    set((state) => ({
      aiResponses: {
        ...state.aiResponses,
        [requestId]: (state.aiResponses[requestId] || '') + chunk,
      },
      aiStreaming: { ...state.aiStreaming, [requestId]: true },
    })),
  setAiDone: (requestId) =>
    set((state) => ({
      aiStreaming: { ...state.aiStreaming, [requestId]: false },
    })),
  clearAiResponse: (requestId) =>
    set((state) => {
      const { [requestId]: _, ...rest } = state.aiResponses
      const { [requestId]: __, ...streaming } = state.aiStreaming
      return { aiResponses: rest, aiStreaming: streaming }
    }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}))
