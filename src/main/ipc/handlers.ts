import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as corpus from '../db/corpus'
import * as annotations from '../db/annotations'
import * as knowledge from '../db/knowledge'
import * as shadow from '../db/shadow'
import { searchPassages, indexText } from '../embeddings/search'
import { invokeClaude, checkClaudeAvailable } from '../ai/claude'
import { randomUUID } from 'crypto'

export function registerIpcHandlers(): void {
  // ─── Corpus ──────────────────────────────────────────────────────────────

  ipcMain.handle('corpus:list', () => corpus.listTexts())

  ipcMain.handle('corpus:passages', (_e, textId: string) =>
    corpus.getPassagesForText(textId)
  )

  ipcMain.handle('corpus:importDialog', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Import text',
      filters: [
        { name: 'Supported files', extensions: ['pdf', 'txt'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('corpus:importBatchDialog', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Import corpus',
      filters: [
        { name: 'Supported files', extensions: ['pdf', 'txt'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths
  })

  ipcMain.handle('corpus:importBatch', async (_e, filePaths: string[]) => {
    const result = await corpus.importBatch(filePaths)
    // Index embeddings for each succeeded text in the background
    for (const s of result.succeeded) {
      indexText(s.textId).catch((err) =>
        console.warn('[lux] Embedding index failed:', err)
      )
    }
    return result
  })

  ipcMain.handle(
    'corpus:import',
    async (
      _e,
      filePath: string,
      meta: { title: string; author?: string; tradition?: string }
    ) => {
      const result = await corpus.importFile(filePath, meta)
      // Index embeddings in the background (don't await)
      indexText(result.textId).catch((err) =>
        console.warn('[lux] Embedding index failed:', err)
      )
      return result
    }
  )

  ipcMain.handle('corpus:delete', (_e, textId: string) => {
    corpus.deleteText(textId)
    return true
  })

  // ─── Passage States ──────────────────────────────────────────────────────

  ipcMain.handle('passages:currentState', (_e, passageId: string) =>
    annotations.getCurrentState(passageId)
  )

  ipcMain.handle('passages:stateHistory', (_e, passageId: string) =>
    annotations.getStateHistory(passageId)
  )

  ipcMain.handle(
    'passages:setState',
    (_e, passageId: string, state: annotations.PassageStateValue, note?: string) =>
      annotations.setState(passageId, state, note)
  )

  ipcMain.handle('passages:crystallizationEvents', (_e, passageId: string) =>
    annotations.getCrystallizationEvents(passageId)
  )

  ipcMain.handle(
    'passages:recordCrystallization',
    (
      _e,
      params: {
        passageId: string
        fromState?: string
        toState: string
        context: annotations.CrystallizationContext
        contextDetail?: string
        note?: string
      }
    ) => annotations.recordCrystallization(params)
  )

  ipcMain.handle(
    'passages:recordOutsideInsight',
    (
      _e,
      params: {
        content: string
        approximateContext?: string
        linkedPassageIds?: string[]
        linkedConceptIds?: string[]
      }
    ) => annotations.recordOutsideInsight(params)
  )

  ipcMain.handle('passages:listOutsideInsights', () => annotations.listOutsideInsights())

  ipcMain.handle('passages:pin', (_e, passageId: string, note?: string) =>
    annotations.pinPassage(passageId, note)
  )

  ipcMain.handle('passages:unpin', (_e, passageId: string) =>
    annotations.unpinPassage(passageId)
  )

  ipcMain.handle('passages:getPinned', () => annotations.getPinnedPassages())

  ipcMain.handle('passages:isPinned', (_e, passageId: string) =>
    annotations.isPassagePinned(passageId)
  )

  ipcMain.handle('passages:updateInsightNote', (_e, passageId: string, note: string) => {
    annotations.updateInsightNote(passageId, note)
    return true
  })

  // ─── Knowledge Base ──────────────────────────────────────────────────────

  ipcMain.handle('concepts:list', () => knowledge.listConcepts())

  ipcMain.handle('concepts:get', (_e, id: string) => knowledge.getConcept(id))

  ipcMain.handle(
    'concepts:create',
    (_e, params: { name: string; traditionOfOrigin?: string; summary?: string }) =>
      knowledge.createConcept(params)
  )

  ipcMain.handle(
    'concepts:update',
    (_e, id: string, updates: Partial<Pick<knowledge.Concept, 'name' | 'traditionOfOrigin' | 'summary'>>) => {
      knowledge.updateConcept(id, updates)
      return true
    }
  )

  ipcMain.handle('concepts:occurrences', (_e, conceptId: string) =>
    knowledge.getConceptOccurrences(conceptId)
  )

  ipcMain.handle('concepts:recordOccurrence', (_e, conceptId: string, passageId: string) =>
    knowledge.recordConceptOccurrence(conceptId, passageId)
  )

  ipcMain.handle(
    'concepts:connect',
    (
      _e,
      params: {
        conceptIdA: string
        conceptIdB: string
        connectionType?: string
        note?: string
      }
    ) => knowledge.connectConcepts(params)
  )

  ipcMain.handle('concepts:graph', () => knowledge.getGraphData())

  // ─── Semantic Search ─────────────────────────────────────────────────────

  ipcMain.handle('passages:search', (_e, query: string, limit?: number) =>
    searchPassages(query, limit)
  )

  // ─── AI Features ─────────────────────────────────────────────────────────

  ipcMain.handle('ai:available', () => checkClaudeAvailable())

  ipcMain.handle(
    'ai:invoke',
    (
      e,
      req: {
        type: 'scoped_question' | 'cross_tradition'
        passage: string
        neighborPassages?: string[]
        question?: string
        conceptName?: string
        traditions?: string[]
      }
    ) => {
      const win = BrowserWindow.fromWebContents(e.sender)!
      const requestId = randomUUID()
      // Fire and don't await — streaming happens via 'ai:stream' events
      invokeClaude(win, requestId, req).catch((err) =>
        console.warn('[lux/ai] Invoke error:', err)
      )
      return requestId
    }
  )

  // ─── Shadow Work ─────────────────────────────────────────────────────────

  ipcMain.handle('shadow:start', () => shadow.startSession())

  ipcMain.handle('shadow:updateNarrative', (_e, sessionId: string, narrative: string) => {
    shadow.updateNarrative(sessionId, narrative)
    return true
  })

  ipcMain.handle('shadow:phaseOptions', (_e, phase: 1 | 2) =>
    shadow.getPhaseOptions(phase)
  )

  ipcMain.handle(
    'shadow:recordChoice',
    (
      _e,
      params: { sessionId: string; phase: 1 | 2; optionIndex: number; optionText: string }
    ) => shadow.recordChoice(params)
  )

  ipcMain.handle('shadow:complete', (_e, sessionId: string, beliefStatement: string) =>
    shadow.completeSession(sessionId, beliefStatement)
  )

  ipcMain.handle('shadow:beliefMap', () => shadow.getBeliefMap())

  ipcMain.handle('shadow:sessions', () => shadow.listSessions())

  ipcMain.handle('shadow:session', (_e, id: string) => shadow.getSession(id))

  ipcMain.handle('shadow:choices', (_e, sessionId: string) => shadow.getSessionChoices(sessionId))
}
