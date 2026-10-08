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
 * - Clear context snippets with [Source: filename, Page: X, Document: docId]
 * - Strict refusal when context is missing or irrelevant
 * - Negative query defense
 */
export function assemblePrompt(
  query: string,
  retrievedChunks: RetrievedChunkMatch[],
  options: PromptAssemblyOptions = {}
): AssembledPrompt {
  const threshold = options.similarityThreshold ?? 0.15;
  const filteredChunks = retrievedChunks.filter((item) => item.score >= threshold);

  const hasRelevantContext = filteredChunks.length > 0;

  const systemPrompt = [
    'You are a helpful and accurate assistant for Northstar Urgent Care Cooperative.',
    'Carefully read the provided context snippets below and use them to directly answer the user question.',
    'Always cite your sources using [Source: <filename>, Page: <page>] format.',
    `Only if the provided context snippets do NOT contain the answer, reply: "${STRICT_REFUSAL_MESSAGE}"`,
    'Be concise, direct, and factual.'
  ].join(' ');

  let contextSnippetBlock = '';
  if (hasRelevantContext) {
    const snippets = filteredChunks.map(({ chunk }, index) => {
      return `[Context Snippet ${index + 1} - Source: ${chunk.source}, Page: ${chunk.page}]\n${chunk.text.trim()}`;
    });
    contextSnippetBlock = `Context Information:\n${snippets.join('\n\n')}`;
  } else {
    contextSnippetBlock = 'Context Information:\n(No relevant documents found)';
  }

  const userPrompt = `${contextSnippetBlock}\n\nQuestion: ${query.trim()}\n\nBased on the context above, provide a direct answer with citations:`;

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
