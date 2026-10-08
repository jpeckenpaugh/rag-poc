import React, { useState } from 'react';
import {
  CheckCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
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
  const [filter, setFilter] = useState<'all' | 'answerable' | 'negative'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [previewQuery, setPreviewQuery] = useState<EvaluationQuery | null>(null);

  const filteredQueries = evaluationQueries.filter((q) => {
    if (filter === 'all') return true;
    return q.type === filter;
  });

  const selectedQuery = evaluationQueries.find((q) => q.id === selectedQueryId) || previewQuery;

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3 shadow-sm mb-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            Evaluation Benchmark Queries
          </h2>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            {evaluationQueries.length} verified test cases
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filter === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All (15)
            </button>
            <button
              onClick={() => setFilter('answerable')}
              className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                filter === 'answerable'
                  ? 'bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              Answerable (10)
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                filter === 'negative'
                  ? 'bg-amber-950 text-amber-300 font-semibold border border-amber-800'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              Guardrail (5)
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
            title={isExpanded ? 'Collapse query chips' : 'Expand query chips'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chips Container */}
      {isExpanded && (
        <div className="flex flex-wrap gap-2 pt-1 transition-all">
          {filteredQueries.map((q) => {
            const isSelected = selectedQueryId === q.id;
            const isAnswerable = q.type === 'answerable';

            return (
              <button
                key={q.id}
                onClick={() => {
                  setPreviewQuery(q);
                  onSelectQuery(q, true);
                }}
                onMouseEnter={() => setPreviewQuery(q)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-2 transition duration-150 text-left ${
                  isSelected
                    ? isAnswerable
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-400'
                      : 'bg-amber-700 border-amber-500 text-white shadow-sm ring-1 ring-amber-400'
                    : isAnswerable
                    ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-indigo-500/60 hover:bg-slate-800 hover:text-white'
                    : 'bg-amber-950/20 border-amber-900/40 text-amber-300/90 hover:border-amber-700 hover:bg-amber-950/40 hover:text-amber-200'
                }`}
              >
                <span
                  className={`font-mono text-[10px] px-1 py-0.2 rounded font-semibold ${
                    isSelected
                      ? 'bg-black/25 text-white'
                      : isAnswerable
                      ? 'bg-slate-900 text-indigo-400'
                      : 'bg-amber-950 text-amber-400'
                  }`}
                >
                  {q.id}
                </span>
                <span className="truncate max-w-[210px]">{q.title}</span>
                {isAnswerable ? (
                  <CheckCircle
                    className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-emerald-500/80'}`}
                  />
                ) : (
                  <ShieldAlert
                    className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-amber-400'}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected / Hovered Query Inspector Banner */}
      {selectedQuery && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 bg-slate-950/50 -mx-4 -mb-4 p-4 rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">
                {selectedQuery.id}
              </span>
              <span className="text-slate-300 text-xs font-semibold">
                {selectedQuery.title}
              </span>
              {selectedQuery.category && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                  {selectedQuery.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
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
                    <ShieldAlert className="w-3 h-3" /> Guardrail / Negative Query
                  </>
                )}
              </span>

              <button
                onClick={() => onSelectQuery(selectedQuery, true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 shadow-sm"
              >
                <Search className="w-3 h-3" />
                Run Query
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Query Prompt
              </span>
              <p className="text-slate-200 font-medium italic">"{selectedQuery.query}"</p>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Target Ground Truth / Evidence
              </span>
              <p className="text-slate-300 font-mono text-[11px]">{selectedQuery.evidence}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
