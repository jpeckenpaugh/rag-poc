import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { EvaluationQueryBar } from './components/EvaluationQueryBar';
import { ChatInterface, ChatMessage } from './components/ChatInterface';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { ChunkModal } from './components/ChunkModal';

// Engines & Data
import { checkWebGPUSupport, GPUSupportResult } from './engine/gpuCheck';
import { extractTextFromUrl, extractTextFromPDF } from './engine/pdfExtractor';
import { chunkDocument, chunkDocuments } from './engine/chunker';
import { embedChunks, embedQuery } from './engine/embeddings';
import { InMemoryVectorStore, VectorStoreStats } from './engine/vectorStore';
import { getWebLLMClient, WebLLMClientState } from './engine/webLLM';
import { assemblePrompt, AssembledPrompt, RetrievedChunkMatch } from './engine/promptAssembler';
import { EvaluationQuery } from './data/evaluationQueries';
import { CorpusDocument, ChunkRecord } from './types/corpus';

export const App: React.FC = () => {
  // Vector store singleton in component state
  const vectorStore = useMemo(() => new InMemoryVectorStore(), []);

  // System & Diagnostics state
  const [gpuStatus, setGpuStatus] = useState<GPUSupportResult | null>(null);
  const [checkingGPU, setCheckingGPU] = useState<boolean>(true);
  const [storeStats, setStoreStats] = useState<VectorStoreStats>({
    chunkCount: 0,
    documentsIndexed: 0,
    vectorDimensions: 384,
    estimatedMemoryBytes: 0,
  });

  // Corpus loading state
  const [manifest, setManifest] = useState<CorpusDocument[]>([]);
  const [isCorpusLoading, setIsCorpusLoading] = useState<boolean>(false);
  const [corpusLoadStage, setCorpusLoadStage] = useState<string>('');
  const [corpusProgress, setCorpusProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // LLM state
  const webLLM = useMemo(() => getWebLLMClient(), []);
  const [llmState, setLlmState] = useState<WebLLMClientState>(webLLM.getState());

  // DevTools & Inspectability state
  const [isDevToolsOpen, setIsDevToolsOpen] = useState<boolean>(true);
  const [devToolsTab, setDevToolsTab] = useState<'chunks' | 'search' | 'prompt' | 'diagnostics'>('chunks');
  const [allChunks, setAllChunks] = useState<ChunkRecord[]>([]);
  const [latestSearchResults, setLatestSearchResults] = useState<RetrievedChunkMatch[]>([]);
  const [queryVectorSample, setQueryVectorSample] = useState<number[] | null>(null);
  const [assembledPrompt, setAssembledPrompt] = useState<AssembledPrompt | null>(null);

  // Modal inspection state
  const [inspectedChunk, setInspectedChunk] = useState<{ chunk: ChunkRecord; score?: number } | null>(null);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedEvaluationQueryId, setSelectedEvaluationQueryId] = useState<string | null>(null);

  // Check GPU on mount
  useEffect(() => {
    async function initCheck() {
      try {
        const result = await checkWebGPUSupport();
        setGpuStatus(result);
      } catch (err) {
        setGpuStatus({
          supported: false,
          reason: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setCheckingGPU(false);
      }
    }
    initCheck();
  }, []);

  // Listen to WebLLM progress events
  useEffect(() => {
    const unsubscribe = webLLM.onProgress(() => {
      setLlmState(webLLM.getState());
    });
    return unsubscribe;
  }, [webLLM]);

  // Load manifest on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}corpus/manifest.json`)
      .then((res) => res.json())
      .then((data: CorpusDocument[]) => setManifest(data))
      .catch((err) => console.error('Failed to load corpus manifest:', err));
  }, []);

  // Handler: Ingest Northstar 21 PDF Corpus
  const handleLoadCorpus = useCallback(async () => {
    if (isCorpusLoading) return;
    setIsCorpusLoading(true);

    try {
      // 1. Fetch manifest if empty
      let docsToLoad = manifest;
      if (!docsToLoad || docsToLoad.length === 0) {
        setCorpusLoadStage('Fetching document manifest...');
        const res = await fetch(`${import.meta.env.BASE_URL}corpus/manifest.json`);
        docsToLoad = await res.json();
        setManifest(docsToLoad);
      }

      const totalDocs = docsToLoad.length;
      setCorpusProgress({ current: 0, total: totalDocs });

      // 2. Download and Extract PDFs
      const extractedDocs = [];
      for (let i = 0; i < totalDocs; i++) {
        const docMeta = docsToLoad[i];
        setCorpusLoadStage(`Extracting PDF (${i + 1}/${totalDocs}): ${docMeta.filename}...`);
        setCorpusProgress({ current: i + 1, total: totalDocs });

        const url = `${import.meta.env.BASE_URL}corpus/${docMeta.filename}`;
        const extracted = await extractTextFromUrl(url, docMeta);
        extractedDocs.push(extracted);
      }

      // 3. Sliding-window chunking
      setCorpusLoadStage(`Chunking ${extractedDocs.length} extracted documents...`);
      const rawChunks = chunkDocuments(extractedDocs, {
        windowSize: 500,
        overlap: 100,
        minThreshold: 60,
      });

      // 4. Vectorize chunks with in-browser MiniLM-L6-v2 ONNX
      setCorpusLoadStage(`Vectorizing ${rawChunks.length} chunks via all-MiniLM-L6-v2...`);
      setCorpusProgress({ current: 0, total: rawChunks.length });

      const embeddedChunks = await embedChunks(rawChunks, ({ current, total }) => {
        setCorpusProgress({ current, total });
        setCorpusLoadStage(`Vectorizing chunks (${current}/${total})...`);
      });

      // 5. Store chunks in in-memory vector store
      vectorStore.setChunks(embeddedChunks);
      const stats = vectorStore.getStats();
      setStoreStats(stats);
      setAllChunks(vectorStore.getChunks());

      setCorpusLoadStage(`Ready! Ingested ${embeddedChunks.length} chunks across ${totalDocs} documents.`);
      setTimeout(() => setIsCorpusLoading(false), 800);
    } catch (err) {
      console.error('Error during corpus ingestion:', err);
      setCorpusLoadStage(`Ingestion failed: ${err instanceof Error ? err.message : String(err)}`);
      setIsCorpusLoading(false);
    }
  }, [isCorpusLoading, manifest, vectorStore]);

  // Handler: Upload custom PDF
  const handleUploadCustomFile = useCallback(
    async (file: File) => {
      try {
        setIsCorpusLoading(true);
        setCorpusLoadStage(`Extracting custom file: ${file.name}...`);
        setCorpusProgress({ current: 0, total: 1 });

        const extracted = await extractTextFromPDF(file, {
          docId: file.name.replace(/\.[^/.]+$/, '').toUpperCase(),
          title: file.name,
          filename: file.name,
          status: 'custom-upload',
        });

        setCorpusLoadStage(`Chunking ${file.name}...`);
        const newChunks = chunkDocument(extracted);

        setCorpusLoadStage(`Vectorizing ${newChunks.length} chunks...`);
        const embedded = await embedChunks(newChunks, ({ current, total }) => {
          setCorpusProgress({ current, total });
        });

        vectorStore.addChunks(embedded);
        const stats = vectorStore.getStats();
        setStoreStats(stats);
        setAllChunks(vectorStore.getChunks());

        setCorpusLoadStage(`Added ${embedded.length} chunks from ${file.name}`);
        setTimeout(() => setIsCorpusLoading(false), 800);
      } catch (err) {
        console.error('Custom file ingestion failed:', err);
        setCorpusLoadStage(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
        setIsCorpusLoading(false);
      }
    },
    [vectorStore]
  );

  // Handler: Initialize / warmup WebLLM
  const handleInitializeLLM = useCallback(async () => {
    try {
      setLlmState((prev) => ({ ...prev, isInitializing: true }));
      await webLLM.initialize();
      setLlmState(webLLM.getState());
    } catch (err) {
      console.error('Failed to initialize WebLLM:', err);
      setLlmState(webLLM.getState());
    }
  }, [webLLM]);

  // Handler: Execute RAG query
  const handleExecuteQuery = useCallback(
    async (queryText: string) => {
      if (!queryText.trim() || isGenerating) return;

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      // Append user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          text: queryText,
          timestamp: Date.now(),
        },
      ]);

      setIsGenerating(true);

      // Check if vector store has chunks
      if (vectorStore.count() === 0) {
        // Automatically prompt to load corpus or notify user
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text:
              '⚠️ The Northstar in-memory corpus is not yet loaded. Please click "Load Northstar Corpus" in the top bar to ingest and vectorize the 21 PDFs.',
            timestamp: Date.now(),
            citations: [],
          },
        ]);
        setIsGenerating(false);
        return;
      }

      try {
        // Step 1: Embed the query string into normalized 384-dim vector
        const queryVector = await embedQuery(queryText);
        setQueryVectorSample(Array.from(queryVector.slice(0, 8)));

        // Step 2: Dot-product linear scan search (Top-5, threshold 0.15 for ranking inspection)
        const rankedMatches = vectorStore.search(queryVector, 5, 0.15);
        setLatestSearchResults(rankedMatches);

        // Step 3: Assemble strict anti-hallucination prompt
        const assembled = assemblePrompt(queryText, rankedMatches, { similarityThreshold: 0.20 });
        setAssembledPrompt(assembled);

        // Add assistant placeholder with streaming flag
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text: '',
            timestamp: Date.now(),
            isStreaming: true,
            citations: assembled.includedChunks,
          },
        ]);

        let currentAssistantText = '';

        // Step 4: Stream answer via WebLLM or semantic fallback
        const result = await webLLM.answerQuery(queryText, rankedMatches, (token: string) => {
          currentAssistantText += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: currentAssistantText } : msg
            )
          );
        });

        // Finalize assistant message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: result.text,
                  isStreaming: false,
                  mode: result.mode,
                  citations: result.citations,
                }
              : msg
          )
        );
      } catch (err) {
        console.error('Error during RAG query:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: `An error occurred: ${err instanceof Error ? err.message : String(err)}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, vectorStore, webLLM]
  );

  // Handler: Select query from evaluation chips
  const handleSelectEvaluationQuery = useCallback(
    (query: EvaluationQuery, autoRun = false) => {
      setSelectedEvaluationQueryId(query.id);
      if (autoRun) {
        handleExecuteQuery(query.query);
      }
    },
    [handleExecuteQuery]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Global Header with WebGPU status, In-Memory stats, and Actions */}
      <Header
        gpuStatus={gpuStatus}
        checkingGPU={checkingGPU}
        storeStats={storeStats}
        isCorpusLoading={isCorpusLoading}
        corpusLoadStage={corpusLoadStage}
        corpusProgress={corpusProgress}
        llmState={llmState}
        onLoadCorpus={handleLoadCorpus}
        onUploadCustomFile={handleUploadCustomFile}
        onInitializeLLM={handleInitializeLLM}
        onOpenDevTools={(tab) => {
          if (tab) setDevToolsTab(tab as 'chunks' | 'search' | 'prompt' | 'diagnostics');
          setIsDevToolsOpen(true);
        }}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* 2. Quick Evaluation Benchmark Query Bar */}
        <EvaluationQueryBar
          selectedQueryId={selectedEvaluationQueryId}
          onSelectQuery={handleSelectEvaluationQuery}
        />

        {/* 3. Chat and DevTools Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[640px]">
          {/* Left / Main: Chat Interface */}
          <div
            className={`transition-all duration-300 flex flex-col ${
              isDevToolsOpen ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <ChatInterface
              messages={messages}
              isGenerating={isGenerating}
              onSendMessage={handleExecuteQuery}
              onInspectCitation={(chunk, score) => setInspectedChunk({ chunk, score })}
              onOpenDevTools={(tab) => {
                if (tab) setDevToolsTab(tab as 'chunks' | 'search' | 'prompt' | 'diagnostics');
                setIsDevToolsOpen(true);
              }}
            />
          </div>

          {/* Right: DevTools Inspectability Drawer (The Pedagogical Core) */}
          {isDevToolsOpen && (
            <div className="lg:col-span-5 h-[640px] lg:h-auto rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex flex-col">
              <DevToolsDrawer
                isOpen={isDevToolsOpen}
                activeTab={devToolsTab}
                onTabChange={setDevToolsTab}
                onClose={() => setIsDevToolsOpen(false)}
                allChunks={allChunks}
                latestSearchResults={latestSearchResults}
                queryVectorSample={queryVectorSample}
                assembledPrompt={assembledPrompt}
                gpuStatus={gpuStatus}
                storeStats={storeStats}
                llmState={llmState}
                onInspectChunk={(chunk, score) => setInspectedChunk({ chunk, score })}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Re-open DevTools Button when closed */}
      {!isDevToolsOpen && (
        <button
          onClick={() => setIsDevToolsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-full shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition hover:scale-105"
        >
          <span>Open RAG DevTools</span>
        </button>
      )}

      {/* Chunk Modal for Full Inspectability */}
      <ChunkModal
        isOpen={Boolean(inspectedChunk)}
        chunk={inspectedChunk?.chunk ?? null}
        score={inspectedChunk?.score}
        onClose={() => setInspectedChunk(null)}
      />
    </div>
  );
};

export default App;
