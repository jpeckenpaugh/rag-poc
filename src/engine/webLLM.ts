import {
  CreateMLCEngine,
  type MLCEngine,
  type InitProgressReport,
  type InitProgressCallback,
} from '@mlc-ai/web-llm';
import { checkWebGPUSupport } from './gpuCheck';
import {
  assemblePrompt,
  formatRetrievalFallback,
  type RetrievedChunkMatch,
} from './promptAssembler';

export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export interface WebLLMClientState {
  isInitializing: boolean;
  isReady: boolean;
  error?: string;
  progressReport?: InitProgressReport;
  selectedModel: string;
}

export type ProgressListener = (report: InitProgressReport) => void;

export class WebLLMClient {
  private engine: MLCEngine | null = null;
  private modelId: string;
  private listeners: Set<ProgressListener> = new Set();
  private state: WebLLMClientState;
  private initPromise: Promise<MLCEngine> | null = null;

  constructor(modelId: string = DEFAULT_MODEL_ID) {
    this.modelId = modelId;
    this.state = {
      isInitializing: false,
      isReady: false,
      selectedModel: modelId,
    };
  }

  public getState(): WebLLMClientState {
    return { ...this.state };
  }

  public onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    if (this.state.progressReport) {
      listener(this.state.progressReport);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyProgress(report: InitProgressReport) {
    this.state.progressReport = report;
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch (err) {
        console.error('Error in WebLLM progress listener:', err);
      }
    }
  }

  /**
   * Initializes the MLC Engine with download & cache progress tracking.
   */
  public async initialize(customProgressCallback?: InitProgressCallback): Promise<MLCEngine> {
    if (this.engine) {
      return this.engine;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.state.isInitializing = true;
    this.state.error = undefined;

    const gpuSupport = await checkWebGPUSupport();
    if (!gpuSupport.supported) {
      const err = new Error(gpuSupport.reason || 'WebGPU is not supported in this browser.');
      this.state.isInitializing = false;
      this.state.error = err.message;
      throw err;
    }

    this.initPromise = (async () => {
      try {
        const engine = await CreateMLCEngine(this.modelId, {
          initProgressCallback: (report: InitProgressReport) => {
            this.notifyProgress(report);
            if (customProgressCallback) {
              customProgressCallback(report);
            }
          },
        });
        this.engine = engine;
        this.state.isInitializing = false;
        this.state.isReady = true;
        this.state.error = undefined;
        this.notifyProgress({
          progress: 1.0,
          timeElapsed: 0,
          text: 'Model engine ready in WebGPU',
        });
        return engine;
      } catch (error) {
        this.state.isInitializing = false;
        this.state.isReady = false;
        const msg = error instanceof Error ? error.message : String(error);
        this.state.error = msg;
        this.initPromise = null;
        this.notifyProgress({
          progress: 0,
          timeElapsed: 0,
          text: `Engine error: ${msg}`,
        });
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Streams generation from the active WebLLM instance token-by-token.
   */
  public async generateAnswerStream(
    assembled: { systemPrompt: string; userPrompt: string },
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.engine) {
      await this.initialize();
    }

    if (!this.engine) {
      throw new Error('WebLLM engine could not be initialized.');
    }

    const messages = [
      { role: 'system' as const, content: assembled.systemPrompt },
      { role: 'user' as const, content: assembled.userPrompt },
    ];

    const asyncChunks = await this.engine.chatCompletion({
      stream: true,
      messages,
      temperature: 0.1, // Low temperature for factual grounding
      max_tokens: 512,
    });

    let fullAnswer = '';

    for await (const chunk of asyncChunks) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullAnswer += delta;
        if (onToken) {
          onToken(delta);
        }
      }
    }

    return fullAnswer;
  }

  /**
   * Full end-to-end RAG answering pipeline with automatic fallback handling.
   * If WebGPU is not supported or initialization fails, generates a structured retrieval fallback.
   */
  public async answerQuery(
    query: string,
    retrievedChunks: RetrievedChunkMatch[],
    onToken?: (token: string) => void,
    similarityThreshold = 0.10
  ): Promise<{ text: string; mode: 'llm' | 'retrieval-fallback'; citations: RetrievedChunkMatch[] }> {
    const assembled = assemblePrompt(query, retrievedChunks, { similarityThreshold });

    // If context is completely missing, return direct anti-hallucination refusal without calling LLM
    if (!assembled.hasRelevantContext) {
      const refusal = 'I cannot find this information in the provided documentation.';
      if (onToken) onToken(refusal);
      return {
        text: refusal,
        mode: 'llm',
        citations: [],
      };
    }

    // Check WebGPU availability before attempting LLM run
    const gpuSupport = await checkWebGPUSupport();
    if (!gpuSupport.supported) {
      const fallback = formatRetrievalFallback(query, retrievedChunks, gpuSupport.reason);
      if (onToken) onToken(fallback);
      return {
        text: fallback,
        mode: 'retrieval-fallback',
        citations: assembled.includedChunks,
      };
    }

    try {
      const answer = await this.generateAnswerStream(assembled, onToken);
      return {
        text: answer,
        mode: 'llm',
        citations: assembled.includedChunks,
      };
    } catch (err) {
      console.warn('WebLLM generation failed, falling back to semantic retrieval view:', err);
      const reason = err instanceof Error ? err.message : String(err);
      const fallback = formatRetrievalFallback(query, retrievedChunks, reason);
      if (onToken) onToken(fallback);
      return {
        text: fallback,
        mode: 'retrieval-fallback',
        citations: assembled.includedChunks,
      };
    }
  }
}

// Singleton helper instance for convenient app-wide use
let clientSingleton: WebLLMClient | null = null;

export function getWebLLMClient(modelId?: string): WebLLMClient {
  if (!clientSingleton) {
    clientSingleton = new WebLLMClient(modelId);
  }
  return clientSingleton;
}
