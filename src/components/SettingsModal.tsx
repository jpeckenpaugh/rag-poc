import {
  X,
  Sliders,
  Cpu,
  Layers,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { SUPPORTED_LLM_MODELS, LLMModelOption } from '../engine/webLLM';
import { SUPPORTED_EMBEDDING_MODELS, EmbeddingModelOption } from '../engine/embeddings';

export interface RAGConfig {
  llmModelId: string;
  embeddingModelId: string;
  windowSize: number;
  overlap: number;
  topK: number;
  similarityThreshold: number;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RAGConfig;
  onUpdateConfig: (newConfig: Partial<RAGConfig>) => void;
  onReindexCorpus: () => void;
  onSwitchLLM: (modelId: string) => void;
  isReindexing: boolean;
  llmState: {
    isInitializing: boolean;
    isReady: boolean;
    selectedModel: string;
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onReindexCorpus,
  onSwitchLLM,
  isReindexing,
  llmState,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-750 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800/80 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">RAG Pipeline & Model Settings</h2>
              <p className="text-xs text-slate-400">
                Configure in-browser LLM generators, ONNX embeddings, and chunk parameters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Section 1: WebGPU LLM Generator */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400" />
                WebGPU Local LLM Generator ({SUPPORTED_LLM_MODELS.length} Available)
              </label>
              {llmState.isReady && (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Model Ready in VRAM
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUPPORTED_LLM_MODELS.map((m: LLMModelOption) => {
                const isSelected = config.llmModelId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onUpdateConfig({ llmModelId: m.id });
                      onSwitchLLM(m.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white truncate max-w-[170px]">
                          {m.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-750">
                          {m.parameters}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {m.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>VRAM: ~{m.vramRequiredMB} MB</span>
                      {isSelected ? (
                        <span className="text-indigo-400 font-bold font-sans">Active</span>
                      ) : (
                        <span className="text-slate-500 hover:text-slate-300 font-sans">Switch</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Embedding Model Selection */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                ONNX In-Browser Embedding Model
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                Transformers.js / WASM
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUPPORTED_EMBEDDING_MODELS.map((em: EmbeddingModelOption) => {
                const isSelected = config.embeddingModelId === em.id;
                return (
                  <button
                    key={em.id}
                    onClick={() => onUpdateConfig({ embeddingModelId: em.id })}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white truncate max-w-[170px]">
                          {em.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-750">
                          {em.dimensions}d
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {em.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Size: ~{em.sizeMB} MB</span>
                      {isSelected ? (
                        <span className="text-indigo-400 font-bold font-sans">Selected</span>
                      ) : (
                        <span className="text-slate-500 font-sans">Select</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Sliding Window Chunking Parameters */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Chunking & Search Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Window Size */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Window Size (Chars)</span>
                  <span className="font-mono text-indigo-400 font-bold">{config.windowSize} ch</span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="1200"
                  step="50"
                  value={config.windowSize}
                  onChange={(e) => onUpdateConfig({ windowSize: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Target character slice per chunk (~100 to 250 tokens).
                </p>
              </div>

              {/* Overlap */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Window Overlap (Chars)</span>
                  <span className="font-mono text-indigo-400 font-bold">{config.overlap} ch</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="25"
                  value={config.overlap}
                  onChange={(e) => onUpdateConfig({ overlap: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Sliding overlap between consecutive chunks to preserve sentence continuity.
                </p>
              </div>

              {/* Top-K Chunks */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Top-K Retrieved Chunks</span>
                  <span className="font-mono text-indigo-400 font-bold">Top {config.topK}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={config.topK}
                  onChange={(e) => onUpdateConfig({ topK: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Maximum candidate chunks included in prompt context.
                </p>
              </div>

              {/* Similarity Threshold */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Similarity Cutoff</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {(config.similarityThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.4"
                  step="0.05"
                  value={config.similarityThreshold}
                  onChange={(e) =>
                    onUpdateConfig({ similarityThreshold: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Minimum cosine similarity score required for prompt context inclusion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-[11px]">
              Changing chunk parameters or embedding model requires re-indexing the corpus.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onReindexCorpus}
              disabled={isReindexing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/60 text-white font-semibold text-xs shadow-md transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
              <span>{isReindexing ? 'Re-Indexing Corpus...' : 'Re-Index Corpus'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
