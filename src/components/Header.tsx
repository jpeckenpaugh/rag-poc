import React from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Download,
  CheckCircle,
  RefreshCw,
  Upload,
  MessageSquare,
  FileText,
  Terminal,
  Info,
  Sliders,
} from 'lucide-react';
import type { GPUSupportResult } from '../engine/gpuCheck';
import type { VectorStoreStats } from '../engine/vectorStore';
import type { InitProgressReport } from '@mlc-ai/web-llm';

export type AppViewMode = 'chat' | 'documents' | 'devtools' | 'about';

export interface HeaderProps {
  currentView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
  gpuStatus: GPUSupportResult | null;
  checkingGPU: boolean;
  storeStats: VectorStoreStats;
  isCorpusLoading: boolean;
  corpusLoadStage: string;
  corpusProgress: { current: number; total: number };
  hasCachedCorpus: boolean;
  llmState: {
    isInitializing: boolean;
    isReady: boolean;
    error?: string;
    progressReport?: InitProgressReport;
    selectedModel: string;
  };
  onLoadCorpus: (forceRegenerate?: boolean) => void;
  onUploadCustomFile: (file: File) => void;
  onInitializeLLM: () => void;
  onOpenSettings: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  gpuStatus,
  checkingGPU,
  storeStats,
  isCorpusLoading,
  corpusLoadStage,
  corpusProgress,
  hasCachedCorpus,
  llmState,
  onLoadCorpus,
  onUploadCustomFile,
  onInitializeLLM,
  onOpenSettings,
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
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* 1. Title and Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-lg">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  Northstar RAG
                </h1>
                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                  Client-Side
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                In-Memory ONNX MiniLM-L6-v2 · WebGPU Llama-3.2
              </p>
            </div>
          </div>

          {/* 2. Primary Navigation Tabs (View Switcher) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner self-start md:self-center overflow-x-auto max-w-full">
            <button
              onClick={() => onViewChange('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                currentView === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Assistant & Chat</span>
            </button>

            <button
              onClick={() => onViewChange('documents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                currentView === 'documents'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Documents</span>
            </button>

            <button
              onClick={() => onViewChange('devtools')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                currentView === 'devtools'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>DevTools</span>
            </button>

            <button
              onClick={() => onViewChange('about')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                currentView === 'about'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Architecture & About</span>
            </button>
          </div>

          {/* 3. Essential Status & Corpus Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Settings & Model Swap Button */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition cursor-pointer"
              title="Configure LLM model, embedding model, and chunk parameters"
            >
              <Sliders className="w-3 h-3 text-indigo-400" />
              <span>Settings</span>
            </button>

            {/* WebGPU Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                checkingGPU
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : gpuStatus?.supported
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}
              title={
                gpuStatus?.supported
                  ? `WebGPU Active: ${gpuStatus.adapterName || 'Hardware Accelerated'}`
                  : `CPU Vector Only: ${gpuStatus?.reason || 'No WebGPU'}`
              }
            >
              <Cpu className="w-3 h-3" />
              <span className="hidden sm:inline">
                {checkingGPU
                  ? 'Checking GPU...'
                  : gpuStatus?.supported
                  ? 'WebGPU Active'
                  : 'CPU Retrieval'}
              </span>
            </div>

            {/* In-Memory Heap Counter */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] font-medium text-slate-300"
              title="Current in-memory chunks and estimated JS heap footprint"
            >
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>{storeStats.chunkCount} chunks</span>
              {storeStats.estimatedMemoryBytes > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  ({formatBytes(storeStats.estimatedMemoryBytes)})
                </span>
              )}
            </div>

            {/* Load / Cache Action Button */}
            {storeStats.chunkCount === 0 ? (
              hasCachedCorpus ? (
                <div className="flex items-center rounded-lg border border-indigo-700 bg-indigo-950/70 p-0.5 shadow">
                  <button
                    onClick={() => onLoadCorpus(false)}
                    disabled={isCorpusLoading}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow cursor-pointer"
                    title="Instantly restore indexed embeddings from browser cache"
                  >
                    <Download className="w-3 h-3" />
                    <span>Load Cache</span>
                  </button>
                  <button
                    onClick={() => onLoadCorpus(true)}
                    disabled={isCorpusLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-indigo-300 hover:text-white hover:bg-indigo-800/60 transition cursor-pointer"
                    title="Re-extract and re-embed all 21 PDFs from scratch"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Rebuild</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onLoadCorpus(false)}
                  disabled={isCorpusLoading}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow transition cursor-pointer ${
                    isCorpusLoading
                      ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  <Download
                    className={`w-3.5 h-3.5 ${isCorpusLoading ? 'animate-bounce text-indigo-400' : ''}`}
                  />
                  <span>{isCorpusLoading ? 'Indexing...' : 'Load Corpus'}</span>
                </button>
              )
            ) : (
              <button
                onClick={() => onLoadCorpus(true)}
                disabled={isCorpusLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                title="Re-extract and re-embed all 21 PDFs from scratch"
              >
                <RefreshCw
                  className={`w-3 h-3 text-slate-400 ${
                    isCorpusLoading ? 'animate-spin text-indigo-400' : ''
                  }`}
                />
                <span>Rebuild</span>
              </button>
            )}

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
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              title="Add custom PDF to store"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {/* WebLLM Warmup Trigger */}
            {gpuStatus?.supported && (
              <button
                onClick={onInitializeLLM}
                disabled={llmState.isInitializing || llmState.isReady}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  llmState.isReady
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                    : llmState.isInitializing
                    ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800 cursor-wait'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 cursor-pointer'
                }`}
                title="Initialize WebGPU local model weights"
              >
                {llmState.isReady ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : llmState.isInitializing ? (
                  <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                ) : (
                  <HardDrive className="w-3 h-3 text-slate-400" />
                )}
                <span>
                  {llmState.isReady
                    ? 'LLM Ready'
                    : llmState.isInitializing
                    ? 'Downloading...'
                    : 'Warmup LLM'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Ingestion Progress Bar */}
        {isCorpusLoading && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 animate-fadeIn">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                {corpusLoadStage || 'Processing documents...'}
              </span>
              <span className="font-mono text-indigo-400 text-xs shrink-0">
                {corpusProgress.total > 0
                  ? `${corpusProgress.current} / ${corpusProgress.total} (${Math.round(
                      (corpusProgress.current / corpusProgress.total) * 100
                    )}%)`
                  : 'Preparing...'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
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

        {/* WebLLM Download Progress Bar */}
        {llmState.isInitializing && llmState.progressReport && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 animate-fadeIn">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-cyan-300 font-medium flex items-center gap-1.5 truncate max-w-xl">
                <Download className="w-3 h-3 text-cyan-400 animate-bounce" />
                {llmState.progressReport.text || 'Fetching model weights...'}
              </span>
              <span className="font-mono text-cyan-400 text-xs shrink-0">
                {Math.round((llmState.progressReport.progress || 0) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
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
