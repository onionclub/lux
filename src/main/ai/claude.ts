import { spawn } from 'child_process'
import { BrowserWindow } from 'electron'

export interface AIRequest {
  type: 'scoped_question' | 'cross_tradition'
  passage: string
  neighborPassages?: string[]
  question?: string
  conceptName?: string
  traditions?: string[]
}

/**
 * Invoke Claude Code CLI (claude --print) and stream the response back
 * via IPC to the renderer window.
 * Gracefully degrades if CLI is unavailable.
 */
export async function invokeClaude(
  win: BrowserWindow,
  requestId: string,
  req: AIRequest
): Promise<void> {
  const prompt = buildPrompt(req)

  const child = spawn('claude', ['--print', prompt], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  child.on('error', () => {
    // CLI not found — graceful degradation
    win.webContents.send('ai:stream', {
      requestId,
      chunk: '[AI features require Claude Code CLI. Please ensure claude is installed and in your PATH.]',
      done: true,
      error: true,
    })
  })

  let buffer = ''

  child.stdout.on('data', (data: Buffer) => {
    buffer += data.toString()
    // Stream chunks progressively
    win.webContents.send('ai:stream', {
      requestId,
      chunk: data.toString(),
      done: false,
    })
  })

  child.stderr.on('data', (data: Buffer) => {
    console.warn('[lux/ai] stderr:', data.toString())
  })

  child.on('close', (code) => {
    win.webContents.send('ai:stream', {
      requestId,
      chunk: '',
      done: true,
      exitCode: code,
    })
  })
}

function buildPrompt(req: AIRequest): string {
  if (req.type === 'scoped_question') {
    const neighbors =
      req.neighborPassages && req.neighborPassages.length > 0
        ? `\n\nRelated passages for context:\n${req.neighborPassages.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}`
        : ''

    return `You are a reader's companion. Answer the following question based only on the passage provided. Do not expand beyond this passage unless specifically asked.

Passage:
"${req.passage}"${neighbors}

Question: ${req.question || 'What is the central claim of this passage?'}

Respond concisely and stay scoped to the passage.`
  }

  if (req.type === 'cross_tradition') {
    const traditions =
      req.traditions && req.traditions.length > 0
        ? `Focus on these traditions: ${req.traditions.join(', ')}.`
        : ''

    return `You are a comparative philosophy reader. Explain how the concept or term in the passage below is treated across different spiritual or philosophical traditions represented in the corpus. ${traditions}

Passage:
"${req.passage}"

Concept focus: ${req.conceptName || 'the main concept in this passage'}

For each tradition you identify, briefly state: (1) the tradition's name, (2) how it frames this concept, (3) any key term it uses. Do not rank traditions or suggest one is more relevant. Present each tradition equally.`
  }

  return `Please respond to this passage:\n\n"${req.passage}"`
}

export function checkClaudeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { stdio: 'ignore', shell: false })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}
