import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Layers,
  Sparkles,
  Search,
  CheckCircle,
  Clock,
  Archive,
  Info
} from 'lucide-react';
import type { CorpusDocument, ChunkRecord } from '../types/corpus';

export interface PDFViewerProps {
  documents: CorpusDocument[];
  allChunks: ChunkRecord[];
  selectedDocId?: string;
  targetPage?: number;
  highlightChunkId?: string;
  onSelectDocument: (docId: string) => void;
  onAskAboutChunk?: (chunk: ChunkRecord) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  documents,
  allChunks,
  selectedDocId,
  targetPage = 1,
  highlightChunkId,
  onSelectDocument,
  onAskAboutChunk,
}) => {
  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Sync targetPage if passed externally (e.g. from citation click)
  useEffect(() => {
    if (targetPage && targetPage > 0) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // Load PDF when document changes
  useEffect(() => {
    if (!currentDoc) return;

    let isCancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    const pdfUrl = `${import.meta.env.BASE_URL}corpus/${currentDoc.filename}`;

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      useSystemFonts: true,
    });

    loadingTask.promise
      .then((loadedPdf) => {
        if (isCancelled) return;
        pdfDocRef.current = loadedPdf;
        setTotalPages(loadedPdf.numPages);
        setPdfLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Failed to load PDF in viewer:', err);
        setPdfError(err instanceof Error ? err.message : String(err));
        setPdfLoading(false);
      });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [currentDoc?.filename]);

  // Render canvas when page or scale changes
  useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    pdfDoc.getPage(currentPage).then((page) => {
      if (isCancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;

      // Handle HiDPI displays
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      // Cancel any ongoing render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;

      task.promise.catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', err);
        }
      });
    });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [currentPage, scale, totalPages, pdfLoading]);

  // Chunks for the current document and current page
  const pageChunks = allChunks.filter(
    (c) => c.docId === currentDoc?.id && c.page === currentPage
  );

  // Filtered documents list for sidebar search
  const filteredDocuments = documents.filter((d) => {
    if (!docSearchQuery) return true;
    const q = docSearchQuery.toLowerCase();
    return (
      d.id.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.filename.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-[680px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* 1. Left Column: Document List */}
      <div className="w-full lg:w-72 bg-slate-950/70 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Northstar Documents ({documents.length})
            </h3>
          </div>
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              placeholder="Search document ID or title..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDocuments.map((doc) => {
            const isSelected = doc.id === currentDoc?.id;
            const docChunksCount = allChunks.filter((c) => c.docId === doc.id).length;

            return (
              <button
                key={doc.id}
                onClick={() => {
                  onSelectDocument(doc.id);
                  setCurrentPage(1);
                }}
                className={`w-full text-left p-2.5 rounded-xl transition flex flex-col gap-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-700/80 text-white shadow-sm'
                    : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-indigo-300 border border-slate-750'
                    }`}
                  >
                    {doc.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {doc.status === 'current' && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-800/60">
                        <CheckCircle className="w-2.5 h-2.5" />
                        current
                      </span>
                    )}
                    {doc.status === 'scheduled' && (
                      <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-800/60">
                        <Clock className="w-2.5 h-2.5" />
                        scheduled
                      </span>
                    )}
                    {doc.status === 'superseded' && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-800/60">
                        <Archive className="w-2.5 h-2.5" />
                        superseded
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs font-medium truncate text-slate-200">
                  {doc.title}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 font-mono">
                  <span>{doc.filename}</span>
                  {docChunksCount > 0 && (
                    <span className="text-indigo-400 font-sans">{docChunksCount} chunks</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Center Column: Rendered PDF Canvas & Controls */}
      <div className="flex-1 flex flex-col bg-slate-950/90 overflow-hidden">
        {/* PDF Viewer Toolbar */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-xs text-white truncate max-w-xs sm:max-w-md">
              {currentDoc ? `${currentDoc.id} — ${currentDoc.title}` : 'No PDF selected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Pagination Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700/80 p-0.5 text-xs text-slate-300">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || pdfLoading}
                className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || pdfLoading}
                className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700/80 p-0.5 text-xs text-slate-300">
              <button
                onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
                className="p-1 hover:text-white transition"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10px] text-slate-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
                className="p-1 hover:text-white transition"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* PDF Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
          {pdfLoading ? (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs">Rendering PDF page {currentPage}...</p>
            </div>
          ) : pdfError ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs max-w-md text-center">
              <p className="font-semibold mb-1">Could not render PDF</p>
              <p className="font-mono text-[11px]">{pdfError}</p>
            </div>
          ) : (
            <div className="shadow-2xl rounded border border-slate-750 bg-white overflow-hidden transition-all duration-200">
              <canvas ref={canvasRef} className="block" />
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Column: Page Chunks & Embedding Inspector */}
      <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Page {currentPage} Chunks ({pageChunks.length})
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            500ch / 100ov
          </span>
        </div>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {pageChunks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">No chunks loaded for page {currentPage}.</p>
              <p className="text-[11px] mt-1 text-slate-600">
                Click "Load Northstar Corpus" to vectorize all document pages.
              </p>
            </div>
          ) : (
            pageChunks.map((chunk, idx) => {
              const isTargetChunk = highlightChunkId === chunk.id;
              const hasVector = Boolean(chunk.vector && chunk.vector.length > 0);

              // Strip prefix for readable preview
              let cleanText = chunk.text;
              const match = cleanText.match(/^\[Document:[^\]]+\]\s*/);
              if (match) {
                cleanText = cleanText.slice(match[0].length);
              }

              return (
                <div
                  key={chunk.id}
                  className={`p-3 rounded-xl border text-xs transition flex flex-col gap-2 ${
                    isTargetChunk
                      ? 'bg-indigo-950/80 border-indigo-500 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                        Chunk #{idx + 1}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {chunk.id}
                      </span>
                    </div>
                    {hasVector && (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                        384d Float32
                      </span>
                    )}
                  </div>

                  <p className="text-slate-300 leading-relaxed font-sans line-clamp-6 select-text whitespace-pre-wrap">
                    {cleanText}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                    <span>{cleanText.length} characters</span>
                    {onAskAboutChunk && (
                      <button
                        onClick={() => onAskAboutChunk(chunk)}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 font-sans font-medium cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        Query about this
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
