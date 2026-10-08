import {
  FileText,
  Cpu,
  Layers,
  ShieldCheck,
  Sparkles,
  Database,
  ChevronRight,
} from 'lucide-react';
import { SUPPORTED_LLM_MODELS } from '../engine/webLLM';
import { SUPPORTED_EMBEDDING_MODELS } from '../engine/embeddings';

export interface AboutViewProps {
  onOpenSettings: () => void;
  onNavigateToTab: (tab: 'chat' | 'documents' | 'devtools') => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  onOpenSettings,
  onNavigateToTab,
}) => {
  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto space-y-8 py-2 px-1 text-slate-200">
      {/* 1. Hero Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-800/60 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/80 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zero-Backend Client-Only Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            In-Browser RAG: Zero-Backend Document Assistant
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            A 100% client-side, zero-backend Retrieval-Augmented Generation (RAG) system running entirely inside modern web browsers. PDF parsing, sliding-window chunking, ONNX embedding generation, vector similarity indexing, and instruction-tuned LLM inference execute completely on your device with zero server-side compute or external API calls.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigateToTab('chat')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <span>Try Assistant Chat</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToTab('documents')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-750 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explore 21 PDFs & Chunks</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-750 transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Configure Models & Parameters</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Core Pillars / Architecture Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Absolute Client Privacy</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your documents, queries, embeddings, and chat history never leave your browser sandbox. No telemetry, no cloud LLM API endpoints, no third-party data tracking.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Radical Simplicity (JS Heap)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No SQLite, Pinecone, or WASM vector indexing plugins. 367 chunk embeddings live in contiguous <code className="text-indigo-300">Float32Array</code> buffers directly in JavaScript memory with sub-2ms dot-product scans.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 mb-3">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Hardware Acceleration</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Harnesses WebGPU via <code className="text-cyan-300">@mlc-ai/web-llm</code> for local LLM token generation and ONNX Runtime Web for dense feature extraction. Automatically falls back to semantic retrieval on CPUs.
          </p>
        </div>
      </div>

      {/* 3. The Northstar Urgent Care Cooperative Corpus */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">The Northstar Corpus & Evaluation Benchmark</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          The test dataset consists of <strong>21 synthetic operational documents</strong> (64 total PDF pages, generating ~367 chunks) from the fictional <em>Northstar Urgent Care Cooperative</em>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              10 Grounded Answerable Queries
            </div>
            <p className="text-slate-400 leading-relaxed">
              Tests explicit factual retrieval across routine site opening checklists (<code className="text-indigo-400">NU-OPS-002</code>), facilities escalation (<code className="text-indigo-400">NU-OPS-003</code>), service interruption timing (<code className="text-indigo-400">NU-OPS-006</code>), and monthly metrics deadlines (<code className="text-indigo-400">NU-OPS-019</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              5 Anti-Hallucination Guardrail Queries
            </div>
            <p className="text-slate-400 leading-relaxed">
              Tests strict model abstention on out-of-domain medical queries (e.g., ibuprofen dosage), unmentioned insurance policies, and unestablished regular Friday office hours (preventing confusion with temporary Harbor Point exceptions).
            </p>
          </div>
        </div>
      </div>

      {/* 4. Supported Models & How to Test Alternatives */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Models & Parameter Swapping</h2>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Open Settings Drawer →
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          The system supports hot-swapping both the in-browser LLM generator and the ONNX embedding model at runtime directly from the UI:
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Supported WebGPU LLM Generators:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {SUPPORTED_LLM_MODELS.map((m) => (
                <div key={m.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span>{m.name}</span>
                    <span className="text-[10px] font-mono text-cyan-400">~{m.vramRequiredMB} MB VRAM</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{m.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Supported In-Browser ONNX Embedding Models:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {SUPPORTED_EMBEDDING_MODELS.map((em) => (
                <div key={em.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span>{em.name}</span>
                    <span className="text-[10px] font-mono text-emerald-400">{em.dimensions}d · ~{em.sizeMB} MB</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{em.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Engineering Deep-Dive: Why In-Memory Flat Arrays? */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Technical Deep-Dive: Linear Scan vs. Vector DBs</h2>
        </div>
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
          <p>
            Traditional RAG architectures load complex vector database extensions (e.g. SQLite-VSS, DuckDB, or HNSW WebAssembly builds). While necessary for datasets with &gt;100,000 vectors, for corporate policy subsets (~500–2,000 chunks) this introduces unnecessary bundle bloat and index build overhead.
          </p>
          <p>
            By storing normalized 384-dimensional vectors in contiguous <code className="text-indigo-300">Float32Array</code> buffers, calculating cosine similarity simplifies to a plain dot product:
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300">
            Score = Q · V = ∑ (Q[i] × V[i])
          </div>
          <p>
            A full linear scan of 367 vectors requires only <strong>140,928 floating-point multiplications</strong>, completing in <strong>&lt; 2 milliseconds</strong> on modern browser JavaScript engines without requiring any index generation.
          </p>
        </div>
      </div>
    </div>
  );
};
