import type { ChunkRecord, ExtractedDocument } from '../types/corpus';

export type { ChunkRecord };

export interface ChunkingOptions {
  windowSize?: number; // Target window size (chars), default 500
  overlap?: number;    // Window overlap (chars), default 100
  minThreshold?: number; // Minimum characters to keep chunk, default 60
}

/**
 * Splits extracted document pages into sliding-window text chunks.
 *
 * Rules:
 * - 500-char sliding window with 100-char overlap.
 * - Discards chunks < 60 characters.
 * - Prepends context prefix:
 *   `[Document: ${docId} - ${title} | Page: ${page} | Status: ${status}]\n${chunkText}`
 *   so embedding captures document identity and metadata.
 */
export function chunkDocument(
  doc: ExtractedDocument,
  options?: ChunkingOptions
): ChunkRecord[] {
  const windowSize = options?.windowSize ?? 500;
  const overlap = options?.overlap ?? 100;
  const minThreshold = options?.minThreshold ?? 60;
  const step = Math.max(1, windowSize - overlap);

  const chunks: ChunkRecord[] = [];
  let chunkIndex = 0;

  for (const page of doc.pages) {
    const rawText = page.text.trim();
    if (!rawText || rawText.length < minThreshold) {
      // If the entire page has fewer than minThreshold chars, skip unless it's the only content
      continue;
    }

    // Slide window across the page text
    for (let start = 0; start < rawText.length; start += step) {
      const end = Math.min(start + windowSize, rawText.length);
      const rawChunkText = rawText.slice(start, end).trim();

      if (rawChunkText.length < minThreshold) {
        continue;
      }

      chunkIndex++;
      const prefix = `[Document: ${doc.docId} - ${doc.title} | Page: ${page.pageNumber} | Status: ${doc.status}]`;
      const fullText = `${prefix}\n${rawChunkText}`;

      chunks.push({
        id: `${doc.docId}-p${page.pageNumber}-c${chunkIndex}`,
        source: doc.filename,
        docId: doc.docId,
        title: doc.title,
        status: doc.status,
        page: page.pageNumber,
        text: fullText,
      });

      if (end >= rawText.length) {
        break;
      }
    }
  }

  return chunks;
}

/**
 * Chunks multiple documents into a single flat array of ChunkRecords.
 */
export function chunkDocuments(
  docs: ExtractedDocument[],
  options?: ChunkingOptions
): ChunkRecord[] {
  const allChunks: ChunkRecord[] = [];
  for (const doc of docs) {
    const docChunks = chunkDocument(doc, options);
    allChunks.push(...docChunks);
  }
  return allChunks;
}
