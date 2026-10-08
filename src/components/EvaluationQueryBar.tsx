import React, { useState } from 'react';
import {
  CheckCircle,
  ShieldAlert,
  Search,
  Sparkles,
  ChevronDown,
  Info,
} from 'lucide-react';
import { evaluationQueries, EvaluationQuery } from '../data/evaluationQueries';

export interface EvaluationQueryBarProps {
  selectedQueryId: string | null;
  onSelectQuery: (query: EvaluationQuery, autoRun?: boolean) => void;
}

export const EvaluationQueryBar: React.FC<EvaluationQueryBarProps> = ({
  selectedQueryId,
  onSelectQuery,
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const selectedQuery =
    evaluationQueries.find((q) => q.id === selectedQueryId) || null;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const queryId = e.target.value;
    if (!queryId) return;
    const found = evaluationQueries.find((q) => q.id === queryId);
    if (found) {
      setShowDetails(true);
      onSelectQuery(found, true);
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-2 sm:px-3 sm:py-2 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Left: Label & Dropdown */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Evaluation Benchmark:</span>
            <span className="md:hidden">Benchmark:</span>
          </div>

          {/* Compact Dropdown Select */}
          <div className="relative flex-1 min-w-0 max-w-xl">
            <select
              value={selectedQueryId || ''}
              onChange={handleSelectChange}
              className="w-full bg-slate-950 border border-slate-750 hover:border-slate-600 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition appearance-none cursor-pointer pr-8 font-medium truncate"
            >
              <option value="" disabled>
                Select a benchmark test case ({evaluationQueries.length} available)...
              </option>
              <optgroup label="── Answerable Operational Queries (10) ──">
                {evaluationQueries
                  .filter((q) => q.type === 'answerable')
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.id}] {q.title}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="── Guardrail & Negative Queries (5) ──">
                {evaluationQueries
                  .filter((q) => q.type === 'negative')
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.id}] {q.title} (Guardrail)
                    </option>
                  ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Right: Quick Type Filter Pills & Details Toggle */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {selectedQuery && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition cursor-pointer ${
                showDetails
                  ? 'bg-slate-800 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
              title="Toggle target citations and prompt details"
            >
              <Info className="w-3 h-3" />
              <span>{showDetails ? 'Hide Details' : 'Details'}</span>
            </button>
          )}

          {selectedQuery && (
            <button
              onClick={() => onSelectQuery(selectedQuery, true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
              title="Run this benchmark query again"
            >
              <Search className="w-3 h-3" />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Inspection Details for selected query */}
      {showDetails && selectedQuery && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 bg-slate-950/40 -mx-2 -mb-2 p-3 rounded-b-xl text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">
                {selectedQuery.id}
              </span>
              <span className="text-slate-200 font-semibold">{selectedQuery.title}</span>
              {selectedQuery.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {selectedQuery.category}
                </span>
              )}
            </div>

            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                selectedQuery.type === 'answerable'
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-400 border-amber-800'
              }`}
            >
              {selectedQuery.type === 'answerable' ? (
                <>
                  <CheckCircle className="w-3 h-3" /> Answerable Query
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3" /> Anti-Hallucination Guardrail
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Full Query
              </span>
              <p className="text-slate-200 italic font-medium">"{selectedQuery.query}"</p>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Target Evidence Citation
              </span>
              <p className="text-slate-300 font-mono text-[11px]">{selectedQuery.evidence}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
