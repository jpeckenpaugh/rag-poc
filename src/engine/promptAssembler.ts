import type { ChunkRecord } from '../types/corpus';

export interface RetrievedChunkMatch {
  chunk: ChunkRecord;
  score: number;
}

export interface PromptAssemblyOptions {
  /**
   * Minimum similarity score threshold for chunks to be considered relevant.
   * If not provided, defaults to 0.15.
   */
  similarityThreshold?: number;
}

export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
  includedChunks: RetrievedChunkMatch[];
  hasRelevantContext: boolean;
}

export const STRICT_REFUSAL_MESSAGE =
  'I cannot find this information in the provided documentation.';

/**
 * Constructs strict anti-hallucination prompts matching concept.md specifications:
 * - Clear context snippets with document metadata
 * - Strict refusal when context is missing or irrelevant
 * - Formatted cleanly for small 1B instruction models to prevent header regurgitation
 */
export function assemblePrompt(
  query: string,
  retrievedChunks: RetrievedChunkMatch[],
  options: PromptAssemblyOptions = {}
): AssembledPrompt {
  const threshold = options.similarityThreshold ?? 0.05;
  const filteredChunks = retrievedChunks.filter((item) => item.score >= threshold);

  const hasRelevantContext = filteredChunks.length > 0;

  const systemPrompt = [
    'You are the Northstar Urgent Care Cooperative operational assistant.',
    'Answer the user question factually and directly using ONLY the operational documentation excerpts provided below.',
    'Do not assume, invent, or extrapolate information outside the excerpts.',
    'If the excerpts do not contain the specific facts needed to answer the question, state: "I cannot find this information in the provided documentation."',
    'Keep your answer clear, direct, and reference the source document (e.g. NU-OPS-XXX) when stating facts.',
    'Do not repeat the context excerpts or headers in your answer.'
  ].join(' ');

  let contextSnippetBlock = '';
  if (hasRelevantContext) {
    const snippets = filteredChunks.map(({ chunk }, index) => {
      // Strip redundant internal prefix from chunk text if already present
      let cleanText = chunk.text.trim();
      const prefixMatch = cleanText.match(/^\[Document:[^\]]+\]\s*/);
      if (prefixMatch) {
        cleanText = cleanText.slice(prefixMatch[0].length).trim();
      }
      return `--- Excerpt ${index + 1} (${chunk.docId} - ${chunk.title}, Page ${chunk.page}) ---\n${cleanText}`;
    });
    contextSnippetBlock = `OPERATIONAL EXCERPTS:\n${snippets.join('\n\n')}`;
  } else {
    contextSnippetBlock = 'OPERATIONAL EXCERPTS:\n(No relevant documents found in index)';
  }

  const userPrompt = `${contextSnippetBlock}\n\nQUESTION: ${query.trim()}\n\nProvide a direct, factual answer based strictly on the excerpts above:`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    fullPrompt,
    includedChunks: filteredChunks,
    hasRelevantContext,
  };
}

/**
 * Formats a clean retrieval-only fallback response when WebGPU is unavailable or generation is bypassed.
 * Synthesizes top citations, scores, and excerpt snippets directly.
 */
export function formatRetrievalFallback(
  query: string,
  retrievedChunks: RetrievedChunkMatch[],
  reason?: string
): string {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return [
      '### Semantic Retrieval Mode (No Local LLM Active)',
      reason ? `*Reason: ${reason}*` : '',
      '',
      STRICT_REFUSAL_MESSAGE,
    ].filter(Boolean).join('\n\n');
  }

  const lines: string[] = [
    '### Semantic Retrieval Mode (WebGPU Generation Unavailable)',
    reason ? `*Note: ${reason}*` : '',
    '',
    `Query: **"${query}"**`,
    '',
    'Here are the most relevant document snippets identified by in-browser semantic vector search:',
    '',
  ];

  retrievedChunks.forEach(({ chunk, score }, idx) => {
    const percent = (score * 100).toFixed(1);
    lines.push(
      `#### ${idx + 1}. [Source: ${chunk.source}, Page: ${chunk.page}] (Similarity: ${percent}%, Doc: ${chunk.docId})`
    );
    lines.push(`> ${chunk.text.replace(/\n+/g, ' ').trim()}`);
    lines.push('');
  });

  lines.push('---');
  lines.push(
    `*Note: LLM in-browser generation was not executed. Review the raw grounded citations above.*`
  );

  return lines.join('\n');
}
