import { ChunkRecord } from '../types/corpus';

export interface SearchResult {
  chunk: ChunkRecord;
  score: number;
}

export interface VectorStoreStats {
  chunkCount: number;
  documentsIndexed: number;
  vectorDimensions: number;
  estimatedMemoryBytes: number;
}

/**
 * Computes cosine similarity between two vectors.
 * Since embeddings produced by our pipeline are unit-normalized (L2 norm = 1.0),
 * cosine similarity is equivalent to the dot product:
 * dot(a, b) = sum_i(a[i] * b[i])
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: vector a has ${a.length} dims, vector b has ${b.length} dims.`);
  }

  let dotProduct = 0;
  // Loop unrolling for 384 dimensions can be used, standard loop is fast in V8
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  return dotProduct;
}

/**
 * In-memory vector store that stores ChunkRecords in a JS array
 * and performs linear scan O(N) dot product search for Top-K retrieval.
 */
export class InMemoryVectorStore {
  private chunks: ChunkRecord[] = [];

  constructor(initialChunks: ChunkRecord[] = []) {
    this.chunks = [...initialChunks];
  }

  /**
   * Adds chunks to the vector store.
   */
  public addChunks(newChunks: ChunkRecord[]): void {
    this.chunks.push(...newChunks);
  }

  /**
   * Sets or replaces all chunks in the store.
   */
  public setChunks(chunks: ChunkRecord[]): void {
    this.chunks = [...chunks];
  }

  /**
   * Retrieves all stored chunks.
   */
  public getChunks(): ChunkRecord[] {
    return this.chunks;
  }

  /**
   * Returns the count of chunks currently stored.
   */
  public count(): number {
    return this.chunks.length;
  }

  /**
   * Clears all stored chunks.
   */
  public clear(): void {
    this.chunks = [];
  }

  /**
   * Searches the store for the Top-K most similar chunks to queryVector.
   * Chunks with similarity score strictly below threshold are excluded.
   *
   * @param queryVector - Normalized Float32Array query embedding (384 dims)
   * @param topK - Maximum number of results to return (default: 5)
   * @param threshold - Minimum similarity score threshold (default: 0.25)
   */
  public search(
    queryVector: Float32Array,
    topK = 5,
    threshold = 0.25
  ): SearchResult[] {
    const scored: SearchResult[] = [];

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (!chunk.vector) {
        continue;
      }

      const score = cosineSimilarity(queryVector, chunk.vector);
      if (score >= threshold) {
        scored.push({ chunk, score });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  /**
   * Returns memory and indexing statistics for inspectability and DevTools.
   */
  public getStats(): VectorStoreStats {
    let vectorDims = 0;
    let vectorMemoryBytes = 0;
    const docIds = new Set<string>();

    for (const chunk of this.chunks) {
      docIds.add(chunk.docId);
      if (chunk.vector) {
        vectorDims = chunk.vector.length;
        vectorMemoryBytes += chunk.vector.byteLength;
      }
      // Estimate chunk text and string metadata overhead (approx 2 bytes per JS char)
      vectorMemoryBytes += (chunk.text.length + chunk.title.length + chunk.source.length) * 2;
    }

    return {
      chunkCount: this.chunks.length,
      documentsIndexed: docIds.size,
      vectorDimensions: vectorDims,
      estimatedMemoryBytes: vectorMemoryBytes,
    };
  }
}
