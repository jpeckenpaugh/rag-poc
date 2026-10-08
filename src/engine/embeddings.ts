import { pipeline, env, FeatureExtractionPipeline, PipelineProgressCallback } from '@huggingface/transformers';
import { ChunkRecord } from '../types/corpus';

// Configure environment defaults for browser execution
if (env && env.backends && env.backends.onnx) {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads = 1;
}

export type EmbeddingProgressCallback = (progress: { current: number; total: number }) => void;

let pipelineInstance: FeatureExtractionPipeline | null = null;
let pipelineLoadingPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Lazily initializes and returns the Xenova/all-MiniLM-L6-v2 pipeline singleton.
 */
export async function getEmbeddingPipeline(
  progressCallback?: PipelineProgressCallback
): Promise<FeatureExtractionPipeline> {
  if (pipelineInstance) {
    return pipelineInstance;
  }

  if (pipelineLoadingPromise) {
    return pipelineLoadingPromise;
  }

  pipelineLoadingPromise = (async () => {
    try {
      const extractor = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
        progress_callback: progressCallback,
      })) as unknown as FeatureExtractionPipeline;

      pipelineInstance = extractor;
      return extractor;
    } catch (err) {
      pipelineLoadingPromise = null;
      throw err;
    }
  })();

  return pipelineLoadingPromise;
}

/**
 * Normalizes a Float32Array vector in-place (L2 norm = 1.0).
 */
export function normalizeVector(vector: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Embeds a single query string, returning a normalized 384-dimensional Float32Array.
 */
export async function embedQuery(query: string): Promise<Float32Array> {
  const extractor = await getEmbeddingPipeline();
  // Using mean pooling and requesting normalized output
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const data = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
  return normalizeVector(new Float32Array(data));
}

/**
 * Embeds a list of text strings in sequential or batch mode, invoking progress callbacks.
 */
export async function embedTexts(
  texts: string[],
  onProgress?: EmbeddingProgressCallback
): Promise<Float32Array[]> {
  const extractor = await getEmbeddingPipeline();
  const results: Float32Array[] = [];
  const total = texts.length;

  for (let i = 0; i < total; i++) {
    const text = texts[i];
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const rawData = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
    const normalized = normalizeVector(new Float32Array(rawData));
    results.push(normalized);

    if (onProgress) {
      onProgress({ current: i + 1, total });
    }
  }

  return results;
}

/**
 * Embeds an array of ChunkRecords, mutating each chunk to attach its Float32Array vector.
 */
export async function embedChunks(
  chunks: ChunkRecord[],
  onProgress?: EmbeddingProgressCallback
): Promise<ChunkRecord[]> {
  const texts = chunks.map((c) => c.text);
  const total = texts.length;

  if (total === 0) return chunks;

  const embeddings = await embedTexts(texts, onProgress);
  for (let i = 0; i < total; i++) {
    chunks[i].vector = embeddings[i];
  }

  return chunks;
}
