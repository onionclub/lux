import { getDb } from './schema'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface Text {
  id: string
  title: string
  author: string | null
  tradition: string | null
  importedAt: string
  filePath: string
  fileType: 'pdf' | 'txt'
  isPartial: number
}

export interface Passage {
  id: string
  textId: string
  chapterIndex: number
  paragraphIndex: number
  content: string
  charOffset: number
}

export function listTexts(): Text[] {
  const db = getDb()
  return db.prepare('SELECT * FROM texts ORDER BY importedAt DESC').all() as Text[]
}

export function getText(id: string): Text | null {
  const db = getDb()
  return (db.prepare('SELECT * FROM texts WHERE id = ?').get(id) as Text) || null
}

export function getPassagesForText(textId: string): Passage[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM passages WHERE textId = ? ORDER BY chapterIndex, paragraphIndex')
    .all(textId) as Passage[]
}

export function getPassage(id: string): Passage | null {
  const db = getDb()
  return (db.prepare('SELECT * FROM passages WHERE id = ?').get(id) as Passage) || null
}

export async function importFile(
  filePath: string,
  meta: { title: string; author?: string; tradition?: string }
): Promise<{ textId: string; passageCount: number }> {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  if (ext !== 'pdf' && ext !== 'txt') {
    throw new Error('Only PDF and TXT files are supported')
  }

  // Copy file to userData corpus dir
  const corpusDir = path.join(app.getPath('userData'), 'lux', 'corpus')
  fs.mkdirSync(corpusDir, { recursive: true })
  const textId = randomUUID()
  const destName = `${textId}${path.extname(filePath)}`
  const destPath = path.join(corpusDir, destName)
  fs.copyFileSync(filePath, destPath)

  let rawText = ''
  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    rawText = data.text
  } else {
    rawText = fs.readFileSync(filePath, 'utf-8')
  }

  const passages = extractPassages(rawText, textId)

  const db = getDb()
  const insertText = db.prepare(
    'INSERT INTO texts (id, title, author, tradition, importedAt, filePath, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const insertPassage = db.prepare(
    'INSERT INTO passages (id, textId, chapterIndex, paragraphIndex, content, charOffset) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    insertText.run(
      textId,
      meta.title,
      meta.author || null,
      meta.tradition || null,
      new Date().toISOString(),
      destPath,
      ext
    )
    for (const p of passages) {
      insertPassage.run(p.id, p.textId, p.chapterIndex, p.paragraphIndex, p.content, p.charOffset)
    }
  })
  tx()

  return { textId, passageCount: passages.length }
}

function extractPassages(text: string, textId: string): Passage[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30)

  let charOffset = 0
  return paragraphs.map((content, idx) => {
    const p: Passage = {
      id: randomUUID(),
      textId,
      chapterIndex: 0,
      paragraphIndex: idx,
      content,
      charOffset,
    }
    charOffset += content.length + 2
    return p
  })
}

export interface BatchImportResult {
  succeeded: Array<{ textId: string; title: string }>
  failed: Array<{ name: string; error: string }>
}

export async function importBatch(
  filePaths: string[]
): Promise<BatchImportResult> {
  const succeeded: BatchImportResult['succeeded'] = []
  const failed: BatchImportResult['failed'] = []

  for (const filePath of filePaths) {
    const name = path.basename(filePath)
    const title = name.replace(/\.(pdf|txt)$/i, '')
    try {
      const result = await importFile(filePath, { title })
      succeeded.push({ textId: result.textId, title })
    } catch (err) {
      failed.push({ name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // If some failed, mark the successfully imported texts as partial
  if (failed.length > 0) {
    const db = getDb()
    for (const s of succeeded) {
      db.prepare('UPDATE texts SET isPartial = 1 WHERE id = ?').run(s.textId)
    }
  }

  return { succeeded, failed }
}

export function deleteText(id: string): void {
  const db = getDb()
  const text = getText(id)
  if (text) {
    try {
      fs.unlinkSync(text.filePath)
    } catch {
      // file already gone
    }
    db.prepare('DELETE FROM texts WHERE id = ?').run(id)
  }
}
