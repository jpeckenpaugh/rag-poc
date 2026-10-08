import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Sparkles,
  Search,
  CheckCircle,
  Clock,
  Archive,
  Info,
  PanelRightClose,
  PanelRightOpen,
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

  // UI Collapsible States
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState<boolean>(false);
  const [isChunksPanelOpen, setIsChunksPanelOpen] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDocDropdownOpen(false);
      }
    }
    if (isDocDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDocDropdownOpen]);

  // Sync targetPage if passed externally
  useEffect(() => {
    if (targetPage && targetPage > 0) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // If a chunk is highlighted externally, automatically ensure chunks panel is open
  useEffect(() => {
    if (highlightChunkId) {
      setIsChunksPanelOpen(true);
    }
  }, [highlightChunkId]);

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

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

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

  // Filtered documents list for dropdown search
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
    <div className="flex-1 flex flex-col h-full min-h-[700px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* 1. Global PDF Toolbar (Document Selector Dropdown + Controls) */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
        {/* Left: Document Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-xs font-medium text-slate-200 transition shadow-sm cursor-pointer"
            title="Click to select another Northstar document"
          >
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
              {currentDoc?.id || 'Select'}
            </span>
            <span className="truncate max-w-[200px] sm:max-w-[340px] font-semibold text-white">
              {currentDoc?.title || 'Choose Document'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                isDocDropdownOpen ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Modal */}
          {isDocDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden z-50 animate-scaleUp">
              <div className="p-3 border-b border-slate-800 bg-slate-950">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    placeholder="Search 21 documents..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
                {filteredDocuments.map((doc) => {
                  const isSelected = doc.id === currentDoc?.id;
                  const docChunksCount = allChunks.filter((c) => c.docId === doc.id).length;

                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        onSelectDocument(doc.id);
                        setCurrentPage(1);
                        setIsDocDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition flex flex-col gap-0.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-700 text-white shadow-sm'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
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

                      <div className="text-xs font-medium truncate text-slate-200 mt-0.5">
                        {doc.title}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
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
          )}
        </div>

        {/* Center/Right: Navigation & Panel Toggle Controls */}
        <div className="flex items-center gap-2">
          {/* Pagination Controls */}
          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-750 p-0.5 text-xs text-slate-300">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || pdfLoading}
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition cursor-pointer"
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
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-750 p-0.5 text-xs text-slate-300">
            <button
              onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
              className="p-1 hover:text-white transition cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[10px] text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
              className="p-1 hover:text-white transition cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chunks Panel Toggle Button */}
          <button
            onClick={() => setIsChunksPanelOpen(!isChunksPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
              isChunksPanelOpen
                ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-750 hover:text-white'
            }`}
            title={isChunksPanelOpen ? 'Collapse chunks sidebar' : 'Expand chunks sidebar'}
          >
            {isChunksPanelOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              Page Chunks ({pageChunks.length})
            </span>
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Body: Rendered Canvas + Collapsible Chunks Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* PDF Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950 transition-all">
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

        {/* 3. Collapsible Right Column: Page Chunks */}
        {isChunksPanelOpen && (
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0 animate-fadeIn transition-all">
            <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Page {currentPage} Chunks ({pageChunks.length})
                </h4>
              </div>
              <button
                onClick={() => setIsChunksPanelOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                title="Collapse sidebar"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[70vh] lg:max-h-none">
              {pageChunks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Info className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No chunks loaded for page {currentPage}.</p>
                  <p className="text-[11px] mt-1 text-slate-600">
                    Click "Load Corpus" to vectorize all document pages.
                  </p>
                </div>
              ) : (
                pageChunks.map((chunk, idx) => {
                  const isTargetChunk = highlightChunkId === chunk.id;
                  const hasVector = Boolean(chunk.vector && chunk.vector.length > 0);

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
        )}
      </div>
    </div>
  );
};
