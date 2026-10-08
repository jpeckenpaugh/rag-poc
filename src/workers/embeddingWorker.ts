import { pipeline, env, FeatureExtractionPipeline } from '@huggingface/transformers';

// Configure environment defaults for worker execution
if (env && env.backends && (env.backends as any).onnx) {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if ((env.backends as any).onnx?.wasm) {
    (env.backends as any).onnx.wasm.numThreads = 1;
  }
}

const pipelineInstances: Map<string, FeatureExtractionPipeline> = new Map();
const pipelineLoadingPromises: Map<string, Promise<FeatureExtractionPipeline>> = new Map();

async function getPipeline(modelId: string): Promise<FeatureExtractionPipeline> {
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

function normalizeVector(vector: Float32Array): Float32Array {
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

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    if (type === 'embed_query') {
      const { text, modelId } = payload;
      const extractor = await getPipeline(modelId);
      const output: any = await (extractor as any)(text, { pooling: 'mean', normalize: true });
      const rawArray = Array.from(output.data as ArrayLike<number>);
      const vector = normalizeVector(new Float32Array(rawArray));

      self.postMessage({
        id,
        type: 'embed_query_result',
        vector,
      });
    } else if (type === 'embed_chunks') {
      const { texts, modelId } = payload;
      const extractor = await getPipeline(modelId);
      const total = texts.length;
      const vectors: Float32Array[] = [];

      for (let i = 0; i < total; i++) {
        const text = texts[i];
        const output: any = await (extractor as any)(text, { pooling: 'mean', normalize: true });
        const rawArray = Array.from(output.data as ArrayLike<number>);
        const vector = normalizeVector(new Float32Array(rawArray));
        vectors.push(vector);

        // Report progress to main thread every chunk or batch
        self.postMessage({
          id,
          type: 'embed_progress',
          current: i + 1,
          total,
        });

        // Yield execution momentarily to allow worker message loop to breathe
        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      self.postMessage({
        id,
        type: 'embed_chunks_result',
        vectors,
      });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
