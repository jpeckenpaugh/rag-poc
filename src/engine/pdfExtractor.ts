import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedDocument, ExtractedPage, CorpusDocument } from '../types/corpus';

// PDF.js worker version fallback
const PDFJS_VERSION = (pdfjsLib as unknown as { version?: string }).version || '3.2.146';

// Configure PDF.js worker.
// In browser Vite environments, use CDN or local worker.
if (typeof window !== 'undefined') {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  }
}

export interface PDFExtractionOptions {
  docId?: string;
  title?: string;
  status?: string;
  filename?: string;
}

/**
 * Extracts raw text page-by-page from a PDF given as ArrayBuffer, Uint8Array, or File/Blob.
 * Preserves 1-indexed page numbering and document metadata.
 */
export async function extractTextFromPDF(
  data: ArrayBuffer | Uint8Array | Blob,
  metadata?: PDFExtractionOptions
): Promise<ExtractedDocument> {
  let arrayData: Uint8Array;

  if (data instanceof Uint8Array) {
    arrayData = data;
  } else if (data instanceof ArrayBuffer) {
    arrayData = new Uint8Array(data);
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buf = await data.arrayBuffer();
    arrayData = new Uint8Array(buf);
  } else {
    const buf = await (data as Blob).arrayBuffer();
    arrayData = new Uint8Array(buf);
  }

  // Ensure workerSrc is set if in browser
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: arrayData,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages: ExtractedPage[] = [];
  let totalCharacters = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items by line if possible or join text items with space / newline
    let lastY: number | null = null;
    const lineParts: string[] = [];

    for (const item of textContent.items) {
      if ('str' in item) {
        const itemText = (item as { str: string; transform: number[] }).str;
        const transform = (item as { transform: number[] }).transform;
        const currentY = transform ? transform[5] : null;

        // Add line breaks when vertical position shifts significantly
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          lineParts.push('\n');
        } else if (lineParts.length > 0 && !lineParts[lineParts.length - 1].endsWith('\n')) {
          lineParts.push(' ');
        }

        lineParts.push(itemText);
        lastY = currentY;
      }
    }

    const pageText = lineParts.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    totalCharacters += pageText.length;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
  }

  return {
    docId: metadata?.docId || 'DOC-UNKNOWN',
    title: metadata?.title || metadata?.filename || 'Untitled Document',
    filename: metadata?.filename || 'document.pdf',
    status: metadata?.status || 'current',
    pages,
    totalCharacters,
  };
}

/**
 * Convenience helper to fetch and extract a PDF from a URL.
 */
export async function extractTextFromUrl(
  url: string,
  docMetadata?: Partial<CorpusDocument>
): Promise<ExtractedDocument> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const filename = url.split('/').pop() || 'document.pdf';

  return extractTextFromPDF(arrayBuffer, {
    docId: docMetadata?.id || filename.replace('.pdf', ''),
    title: docMetadata?.title || filename,
    status: docMetadata?.status || 'current',
    filename: docMetadata?.filename || filename,
  });
}
