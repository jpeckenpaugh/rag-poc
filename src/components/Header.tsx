import React from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Download,
  CheckCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { GPUSupportResult } from '../engine/gpuCheck';
import type { VectorStoreStats } from '../engine/vectorStore';
import type { InitProgressReport } from '@mlc-ai/web-llm';

export interface HeaderProps {
  gpuStatus: GPUSupportResult | null;
  checkingGPU: boolean;
  storeStats: VectorStoreStats;
  isCorpusLoading: boolean;
  corpusLoadStage: string;
  corpusProgress: { current: number; total: number };
  llmState: {
    isInitializing: boolean;
    isReady: boolean;
    error?: string;
    progressReport?: InitProgressReport;
    selectedModel: string;
  };
  onLoadCorpus: () => void;
  onUploadCustomFile: (file: File) => void;
  onInitializeLLM: () => void;
  onOpenDevTools: (tab?: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const Header: React.FC<HeaderProps> = ({
  gpuStatus,
  checkingGPU,
  storeStats,
  isCorpusLoading,
  corpusLoadStage,
  corpusProgress,
  llmState,
  onLoadCorpus,
  onUploadCustomFile,
  onInitializeLLM,
  onOpenDevTools,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCustomFile(file);
      e.target.value = '';
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title and Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Northstar In-Browser RAG
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                  Zero-Backend
                </span>
              </div>
              <p className="text-xs text-slate-400">
                100% Client-Side In-Memory MiniLM-L6-v2 + WebGPU Llama-3.2
              </p>
            </div>
          </div>

          {/* Status Badges & Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* WebGPU Status Badge */}
            <button
              onClick={() => onOpenDevTools('diagnostics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                checkingGPU
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : gpuStatus?.supported
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800 hover:bg-amber-900/40'
              }`}
              title={
                gpuStatus?.supported
                  ? `WebGPU Active: ${gpuStatus.adapterName || 'Hardware Accelerated'}`
                  : `WebGPU Fallback Mode: ${gpuStatus?.reason || 'CPU Vector Only'}`
              }
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>
                {checkingGPU
                  ? 'Checking GPU...'
                  : gpuStatus?.supported
                  ? 'WebGPU Active'
                  : 'Retrieval Only (CPU)'}
              </span>
            </button>

            {/* In-Memory Corpus Status */}
            <button
              onClick={() => onOpenDevTools('chunks')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition"
              title="Click to view all chunks in DevTools"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {storeStats.chunkCount > 0
                  ? `${storeStats.documentsIndexed} docs · ${storeStats.chunkCount} chunks`
                  : 'No chunks loaded'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-750">
                {formatBytes(storeStats.estimatedMemoryBytes)}
              </span>
            </button>

            {/* Load Northstar Corpus Button */}
            <button
              onClick={onLoadCorpus}
              disabled={isCorpusLoading}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow transition ${
                isCorpusLoading
                  ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700 cursor-wait'
                  : storeStats.chunkCount > 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              <Download
                className={`w-3.5 h-3.5 ${isCorpusLoading ? 'animate-bounce text-indigo-400' : ''}`}
              />
              <span>
                {isCorpusLoading
                  ? 'Indexing Corpus...'
                  : storeStats.chunkCount > 0
                  ? 'Reload 21 PDFs'
                  : 'Load Northstar Corpus'}
              </span>
            </button>

            {/* Custom PDF Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700 text-xs font-medium text-slate-300 transition"
              title="Drop or upload a custom PDF into in-memory store"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Add PDF</span>
            </button>

            {/* WebLLM Engine Status / Pre-download trigger */}
            {gpuStatus?.supported && (
              <button
                onClick={onInitializeLLM}
                disabled={llmState.isInitializing || llmState.isReady}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  llmState.isReady
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                    : llmState.isInitializing
                    ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800 cursor-wait'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
                title="Initialize WebGPU Llama-3.2 local model weights"
              >
                {llmState.isReady ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : llmState.isInitializing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {llmState.isReady
                    ? 'Llama-3.2 Ready'
                    : llmState.isInitializing
                    ? 'Downloading Weights...'
                    : 'Warmup LLM'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Ingestion / Loading Progress Bar */}
        {isCorpusLoading && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 animate-fadeIn">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                {corpusLoadStage || 'Processing documents...'}
              </span>
              <span className="font-mono text-indigo-400 text-xs">
                {corpusProgress.total > 0
                  ? `${corpusProgress.current} / ${corpusProgress.total} (${Math.round(
                      (corpusProgress.current / corpusProgress.total) * 100
                    )}%)`
                  : 'Preparing pipeline...'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
              <div
                className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    corpusProgress.total > 0
                      ? Math.min(100, (corpusProgress.current / corpusProgress.total) * 100)
                      : 8
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* WebLLM Weights Download Progress Bar */}
        {llmState.isInitializing && llmState.progressReport && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 animate-fadeIn">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-cyan-300 font-medium flex items-center gap-1.5 truncate max-w-xl">
                <Download className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                {llmState.progressReport.text || 'Fetching model cache...'}
              </span>
              <span className="font-mono text-cyan-400 text-xs">
                {Math.round((llmState.progressReport.progress || 0) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: `${Math.round((llmState.progressReport.progress || 0) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
