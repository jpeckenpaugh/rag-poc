import { ChunkRecord } from '../types/corpus';

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

// Web Worker Singleton management
let workerInstance: Worker | null = null;
let requestIdCounter = 0;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onProgress?: EmbeddingProgressCallback;
}

const pendingRequests: Map<string, PendingRequest> = new Map();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/embeddingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerInstance.onmessage = (e: MessageEvent) => {
      const { id, type, vector, vectors, current, total, error } = e.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;

      if (type === 'embed_progress') {
        if (pending.onProgress) {
          pending.onProgress({ current, total });
        }
      } else if (type === 'embed_query_result') {
        pendingRequests.delete(id);
        pending.resolve(vector);
      } else if (type === 'embed_chunks_result') {
        pendingRequests.delete(id);
        pending.resolve(vectors);
      } else if (type === 'error') {
        pendingRequests.delete(id);
        pending.reject(new Error(error || 'Worker embedding error'));
      }
    };

    workerInstance.onerror = (err) => {
      console.error('Embedding worker error:', err);
    };
  }

  return workerInstance;
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
 * Embeds a single query string via background Web Worker, returning a normalized Float32Array.
 */
export async function embedQuery(
  query: string,
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID
): Promise<Float32Array> {
  const worker = getWorker();
  const id = `req-${++requestIdCounter}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({
      id,
      type: 'embed_query',
      payload: { text: query, modelId },
    });
  });
}

/**
 * Embeds an array of ChunkRecords in background Web Worker, mutating each chunk with its vector.
 */
export async function embedChunks(
  chunks: ChunkRecord[],
  onProgress?: EmbeddingProgressCallback,
  modelId: string = DEFAULT_EMBEDDING_MODEL_ID
): Promise<ChunkRecord[]> {
  const texts = chunks.map((c) => c.text);
  const total = texts.length;

  if (total === 0) return chunks;

  const worker = getWorker();
  const id = `req-${++requestIdCounter}`;

  const vectors: Float32Array[] = await new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
    worker.postMessage({
      id,
      type: 'embed_chunks',
      payload: { texts, modelId },
    });
  });

  for (let i = 0; i < total; i++) {
    chunks[i].vector = vectors[i];
  }

  return chunks;
}
