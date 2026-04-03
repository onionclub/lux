import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.join(app.getPath('userData'), 'lux')
    fs.mkdirSync(dataDir, { recursive: true })
    const dbPath = path.join(dataDir, 'lux.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    applySchema(db)
  }
  return db
}

function applySchema(db: Database.Database): void {
  // Try to load sqlite-vec extension
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
  } catch {
    console.warn('[lux] sqlite-vec not available — vector search disabled')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS texts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      tradition TEXT,
      importedAt TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileType TEXT NOT NULL CHECK(fileType IN ('pdf', 'txt'))
    );

    CREATE TABLE IF NOT EXISTS passages (
      id TEXT PRIMARY KEY,
      textId TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
      chapterIndex INTEGER NOT NULL DEFAULT 0,
      paragraphIndex INTEGER NOT NULL,
      content TEXT NOT NULL,
      charOffset INTEGER NOT NULL DEFAULT 0,
      embedding BLOB
    );

    CREATE INDEX IF NOT EXISTS idx_passages_textId ON passages(textId);

    CREATE TABLE IF NOT EXISTS passage_states (
      id TEXT PRIMARY KEY,
      passageId TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK(state IN ('resonant', 'latent', 'recontextualized')),
      changedAt TEXT NOT NULL,
      insightNote TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_passage_states_passageId ON passage_states(passageId);
    CREATE INDEX IF NOT EXISTS idx_passage_states_changedAt ON passage_states(changedAt);

    CREATE TABLE IF NOT EXISTS crystallization_events (
      id TEXT PRIMARY KEY,
      passageId TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
      fromState TEXT,
      toState TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      context TEXT NOT NULL CHECK(context IN ('in_session', 'outside_session')),
      contextDetail TEXT,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_crystallization_passageId ON crystallization_events(passageId);

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      traditionOfOrigin TEXT,
      firstEncounteredAt TEXT NOT NULL,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS concept_occurrences (
      id TEXT PRIMARY KEY,
      conceptId TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      passageId TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
      encounteredAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_concept_occurrences_conceptId ON concept_occurrences(conceptId);

    CREATE TABLE IF NOT EXISTS concept_connections (
      id TEXT PRIMARY KEY,
      conceptIdA TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      conceptIdB TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      connectionType TEXT NOT NULL DEFAULT 'explicit',
      createdAt TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS pinned_passages (
      id TEXT PRIMARY KEY,
      passageId TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
      pinnedAt TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS shadow_sessions (
      id TEXT PRIMARY KEY,
      startedAt TEXT NOT NULL,
      situationNarrative TEXT,
      beliefStatement TEXT,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS shadow_choices (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES shadow_sessions(id) ON DELETE CASCADE,
      phase INTEGER NOT NULL,
      optionIndex INTEGER NOT NULL,
      optionText TEXT NOT NULL,
      selectedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS belief_map_entries (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES shadow_sessions(id) ON DELETE CASCADE,
      beliefStatement TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outside_insights (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      recordedAt TEXT NOT NULL,
      approximateContext TEXT,
      linkedPassageIds TEXT,
      linkedConceptIds TEXT
    );
  `)

  // Migration: add isPartial column to texts if not present
  try {
    db.exec(`ALTER TABLE texts ADD COLUMN isPartial INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // Column already exists — safe to ignore
  }

  // Virtual table for vector search (if sqlite-vec loaded)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS passage_embeddings USING vec0(
        passageId TEXT PRIMARY KEY,
        embedding FLOAT[768]
      );
    `)
  } catch {
    // sqlite-vec not loaded
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
