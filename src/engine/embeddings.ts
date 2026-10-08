import { pipeline, env, FeatureExtractionPipeline } from '@huggingface/transformers';
import { ChunkRecord } from '../types/corpus';

// Configure environment defaults for browser execution
if (env && env.backends && (env.backends as any).onnx) {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if ((env.backends as any).onnx?.wasm) {
    (env.backends as any).onnx.wasm.numThreads = 1;
  }
}

export interface EmbeddingModelOption {
  id: string;
  name: string;
  dimensions: number;
  sizeMB: number;
  description: string;
}

export const SUPPORTED_EMBEDDING_MODELS: EmbeddingModelOption[] = [
  {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'all-MiniLM-L6-v2 (Default)',
    dimensions: 384,
    sizeMB: 23,
    description: 'Fast, compact industry benchmark. 384-dim embeddings with low memory overhead.',
  },
  {
    id: 'Xenova/bge-small-en-v1.5',
    name: 'bge-small-en-v1.5',
    dimensions: 384,
    sizeMB: 33,
    description: 'BAAI flagship retrieval model. High semantic sensitivity and MTEB benchmark performance.',
  },
  {
    id: 'Xenova/paraphrase-MiniLM-L3-v2',
    name: 'paraphrase-MiniLM-L3-v2',
    dimensions: 384,
    sizeMB: 17,
    description: 'Ultra-lightweight 3-layer transformer. Extremely fast execution for low-power devices.',
  },
  {
    id: 'Xenova/all-mpnet-base-v2',
    name: 'all-mpnet-base-v2',
    dimensions: 768,
    sizeMB: 110,
    description: '768-dim high-capacity model. Deep semantic nuance at higher compute footprint.',
  },
];

export const DEFAULT_EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export type EmbeddingProgressCallback = (progress: { current: number; total: number }) => void;
export type TransformersProgressCallback = (progress: any) => void;

// Map of initialized pipelines per model ID
const pipelineInstances: Map<string, FeatureExtractionPipeline> = new Map();
const pipelineLoadingPromises: Map<string, Promise<FeatureExtractionPipeline>> = new Map();

/**
 * Lazily initializes and returns the specified embedding pipeline.
 */
export async function getEmbeddingPipeline(
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID,
  progressCallback?: TransformersProgressCallback
): Promise<FeatureExtractionPipeline> {
  if (pipelineInstances.has(modelId)) {
    return pipelineInstances.get(modelId)!;
  }

  if (pipelineLoadingPromises.has(modelId)) {
    return pipelineLoadingPromises.get(modelId)!;
  }

  const loadPromise = (async () => {
    try {
      const extractor = (await (pipeline as any)('feature-extraction', modelId, {
        quantized: true,
        progress_callback: progressCallback,
      })) as unknown as FeatureExtractionPipeline;

      pipelineInstances.set(modelId, extractor);
      return extractor;
    } catch (err) {
      pipelineLoadingPromises.delete(modelId);
      throw err;
    }
  })();

  pipelineLoadingPromises.set(modelId, loadPromise);
  return loadPromise;
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
 * Embeds a single query string, returning a normalized Float32Array.
 */
export async function embedQuery(
  query: string,
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID
): Promise<Float32Array> {
  const extractor = await getEmbeddingPipeline(modelId);
  const output: any = await (extractor as any)(query, { pooling: 'mean', normalize: true });
  const rawArray = Array.from(output.data as ArrayLike<number>);
  return normalizeVector(new Float32Array(rawArray));
}

/**
 * Embeds a list of text strings in sequential or batch mode, invoking progress callbacks.
 */
export async function embedTexts(
  texts: string[],
  onProgress?: EmbeddingProgressCallback,
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID
): Promise<Float32Array[]> {
  const extractor = await getEmbeddingPipeline(modelId);
  const results: Float32Array[] = [];
  const total = texts.length;

  for (let i = 0; i < total; i++) {
    const text = texts[i];
    const output: any = await (extractor as any)(text, { pooling: 'mean', normalize: true });
    const rawArray = Array.from(output.data as ArrayLike<number>);
    const normalized = normalizeVector(new Float32Array(rawArray));
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
  onProgress?: EmbeddingProgressCallback,
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID
): Promise<ChunkRecord[]> {
  const texts = chunks.map((c) => c.text);
  const total = texts.length;

  if (total === 0) return chunks;

  const embeddings = await embedTexts(texts, onProgress, modelId);
  for (let i = 0; i < total; i++) {
    chunks[i].vector = embeddings[i];
  }

  return chunks;
}
