import { app } from 'electron'
import path from 'path'

let pipeline: ((texts: string | string[], options?: Record<string, unknown>) => Promise<{ data: Float32Array[] }>) | null = null
let loading = false

export async function getEmbeddingPipeline(): Promise<typeof pipeline> {
  if (pipeline) return pipeline
  if (loading) {
    // Wait for loading to complete
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!loading) { clearInterval(check); resolve() }
      }, 100)
    })
    return pipeline
  }

  loading = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pipeline: createPipeline, env } = require('@xenova/transformers')
    const modelsDir = path.join(app.getPath('userData'), 'lux', 'models')
    env.cacheDir = modelsDir
    env.allowRemoteModels = true

    pipeline = await createPipeline('feature-extraction', 'nomic-ai/nomic-embed-text-v1.5', {
      quantized: true,
    })
    console.log('[lux] Embedding model loaded')
  } catch (err) {
    console.warn('[lux] Failed to load embedding model:', err)
    pipeline = null
  } finally {
    loading = false
  }
  return pipeline
}

export async function embed(text: string): Promise<number[] | null> {
  const pipe = await getEmbeddingPipeline()
  if (!pipe) return null
  try {
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data[0])
  } catch (err) {
    console.warn('[lux] Embed error:', err)
    return null
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const pipe = await getEmbeddingPipeline()
  if (!pipe) return texts.map(() => null)
  try {
    const output = await pipe(texts, { pooling: 'mean', normalize: true })
    const results: number[][] = []
    const dim = output.data.length / texts.length
    for (let i = 0; i < texts.length; i++) {
      results.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)))
    }
    return results
  } catch (err) {
    console.warn('[lux] Batch embed error:', err)
    return texts.map(() => null)
  }
}
