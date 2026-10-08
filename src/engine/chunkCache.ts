import { ChunkRecord } from '../types/corpus';

const DB_NAME = 'northstar_rag_db';
const STORE_NAME = 'corpus_chunks';
const DB_VERSION = 1;
const CACHE_METADATA_KEY = 'corpus_cache_meta';

interface SerializedChunkRecord {
  id: string;
  source: string;
  docId: string;
  title: string;
  status: string;
  page: number;
  text: string;
  vector: number[]; // Array representation for safe IndexedDB serialization
}

export interface CacheMetadata {
  savedAt: number;
  chunkCount: number;
  documentCount: number;
  model: string;
  windowSize: number;
  overlap: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves embedded chunks to browser IndexedDB for instant retrieval across sessions.
 */
export async function saveChunksToCache(
  chunks: ChunkRecord[],
  modelName: string = 'all-MiniLM-L6-v2',
  windowSize: number = 500,
  overlap: number = 100
): Promise<void> {
  if (!chunks || chunks.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing records before saving new dataset
    store.clear();

    for (const chunk of chunks) {
      const serialized: SerializedChunkRecord = {
        id: chunk.id,
        source: chunk.source,
        docId: chunk.docId,
        title: chunk.title,
        status: chunk.status,
        page: chunk.page,
        text: chunk.text,
        vector: chunk.vector ? Array.from(chunk.vector) : [],
      };
      store.put(serialized);
    }

    tx.oncomplete = () => {
      const uniqueDocs = new Set(chunks.map((c) => c.docId)).size;
      const meta: CacheMetadata = {
        savedAt: Date.now(),
        chunkCount: chunks.length,
        documentCount: uniqueDocs,
        model: modelName,
        windowSize,
        overlap,
      };
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(meta));
      resolve();
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Restores embedded chunks from browser IndexedDB.
 */
export async function loadChunksFromCache(
  expectedModel?: string,
  expectedWindowSize?: number,
  expectedOverlap?: number
): Promise<ChunkRecord[] | null> {
  try {
    const meta = getCacheMetadata();
    if (!meta || meta.chunkCount === 0) return null;

    // Verify cache matches requested configuration
    if (expectedModel && meta.model !== expectedModel) {
      return null;
    }
    if (expectedWindowSize && meta.windowSize !== expectedWindowSize) {
      return null;
    }
    if (expectedOverlap && meta.overlap !== expectedOverlap) {
      return null;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawList: SerializedChunkRecord[] = request.result;
        if (!rawList || rawList.length === 0) {
          resolve(null);
          return;
        }

        const reconstructed: ChunkRecord[] = rawList.map((item) => ({
          id: item.id,
          source: item.source,
          docId: item.docId,
          title: item.title,
          status: item.status,
          page: item.page,
          text: item.text,
          vector: new Float32Array(item.vector),
        }));

        resolve(reconstructed);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB cache:', err);
    return null;
  }
}

/**
 * Retrieves cache metadata from localStorage.
 */
export function getCacheMetadata(): CacheMetadata | null {
  try {
    const raw = localStorage.getItem(CACHE_METADATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the chunk cache from IndexedDB and localStorage.
 */
export async function clearChunkCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.removeItem(CACHE_METADATA_KEY);
  } catch (e) {
    console.warn('Failed to clear chunk cache:', e);
  }
}
