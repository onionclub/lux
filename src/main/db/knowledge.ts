import { getDb } from './schema'
import { randomUUID } from 'crypto'

export interface Concept {
  id: string
  name: string
  traditionOfOrigin: string | null
  firstEncounteredAt: string
  summary: string | null
}

export interface ConceptOccurrence {
  id: string
  conceptId: string
  passageId: string
  encounteredAt: string
}

export interface ConceptConnection {
  id: string
  conceptIdA: string
  conceptIdB: string
  connectionType: string
  createdAt: string
  note: string | null
}

export interface GraphData {
  nodes: Array<{
    id: string
    name: string
    tradition: string | null
    occurrenceCount: number
  }>
  links: Array<{
    id: string
    source: string
    target: string
    type: string
    note: string | null
  }>
}

export function listConcepts(): Concept[] {
  const db = getDb()
  return db.prepare('SELECT * FROM concepts ORDER BY firstEncounteredAt DESC').all() as Concept[]
}

export function getConcept(id: string): Concept | null {
  const db = getDb()
  return (db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept) || null
}

export function createConcept(params: {
  name: string
  traditionOfOrigin?: string
  summary?: string
}): Concept {
  const db = getDb()
  const id = randomUUID()
  const firstEncounteredAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO concepts (id, name, traditionOfOrigin, firstEncounteredAt, summary) VALUES (?, ?, ?, ?, ?)'
  ).run(id, params.name, params.traditionOfOrigin || null, firstEncounteredAt, params.summary || null)

  return {
    id,
    name: params.name,
    traditionOfOrigin: params.traditionOfOrigin || null,
    firstEncounteredAt,
    summary: params.summary || null,
  }
}

export function updateConcept(
  id: string,
  updates: Partial<Pick<Concept, 'name' | 'traditionOfOrigin' | 'summary'>>
): void {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.traditionOfOrigin !== undefined) { fields.push('traditionOfOrigin = ?'); values.push(updates.traditionOfOrigin) }
  if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary) }
  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE concepts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function recordConceptOccurrence(conceptId: string, passageId: string): ConceptOccurrence {
  const db = getDb()
  // Check for existing
  const existing = db
    .prepare('SELECT * FROM concept_occurrences WHERE conceptId = ? AND passageId = ?')
    .get(conceptId, passageId)
  if (existing) return existing as ConceptOccurrence

  const id = randomUUID()
  const encounteredAt = new Date().toISOString()
  db.prepare(
    'INSERT INTO concept_occurrences (id, conceptId, passageId, encounteredAt) VALUES (?, ?, ?, ?)'
  ).run(id, conceptId, passageId, encounteredAt)

  return { id, conceptId, passageId, encounteredAt }
}

export function getConceptOccurrences(conceptId: string): ConceptOccurrence[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM concept_occurrences WHERE conceptId = ? ORDER BY encounteredAt DESC')
    .all(conceptId) as ConceptOccurrence[]
}

export function connectConcepts(params: {
  conceptIdA: string
  conceptIdB: string
  connectionType?: string
  note?: string
}): ConceptConnection {
  const db = getDb()
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const type = params.connectionType || 'explicit'

  db.prepare(
    `INSERT INTO concept_connections (id, conceptIdA, conceptIdB, connectionType, createdAt, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, params.conceptIdA, params.conceptIdB, type, createdAt, params.note || null)

  return {
    id,
    conceptIdA: params.conceptIdA,
    conceptIdB: params.conceptIdB,
    connectionType: type,
    createdAt,
    note: params.note || null,
  }
}

export function getGraphData(): GraphData {
  const db = getDb()

  const concepts = db.prepare('SELECT * FROM concepts').all() as Concept[]
  const occurrenceCounts = db
    .prepare(
      'SELECT conceptId, COUNT(*) as cnt FROM concept_occurrences GROUP BY conceptId'
    )
    .all() as Array<{ conceptId: string; cnt: number }>
  const occurrenceMap = new Map(occurrenceCounts.map((r) => [r.conceptId, r.cnt]))

  const connections = db
    .prepare('SELECT * FROM concept_connections ORDER BY createdAt DESC')
    .all() as ConceptConnection[]

  return {
    nodes: concepts.map((c) => ({
      id: c.id,
      name: c.name,
      tradition: c.traditionOfOrigin,
      occurrenceCount: occurrenceMap.get(c.id) || 0,
    })),
    links: connections.map((conn) => ({
      id: conn.id,
      source: conn.conceptIdA,
      target: conn.conceptIdB,
      type: conn.connectionType,
      note: conn.note,
    })),
  }
}
