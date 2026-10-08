import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Bookmark,
  ExternalLink,
  AlertOctagon,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import type { ChunkRecord } from '../types/corpus';
import type { RetrievedChunkMatch } from '../engine/promptAssembler';
import { STRICT_REFUSAL_MESSAGE } from '../engine/promptAssembler';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  mode?: 'llm' | 'retrieval-fallback';
  citations?: RetrievedChunkMatch[];
}

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSendMessage: (query: string) => void;
  onInspectCitation: (chunk: ChunkRecord, score?: number) => void;
  onOpenDevTools: (tab?: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isGenerating,
  onSendMessage,
  onInspectCitation,
  onOpenDevTools,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const query = inputText.trim();
    setInputText('');
    onSendMessage(query);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render message text with clickable citation badges
  const renderMessageContent = (msg: ChatMessage) => {
    const text = msg.text;
    const textTrimmed = text.trim();
    const hasRefusalPhrase =
      textTrimmed.includes(STRICT_REFUSAL_MESSAGE) ||
      textTrimmed.toLowerCase().includes('cannot find this information in the provided documentation') ||
      textTrimmed.toLowerCase().includes('does not contain this information') ||
      textTrimmed.toLowerCase().includes('do not contain this information') ||
      textTrimmed.toLowerCase().includes('does not contain any information');
    
    // An abstention is true ONLY if the response is essentially a refusal (short or lacking substantive operational answer)
    const isAbstained =
      hasRefusalPhrase &&
      textTrimmed.length < 180 &&
      !textTrimmed.includes('NU-OPS-') &&
      !textTrimmed.includes('According to');

    return (
      <div className="space-y-3">
        {/* Anti-Hallucination Guardrail Callout */}
        {isAbstained && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 text-xs font-medium">
            <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Guardrail Triggered:</strong> Assistant abstained because the requested facts are not present in the indexed Northstar documentation.
            </span>
          </div>
        )}

        {/* Fallback Mode Note */}
        {msg.mode === 'retrieval-fallback' && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-800/80 text-indigo-300 text-xs">
            <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              <strong>Semantic Retrieval Only:</strong> Generated using in-memory dot-product ranking without active WebGPU LLM.
            </span>
          </div>
        )}

        {/* Main Text Content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap select-text text-slate-100">
          {text}
          {msg.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
          )}
        </div>

        {/* Citations Badges Bar */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 mt-3">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-400">
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Grounded Citations ({msg.citations.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.citations.map(({ chunk, score }, idx) => (
                <button
                  key={`${chunk.id}-${idx}`}
                  onClick={() => onInspectCitation(chunk, score)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 hover:border-indigo-500/50 transition cursor-pointer"
                  title={`Click to view snippet from ${chunk.source} (Similarity: ${(
                    score * 100
                  ).toFixed(1)}%)`}
                >
                  <span className="font-mono text-[11px] font-semibold text-indigo-400">
                    [{chunk.docId}, p. {chunk.page}]
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(score * 100).toFixed(0)}%
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center mb-4 text-indigo-400 shadow-lg shadow-indigo-600/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Ask anything about Northstar Urgent Care
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Every answer is grounded in the in-memory vector index. Pick a test query from the
              evaluation bar above or type your own question below.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-xs">
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Unit-normalized Cosine Dot Product
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                100% In-Memory Local Heap
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Zero Cloud Telemetry
              </span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm animate-fadeIn ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-600/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 shadow-sm border ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                    : 'bg-slate-950/80 text-slate-200 border-slate-800 rounded-tl-none'
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between text-[11px] mb-1.5 opacity-70">
                  <span className="font-semibold">
                    {msg.sender === 'user' ? 'You' : 'Northstar RAG Assistant'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.sender === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(msg.text, msg.id)}
                        className="hover:text-white transition"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.sender === 'assistant' ? (
                  renderMessageContent(msg)
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 border border-slate-700">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask a question about Northstar procedures, policies, or records..."
            disabled={isGenerating}
            className="flex-1 bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition shadow-md ${
              !inputText.trim() || isGenerating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <span>{isGenerating ? 'Thinking...' : 'Ask'}</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
          <span>Grounding: all answers are verifiable against local PDF citations</span>
          <button
            onClick={() => onOpenDevTools('prompt')}
            className="text-indigo-400 hover:text-indigo-300 underline font-medium"
          >
            Inspect Assembled System Prompt
          </button>
        </div>
      </div>
    </div>
  );
};
