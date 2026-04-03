import { getDb } from './schema'
import { randomUUID } from 'crypto'

export interface ShadowSession {
  id: string
  startedAt: string
  situationNarrative: string | null
  beliefStatement: string | null
  completedAt: string | null
}

export interface ShadowChoice {
  id: string
  sessionId: string
  phase: number
  optionIndex: number
  optionText: string
  selectedAt: string
}

export interface BeliefMapEntry {
  id: string
  sessionId: string
  beliefStatement: string
  createdAt: string
}

// Phase 1 option sets — cinematic, experiential language
// Per the Chamber Option Card Copy Standard (approved April 2026):
// Cards name what happened, not what was felt. No psychological vocabulary.
// NOTE: This is a placeholder library. The official card library is a pending Writer deliverable.
const PHASE_1_OPTION_SETS = [
  [
    'The moment I realised something had gone wrong',
    'The look on their face when it happened',
    'What I said, and what I wish I had said',
    'The part I keep replaying in my mind',
  ],
  [
    'When they did not show up the way I needed them to',
    'When I stayed silent instead of speaking',
    'The decision I made that I am still carrying',
    'When I realised this had happened before',
  ],
  [
    'The scene I would rather not describe in detail',
    'What I saw them do when they thought no one was watching',
    'The moment I felt most alone in it',
    'What I understood in the quiet after',
  ],
]

// Phase 2 option sets — first-person belief statements
// Per the Chamber Option Card Copy Standard (approved April 2026):
// Cards speak as the practitioner's inner voice. No psychological formulations.
// NOTE: This is a placeholder library. The official card library is a pending Writer deliverable.
const PHASE_2_OPTION_SETS = [
  [
    'I am not enough to be chosen',
    'If I am fully seen, I will be abandoned',
    'Asking for what I need makes me a burden',
    'I must earn my place in any relationship',
  ],
  [
    'The world is not reliably safe',
    'I am responsible for how others feel',
    'Closeness leads to being hurt',
    'What I want is always going to cost too much',
  ],
  [
    'I have to be exceptional to be worth keeping',
    'Vulnerability is a weakness that will be used against me',
    'I cause harm without intending to',
    'Belonging is always conditional',
  ],
]

export function startSession(): ShadowSession {
  const db = getDb()
  const id = randomUUID()
  const startedAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO shadow_sessions (id, startedAt) VALUES (?, ?)'
  ).run(id, startedAt)

  return { id, startedAt, situationNarrative: null, beliefStatement: null, completedAt: null }
}

export function updateNarrative(sessionId: string, narrative: string): void {
  const db = getDb()
  db.prepare('UPDATE shadow_sessions SET situationNarrative = ? WHERE id = ?').run(narrative, sessionId)
}

export function getPhaseOptions(phase: 1 | 2): string[] {
  const sets = phase === 1 ? PHASE_1_OPTION_SETS : PHASE_2_OPTION_SETS
  const idx = Math.floor(Math.random() * sets.length)
  return sets[idx]
}

export function recordChoice(params: {
  sessionId: string
  phase: 1 | 2
  optionIndex: number
  optionText: string
}): ShadowChoice {
  const db = getDb()
  const id = randomUUID()
  const selectedAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO shadow_choices (id, sessionId, phase, optionIndex, optionText, selectedAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, params.sessionId, params.phase, params.optionIndex, params.optionText, selectedAt)

  return {
    id,
    sessionId: params.sessionId,
    phase: params.phase,
    optionIndex: params.optionIndex,
    optionText: params.optionText,
    selectedAt,
  }
}

export function completeSession(sessionId: string, beliefStatement: string): ShadowSession {
  const db = getDb()
  const completedAt = new Date().toISOString()

  db.prepare(
    'UPDATE shadow_sessions SET beliefStatement = ?, completedAt = ? WHERE id = ?'
  ).run(beliefStatement, completedAt, sessionId)

  // Add to belief map
  db.prepare(
    'INSERT INTO belief_map_entries (id, sessionId, beliefStatement, createdAt) VALUES (?, ?, ?, ?)'
  ).run(randomUUID(), sessionId, beliefStatement, completedAt)

  return db.prepare('SELECT * FROM shadow_sessions WHERE id = ?').get(sessionId) as ShadowSession
}

export function getBeliefMap(): BeliefMapEntry[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM belief_map_entries ORDER BY createdAt DESC')
    .all() as BeliefMapEntry[]
}

export function getSession(id: string): ShadowSession | null {
  const db = getDb()
  return (db.prepare('SELECT * FROM shadow_sessions WHERE id = ?').get(id) as ShadowSession) || null
}

export function listSessions(): ShadowSession[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM shadow_sessions ORDER BY startedAt DESC')
    .all() as ShadowSession[]
}

export function getSessionChoices(sessionId: string): ShadowChoice[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM shadow_choices WHERE sessionId = ? ORDER BY phase, selectedAt')
    .all(sessionId) as ShadowChoice[]
}
