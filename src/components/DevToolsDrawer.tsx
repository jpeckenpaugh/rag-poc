import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Code2,
  Terminal,
  Activity,
  Layers,
  Database,
  Cpu,
  HardDrive,
} from 'lucide-react';
import type { ChunkRecord } from '../types/corpus';
import type { RetrievedChunkMatch, AssembledPrompt } from '../engine/promptAssembler';
import type { GPUSupportResult } from '../engine/gpuCheck';
import type { VectorStoreStats } from '../engine/vectorStore';
import type { WebLLMClientState } from '../engine/webLLM';

export interface DevToolsDrawerProps {
  isOpen: boolean;
  activeTab: 'chunks' | 'search' | 'prompt' | 'diagnostics';
  onTabChange: (tab: 'chunks' | 'search' | 'prompt' | 'diagnostics') => void;
  onClose: () => void;
  allChunks: ChunkRecord[];
  latestSearchResults: RetrievedChunkMatch[];
  queryVectorSample: number[] | null;
  assembledPrompt: AssembledPrompt | null;
  gpuStatus: GPUSupportResult | null;
  storeStats: VectorStoreStats;
  llmState: WebLLMClientState;
  onInspectChunk: (chunk: ChunkRecord, score?: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  allChunks,
  latestSearchResults,
  queryVectorSample,
  assembledPrompt,
  gpuStatus,
  storeStats,
  llmState,
  onInspectChunk,
}) => {
  const [chunkDocFilter, setChunkDocFilter] = useState<string>('all');
  const [chunkSearchQuery, setChunkSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  // Extract unique document IDs from allChunks
  const docIds = Array.from(new Set(allChunks.map((c) => c.docId))).sort();

  const filteredChunks = allChunks.filter((chunk) => {
    if (chunkDocFilter !== 'all' && chunk.docId !== chunkDocFilter) {
      return false;
    }
    if (chunkSearchQuery.trim()) {
      const q = chunkSearchQuery.toLowerCase();
      return (
        chunk.text.toLowerCase().includes(q) ||
        chunk.id.toLowerCase().includes(q) ||
        chunk.title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <aside className="border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-920 bg-slate-900/95 backdrop-blur flex flex-col h-full z-20 overflow-hidden shadow-2xl">
      {/* Drawer Header & Tabs */}
      <div className="border-b border-slate-800 bg-slate-950/70 p-3 sm:px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              RAG DevTools & Diagnostics
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              Inspectability Core
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            Hide Drawer
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onTabChange('chunks')}
            className={`py-1.5 px-2 rounded-md font-medium text-center truncate transition flex items-center justify-center gap-1.5 ${
              activeTab === 'chunks'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1. Ingestion</span>
            <span className="sm:hidden">Chunks</span>
          </button>

          <button
            onClick={() => onTabChange('search')}
            className={`py-1.5 px-2 rounded-md font-medium text-center truncate transition flex items-center justify-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2. Retrieval</span>
            <span className="sm:hidden">Vectors</span>
          </button>

          <button
            onClick={() => onTabChange('prompt')}
            className={`py-1.5 px-2 rounded-md font-medium text-center truncate transition flex items-center justify-center gap-1.5 ${
              activeTab === 'prompt'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3. Prompt</span>
            <span className="sm:hidden">Prompt</span>
          </button>

          <button
            onClick={() => onTabChange('diagnostics')}
            className={`py-1.5 px-2 rounded-md font-medium text-center truncate transition flex items-center justify-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">4. Diagnostics</span>
            <span className="sm:hidden">System</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Ingestion & Chunks Inspector */}
      {activeTab === 'chunks' && (
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold">
                In-Memory Chunks ({filteredChunks.length} of {allChunks.length})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {storeStats.documentsIndexed} Documents Indexed
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search chunk text or ID..."
                  value={chunkSearchQuery}
                  onChange={(e) => setChunkSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={chunkDocFilter}
                onChange={(e) => setChunkDocFilter(e.target.value)}
                className="text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-2 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[140px]"
              >
                <option value="all">All Docs ({docIds.length})</option>
                {docIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredChunks.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                {allChunks.length === 0
                  ? 'No chunks loaded yet. Click "Load Northstar Corpus" in the header to ingest PDFs.'
                  : 'No chunks matching the current filter.'}
              </div>
            ) : (
              filteredChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  onClick={() => onInspectChunk(chunk)}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900 transition cursor-pointer text-xs group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] text-indigo-400 font-semibold group-hover:text-indigo-300">
                      {chunk.id}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {chunk.text.length} chars · p.{chunk.page}
                    </span>
                  </div>
                  <div className="text-slate-300 font-medium text-[11px] mb-1 truncate">
                    {chunk.title}
                  </div>
                  <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                    {chunk.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Vector Search Breakdown */}
      {activeTab === 'search' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Query Vector Embedding
            </h4>
            {queryVectorSample ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Model: Xenova/all-MiniLM-L6-v2</span>
                  <span>Norm: 1.0 (Unit Normalized)</span>
                  <span>Dims: 384</span>
                </div>
                <div className="text-indigo-400 break-all">
                  [{queryVectorSample.map((v) => v.toFixed(4)).join(', ')}, ... ]
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
                Submit a query or click an evaluation chip to generate a query embedding.
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ranked Candidates & Cosine Similarity
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Threshold: ≥ 0.25 Cosine Dot Product
              </span>
            </div>

            {latestSearchResults.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                No active search results. Run a query above to see similarity score ranking.
              </div>
            ) : (
              <div className="space-y-2">
                {latestSearchResults.map(({ chunk, score }, idx) => {
                  const passThreshold = score >= 0.25;
                  const percent = (score * 100).toFixed(1);

                  return (
                    <div
                      key={chunk.id}
                      onClick={() => onInspectChunk(chunk, score)}
                      className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                        passThreshold
                          ? 'bg-slate-950 border-slate-800 hover:border-indigo-500/60'
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-indigo-400 font-semibold text-[11px]">
                            {chunk.docId}
                          </span>
                          <span className="text-slate-400 text-[10px]">p.{chunk.page}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              score >= 0.45
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : score >= 0.25
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            dot = {score.toFixed(4)} ({percent}%)
                          </span>
                          {passThreshold ? (
                            <span title="Passed threshold (included in context)">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                          ) : (
                            <span title="Below threshold (discarded)">
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-slate-300 font-medium text-[11px] mb-1 truncate">
                        {chunk.title}
                      </div>

                      <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                        {chunk.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Grounded Prompt Preview */}
      {activeTab === 'prompt' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                System Prompt (Guardrail Directives)
              </h4>
              <span className="text-[10px] text-emerald-400 font-semibold">
                Strict Grounding Enabled
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
              {assembledPrompt?.systemPrompt ||
                'You are an internal corporate assistant for Northstar Urgent Care Cooperative. Answer the user question strictly using only the context snippets provided below. If the information is not contained in the context, explicitly respond: "I cannot find this information in the provided documentation." Do not make assumptions, extrapolate, or invent policies or clinical details not stated. Cite documents using [Source: <filename>, Page: <page>].'}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                User Prompt with Assembled Context
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {assembledPrompt?.includedChunks.length || 0} Snippets Injected
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {assembledPrompt?.userPrompt ||
                '(No active query prompt assembled. Run a question to inspect the exact injected context.)'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Hardware & WebGPU */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              WebGPU Adapter & Hardware
            </h4>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">WebGPU Available:</span>
                <span
                  className={gpuStatus?.supported ? 'text-emerald-400 font-bold' : 'text-amber-400'}
                >
                  {gpuStatus?.supported ? 'Yes (Supported)' : 'No (CPU Fallback)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Adapter Name:</span>
                <span className="text-slate-200 truncate max-w-[200px]">
                  {gpuStatus?.adapterName || 'None'}
                </span>
              </div>
              {gpuStatus?.reason && (
                <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-amber-300">
                  {gpuStatus.reason}
                </div>
              )}
            </div>
          </div>

          {/* Embedding & In-Memory Store */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              In-Memory Vector Heap
            </h4>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Embedding Model:</span>
                <span className="text-slate-200">Xenova/all-MiniLM-L6-v2 (quantized ONNX)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Embedding Dimensions:</span>
                <span className="text-slate-200">{storeStats.vectorDimensions || 384}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Documents Stored:</span>
                <span className="text-slate-200">{storeStats.documentsIndexed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chunks Stored:</span>
                <span className="text-slate-200">{storeStats.chunkCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vector Memory Footprint:</span>
                <span className="text-indigo-400 font-bold">
                  {formatBytes(storeStats.estimatedMemoryBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* WebLLM Cache & Status */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              WebLLM Model Runtime
            </h4>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Model ID:</span>
                <span className="text-slate-200 truncate max-w-[200px]">
                  {llmState.selectedModel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Engine Ready:</span>
                <span className={llmState.isReady ? 'text-emerald-400' : 'text-slate-400'}>
                  {llmState.isReady ? 'Yes (Loaded in WebGPU)' : 'Not yet warmed up'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cache Status:</span>
                <span className="text-slate-300">CacheStorage / IndexedDB</span>
              </div>
              {llmState.error && (
                <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-rose-400">
                  {llmState.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
