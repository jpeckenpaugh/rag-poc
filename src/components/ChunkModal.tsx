import React from 'react';
import { X, FileText, Bookmark, Hash } from 'lucide-react';
import type { ChunkRecord } from '../types/corpus';

export interface ChunkModalProps {
  chunk: ChunkRecord | null;
  score?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ChunkModal: React.FC<ChunkModalProps> = ({
  chunk,
  score,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !chunk) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-750 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800/80 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {chunk.docId}
                </span>
                <span className="text-xs text-slate-400">Page {chunk.page}</span>
                {score !== undefined && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-semibold">
                    Similarity: {(score * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-100 truncate max-w-md mt-0.5">
                {chunk.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Strip */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800/60 flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            <span>Chunk ID:</span>
            <span className="text-slate-200">{chunk.id}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-slate-500" />
            <span>Source:</span>
            <span className="text-slate-200">{chunk.source}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Status:</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                chunk.status === 'current'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {chunk.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Chars:</span>
            <span className="text-slate-200">{chunk.text.length}</span>
          </div>
        </div>

        {/* Chunk Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
              Exact In-Memory Chunk Text
            </span>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
              {chunk.text}
            </div>
          </div>

          {chunk.vector && (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                MiniLM Vector Sample (First 8 of {chunk.vector.length} dimensions)
              </span>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400">
                [
                {Array.from(chunk.vector.slice(0, 8))
                  .map((n) => n.toFixed(4))
                  .join(', ')}
                , ... ]
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs text-slate-400">
          <span>Grounded retrieval citation preview</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
