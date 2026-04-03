import { getDb } from '../db/schema'
import { embed, embedBatch } from './model'
import { getPassagesForText } from '../db/corpus'

export interface SearchResult {
  passageId: string
  textId: string
  content: string
  score: number
}

/**
 * Index all passages for a text after import.
 * Generates embeddings and stores them in the vec0 virtual table.
 */
export async function indexText(textId: string): Promise<void> {
  const db = getDb()
  const passages = getPassagesForText(textId)
  if (passages.length === 0) return

  const texts = passages.map((p) => p.content)
  const embeddings = await embedBatch(texts)

  // Check if vec0 table exists
  const hasVec = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='passage_embeddings'").get()
  if (!hasVec) {
    console.warn('[lux] passage_embeddings table not available — skipping vector index')
    return
  }

  const upsert = db.prepare(
    'INSERT OR REPLACE INTO passage_embeddings (passageId, embedding) VALUES (?, ?)'
  )

  const tx = db.transaction(() => {
    for (let i = 0; i < passages.length; i++) {
      const emb = embeddings[i]
      if (!emb) continue
      // sqlite-vec expects a Float32Array serialized as blob
      const buf = Buffer.from(new Float32Array(emb).buffer)
      upsert.run(passages[i].id, buf)
    }
  })
  tx()
}

/**
 * Semantic search across all indexed passages.
 * Falls back to keyword search if embeddings are unavailable.
 */
export async function searchPassages(query: string, limit = 10): Promise<SearchResult[]> {
  const db = getDb()

  const queryEmbedding = await embed(query)
  if (!queryEmbedding) {
    return keywordSearch(query, limit)
  }

  const hasVec = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='passage_embeddings'").get()
  if (!hasVec) {
    return keywordSearch(query, limit)
  }

  try {
    const buf = Buffer.from(new Float32Array(queryEmbedding).buffer)
    const rows = db.prepare(`
      SELECT pe.passageId, p.textId, p.content, pe.distance as score
      FROM passage_embeddings pe
      JOIN passages p ON p.id = pe.passageId
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(buf, limit) as Array<{ passageId: string; textId: string; content: string; score: number }>

    return rows.map((r) => ({ ...r, score: 1 - r.score }))
  } catch {
    return keywordSearch(query, limit)
  }
}

function keywordSearch(query: string, limit: number): SearchResult[] {
  const db = getDb()
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (terms.length === 0) return []

  const conditions = terms.map(() => 'LOWER(p.content) LIKE ?').join(' OR ')
  const params = terms.map((t) => `%${t}%`)
  params.push(String(limit))

  const rows = db
    .prepare(
      `SELECT p.id as passageId, p.textId, p.content FROM passages p WHERE ${conditions} LIMIT ?`
    )
    .all(...params) as Array<{ passageId: string; textId: string; content: string }>

  return rows.map((r) => ({ ...r, score: 0.5 }))
}
