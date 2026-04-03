import { getDb } from './schema'
import { randomUUID } from 'crypto'

export type PassageStateValue = 'resonant' | 'latent' | 'recontextualized'
export type CrystallizationContext = 'in_session' | 'outside_session'

export interface PassageStateRecord {
  id: string
  passageId: string
  state: PassageStateValue
  changedAt: string
  insightNote: string | null
}

export interface CrystallizationEvent {
  id: string
  passageId: string
  fromState: string | null
  toState: string
  timestamp: string
  context: CrystallizationContext
  contextDetail: string | null
  note: string | null
}

export interface OutsideInsight {
  id: string
  content: string
  recordedAt: string
  approximateContext: string | null
  linkedPassageIds: string | null
  linkedConceptIds: string | null
}

export function getCurrentState(passageId: string): PassageStateRecord | null {
  const db = getDb()
  return (
    (db
      .prepare(
        'SELECT * FROM passage_states WHERE passageId = ? ORDER BY changedAt DESC LIMIT 1'
      )
      .get(passageId) as PassageStateRecord) || null
  )
}

export function getStateHistory(passageId: string): PassageStateRecord[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM passage_states WHERE passageId = ? ORDER BY changedAt DESC')
    .all(passageId) as PassageStateRecord[]
}

export function setState(
  passageId: string,
  state: PassageStateValue,
  insightNote?: string
): PassageStateRecord {
  const db = getDb()
  const prior = getCurrentState(passageId)
  const id = randomUUID()
  const changedAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO passage_states (id, passageId, state, changedAt, insightNote) VALUES (?, ?, ?, ?, ?)'
  ).run(id, passageId, state, changedAt, insightNote || null)

  // If transitioning from latent to resonant, auto-create crystallization event
  if (prior?.state === 'latent' && state === 'resonant') {
    recordCrystallization({
      passageId,
      fromState: prior.state,
      toState: state,
      context: 'in_session',
      note: insightNote,
    })
  }

  return { id, passageId, state, changedAt, insightNote: insightNote || null }
}

export function recordCrystallization(params: {
  passageId: string
  fromState?: string
  toState: string
  context: CrystallizationContext
  contextDetail?: string
  note?: string
}): CrystallizationEvent {
  const db = getDb()
  const id = randomUUID()
  const timestamp = new Date().toISOString()

  db.prepare(
    `INSERT INTO crystallization_events
     (id, passageId, fromState, toState, timestamp, context, contextDetail, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.passageId,
    params.fromState || null,
    params.toState,
    timestamp,
    params.context,
    params.contextDetail || null,
    params.note || null
  )

  return {
    id,
    passageId: params.passageId,
    fromState: params.fromState || null,
    toState: params.toState,
    timestamp,
    context: params.context,
    contextDetail: params.contextDetail || null,
    note: params.note || null,
  }
}

export function getCrystallizationEvents(passageId: string): CrystallizationEvent[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM crystallization_events WHERE passageId = ? ORDER BY timestamp DESC'
    )
    .all(passageId) as CrystallizationEvent[]
}

export function recordOutsideInsight(params: {
  content: string
  approximateContext?: string
  linkedPassageIds?: string[]
  linkedConceptIds?: string[]
}): OutsideInsight {
  const db = getDb()
  const id = randomUUID()
  const recordedAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO outside_insights (id, content, recordedAt, approximateContext, linkedPassageIds, linkedConceptIds)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.content,
    recordedAt,
    params.approximateContext || null,
    params.linkedPassageIds ? JSON.stringify(params.linkedPassageIds) : null,
    params.linkedConceptIds ? JSON.stringify(params.linkedConceptIds) : null
  )

  return {
    id,
    content: params.content,
    recordedAt,
    approximateContext: params.approximateContext || null,
    linkedPassageIds: params.linkedPassageIds ? JSON.stringify(params.linkedPassageIds) : null,
    linkedConceptIds: params.linkedConceptIds ? JSON.stringify(params.linkedConceptIds) : null,
  }
}

export function listOutsideInsights(): OutsideInsight[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM outside_insights ORDER BY recordedAt DESC')
    .all() as OutsideInsight[]
}

export function pinPassage(passageId: string, note?: string): void {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM pinned_passages WHERE passageId = ?').get(passageId)
  if (existing) return
  db.prepare(
    'INSERT INTO pinned_passages (id, passageId, pinnedAt, note) VALUES (?, ?, ?, ?)'
  ).run(randomUUID(), passageId, new Date().toISOString(), note || null)
}

export function unpinPassage(passageId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM pinned_passages WHERE passageId = ?').run(passageId)
}

export function getPinnedPassages(): Array<{ passageId: string; pinnedAt: string; note: string | null }> {
  const db = getDb()
  return db.prepare('SELECT passageId, pinnedAt, note FROM pinned_passages ORDER BY pinnedAt DESC').all() as Array<{ passageId: string; pinnedAt: string; note: string | null }>
}

export function isPassagePinned(passageId: string): boolean {
  const db = getDb()
  return !!db.prepare('SELECT id FROM pinned_passages WHERE passageId = ?').get(passageId)
}

export function updateInsightNote(passageId: string, note: string): void {
  const db = getDb()
  const latest = getCurrentState(passageId)
  if (!latest) return
  db.prepare('UPDATE passage_states SET insightNote = ? WHERE id = ?').run(note, latest.id)
  // Also update the crystallization event note for this passage's most recent event
  db.prepare(
    `UPDATE crystallization_events SET note = ?
     WHERE passageId = ? AND id = (
       SELECT id FROM crystallization_events WHERE passageId = ? ORDER BY timestamp DESC LIMIT 1
     )`
  ).run(note, passageId, passageId)
}
