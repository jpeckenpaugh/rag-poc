import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header, AppViewMode } from './components/Header';
import { EvaluationQueryBar } from './components/EvaluationQueryBar';
import { ChatInterface, ChatMessage } from './components/ChatInterface';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { ChunkModal } from './components/ChunkModal';
import { PDFViewer } from './components/PDFViewer';

// Engines & Data
import { checkWebGPUSupport, GPUSupportResult } from './engine/gpuCheck';
import { extractTextFromUrl, extractTextFromPDF } from './engine/pdfExtractor';
import { chunkDocument, chunkDocuments } from './engine/chunker';
import { embedChunks, embedQuery } from './engine/embeddings';
import { InMemoryVectorStore, VectorStoreStats } from './engine/vectorStore';
import { getWebLLMClient, WebLLMClientState } from './engine/webLLM';
import { assemblePrompt, AssembledPrompt, RetrievedChunkMatch } from './engine/promptAssembler';
import {
  loadChunksFromCache,
  saveChunksToCache,
  getCacheMetadata,
} from './engine/chunkCache';
import { EvaluationQuery } from './data/evaluationQueries';
import { CorpusDocument, ChunkRecord } from './types/corpus';

export const App: React.FC = () => {
  // Navigation / View State: 'chat' | 'documents' | 'devtools'
  const [currentView, setCurrentView] = useState<AppViewMode>('chat');

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
  const [hasCachedCorpus, setHasCachedCorpus] = useState<boolean>(false);
  const [corpusProgress, setCorpusProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // LLM state
  const webLLM = useMemo(() => getWebLLMClient(), []);
  const [llmState, setLlmState] = useState<WebLLMClientState>(webLLM.getState());

  // DevTools & Inspectability state
  const [devToolsTab, setDevToolsTab] = useState<'chunks' | 'search' | 'prompt' | 'diagnostics'>('chunks');
  const [allChunks, setAllChunks] = useState<ChunkRecord[]>([]);
  const [latestSearchResults, setLatestSearchResults] = useState<RetrievedChunkMatch[]>([]);
  const [queryVectorSample, setQueryVectorSample] = useState<number[] | null>(null);
  const [assembledPrompt, setAssembledPrompt] = useState<AssembledPrompt | null>(null);

  // PDF Viewer Focus State
  const [selectedPdfDocId, setSelectedPdfDocId] = useState<string>('NU-OPS-001');
  const [targetPdfPage, setTargetPdfPage] = useState<number>(1);
  const [highlightPdfChunkId, setHighlightPdfChunkId] = useState<string | undefined>(undefined);

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

  // Load manifest on mount & check cache
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}corpus/manifest.json`)
      .then((res) => res.json())
      .then((data: CorpusDocument[]) => {
        setManifest(data);
        if (data.length > 0) {
          setSelectedPdfDocId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load corpus manifest:', err));

    const meta = getCacheMetadata();
    if (meta && meta.chunkCount > 0) {
      setHasCachedCorpus(true);
      // Auto-restore cached chunks immediately on mount
      loadChunksFromCache()
        .then((cachedChunks) => {
          if (cachedChunks && cachedChunks.length > 0) {
            vectorStore.setChunks(cachedChunks);
            setStoreStats(vectorStore.getStats());
            setAllChunks(vectorStore.getChunks());
            setCorpusLoadStage(`Restored ${cachedChunks.length} chunks from browser cache`);
          }
        })
        .catch((e) => console.warn('Could not auto-restore cached chunks:', e));
    }
  }, [vectorStore]);

  // Handler: Ingest Northstar 21 PDF Corpus (Supports cache restore vs force regenerate)
  const handleLoadCorpus = useCallback(
    async (forceRegenerate = false) => {
      if (isCorpusLoading) return;
      setIsCorpusLoading(true);

      try {
        // If not forcing regenerate, try loading from browser cache first
        if (!forceRegenerate) {
          setCorpusLoadStage('Checking local IndexedDB cache for embeddings...');
          const cached = await loadChunksFromCache();
          if (cached && cached.length > 0) {
            vectorStore.setChunks(cached);
            const stats = vectorStore.getStats();
            setStoreStats(stats);
            setAllChunks(vectorStore.getChunks());
            setHasCachedCorpus(true);
            setCorpusLoadStage(`Restored ${cached.length} chunks from browser cache in <50ms.`);
            setTimeout(() => setIsCorpusLoading(false), 500);
            return;
          }
        }

        // 1. Fetch manifest if empty
        let docsToLoad = manifest;
        if (!docsToLoad || docsToLoad.length === 0) {
          setCorpusLoadStage('Fetching document manifest...');
          const res = await fetch(`${import.meta.env.BASE_URL}corpus/manifest.json`);
          docsToLoad = await res.json();
          setManifest(docsToLoad);
        }

        const totalDocs = docsToLoad.length;
        setCorpusLoadStage(`Starting ingestion of ${totalDocs} operational documents...`);
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

        // 6. Cache into browser IndexedDB for fast reload
        setCorpusLoadStage('Saving embeddings to browser cache (IndexedDB)...');
        await saveChunksToCache(embeddedChunks);
        setHasCachedCorpus(true);

        setCorpusLoadStage(`Ready! Ingested & cached ${embeddedChunks.length} chunks across ${totalDocs} documents.`);
        setTimeout(() => setIsCorpusLoading(false), 800);
      } catch (err) {
        console.error('Error during corpus ingestion:', err);
        setCorpusLoadStage(`Ingestion failed: ${err instanceof Error ? err.message : String(err)}`);
        setIsCorpusLoading(false);
      }
    },
    [isCorpusLoading, manifest, vectorStore]
  );

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
      setLlmState((prev) => ({ ...prev, isInitializing: true, error: undefined }));
      await webLLM.initialize((report) => {
        setLlmState((prev) => ({
          ...prev,
          isInitializing: true,
          progressReport: report,
        }));
      });
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

      // Switch to chat view if in another view
      setCurrentView('chat');

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
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            text:
              '⚠️ The Northstar in-memory corpus is not yet loaded. Please click "Load Corpus" in the top bar to ingest and vectorize the 21 PDFs.',
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

        // Step 2: Dot-product linear scan search (Top-5, threshold 0.05 for candidate discovery)
        const rankedMatches = vectorStore.search(queryVector, 5, 0.05);
        setLatestSearchResults(rankedMatches);

        // Step 3: Assemble strict anti-hallucination prompt
        const assembled = assemblePrompt(queryText, rankedMatches, { similarityThreshold: 0.05 });
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
        const result = await webLLM.answerQuery(
          queryText,
          rankedMatches,
          (token: string) => {
            currentAssistantText += token;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, text: currentAssistantText } : msg
              )
            );
          },
          0.05
        );

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

  // Jump from citation click directly to PDF Document Viewer
  const handleOpenInPDFViewer = useCallback(
    (docId: string, page: number, chunkId: string) => {
      setSelectedPdfDocId(docId);
      setTargetPdfPage(page);
      setHighlightPdfChunkId(chunkId);
      setCurrentView('documents');
    },
    []
  );

  // Handler: Select query from evaluation chips
  const handleSelectEvaluationQuery = useCallback(
    (query: EvaluationQuery, autoRun = true) => {
      setSelectedEvaluationQueryId(query.id);
      if (autoRun) {
        handleExecuteQuery(query.query);
      }
    },
    [handleExecuteQuery]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Global Header with View Switcher, Stats, and Actions */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        gpuStatus={gpuStatus}
        checkingGPU={checkingGPU}
        storeStats={storeStats}
        isCorpusLoading={isCorpusLoading}
        corpusLoadStage={corpusLoadStage}
        corpusProgress={corpusProgress}
        hasCachedCorpus={hasCachedCorpus}
        llmState={llmState}
        onLoadCorpus={handleLoadCorpus}
        onUploadCustomFile={handleUploadCustomFile}
        onInitializeLLM={handleInitializeLLM}
      />

      {/* Main Workspace based on current view */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col">
        {/* VIEW 1: ASSISTANT & CHAT */}
        {currentView === 'chat' && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Quick Evaluation Query Bar */}
            <EvaluationQueryBar
              selectedQueryId={selectedEvaluationQueryId}
              onSelectQuery={handleSelectEvaluationQuery}
            />

            {/* Chat Interface Container */}
            <div className="flex-1 min-h-[620px] flex flex-col">
              <ChatInterface
                messages={messages}
                isGenerating={isGenerating}
                onSendMessage={handleExecuteQuery}
                onInspectCitation={(chunk, score) => setInspectedChunk({ chunk, score })}
                onOpenDevTools={(tab) => {
                  if (tab) setDevToolsTab(tab as 'chunks' | 'search' | 'prompt' | 'diagnostics');
                  setCurrentView('devtools');
                }}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: PDF DOCUMENTS & VISUAL CHUNKS VIEWER */}
        {currentView === 'documents' && (
          <div className="flex-1 flex flex-col">
            <PDFViewer
              documents={manifest}
              allChunks={allChunks}
              selectedDocId={selectedPdfDocId}
              targetPage={targetPdfPage}
              highlightChunkId={highlightPdfChunkId}
              onSelectDocument={(docId) => setSelectedPdfDocId(docId)}
              onAskAboutChunk={(chunk) => {
                let clean = chunk.text.trim();
                const prefixMatch = clean.match(/^\[Document:[^\]]+\]\s*/);
                if (prefixMatch) clean = clean.slice(prefixMatch[0].length);
                const queryText = `According to ${chunk.docId} page ${chunk.page}, what is stated regarding: "${clean.slice(0, 120)}..."?`;
                handleExecuteQuery(queryText);
              }}
            />
          </div>
        )}

        {/* VIEW 3: DEVTOOLS & INSPECTOR */}
        {currentView === 'devtools' && (
          <div className="flex-1 h-[720px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
            <DevToolsDrawer
              isOpen={true}
              activeTab={devToolsTab}
              onTabChange={setDevToolsTab}
              onClose={() => setCurrentView('chat')}
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
      </main>

      {/* Chunk Modal for Full Inspectability with direct link to PDF Viewer */}
      <ChunkModal
        isOpen={Boolean(inspectedChunk)}
        chunk={inspectedChunk?.chunk ?? null}
        score={inspectedChunk?.score}
        onClose={() => setInspectedChunk(null)}
        onOpenInPDFViewer={handleOpenInPDFViewer}
      />
    </div>
  );
};

export default App;
