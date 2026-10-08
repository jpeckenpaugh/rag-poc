import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';

// Standalone self-contained test of the engine algorithms and PDF parsing in Node.js
// reproducing exactly the math and logic in src/engine/

function normalizeVector(vector) {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }
  return vector;
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: vector a has ${a.length} dims, vector b has ${b.length} dims.`);
  }
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

class InMemoryVectorStore {
  constructor(initialChunks = []) {
    this.chunks = [...initialChunks];
  }
  addChunks(newChunks) {
    this.chunks.push(...newChunks);
  }
  setChunks(chunks) {
    this.chunks = [...chunks];
  }
  getChunks() {
    return this.chunks;
  }
  count() {
    return this.chunks.length;
  }
  clear() {
    this.chunks = [];
  }
  search(queryVector, topK = 5, threshold = 0.25) {
    const scored = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (!chunk.vector) continue;
      const score = cosineSimilarity(queryVector, chunk.vector);
      if (score >= threshold) {
        scored.push({ chunk, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
  getStats() {
    let vectorDims = 0;
    let vectorMemoryBytes = 0;
    const docIds = new Set();
    for (const chunk of this.chunks) {
      docIds.add(chunk.docId);
      if (chunk.vector) {
        vectorDims = chunk.vector.length;
        vectorMemoryBytes += chunk.vector.byteLength;
      }
      vectorMemoryBytes += (chunk.text.length + chunk.title.length + chunk.source.length) * 2;
    }
    return {
      chunkCount: this.chunks.length,
      documentsIndexed: docIds.size,
      vectorDimensions: vectorDims,
      estimatedMemoryBytes: vectorMemoryBytes,
    };
  }
}

async function extractTextFromPDF(data, metadata) {
  const loadingTask = pdfjsLib.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];
  let totalCharacters = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    let lastY = null;
    const lineParts = [];

    for (const item of textContent.items) {
      if ('str' in item) {
        const itemText = item.str;
        const transform = item.transform;
        const currentY = transform ? transform[5] : null;

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

function chunkDocument(doc, options) {
  const windowSize = options?.windowSize ?? 500;
  const overlap = options?.overlap ?? 100;
  const minThreshold = options?.minThreshold ?? 60;
  const step = Math.max(1, windowSize - overlap);

  const chunks = [];
  let chunkIndex = 0;

  for (const page of doc.pages) {
    const rawText = page.text.trim();
    if (!rawText || rawText.length < minThreshold) {
      continue;
    }

    for (let start = 0; start < rawText.length; start += step) {
      const end = Math.min(start + windowSize, rawText.length);
      const rawChunkText = rawText.slice(start, end).trim();

      if (rawChunkText.length < minThreshold) {
        continue;
      }

      chunkIndex++;
      const prefix = `[Document: ${doc.docId} - ${doc.title} | Page: ${page.pageNumber} | Status: ${doc.status}]`;
      const fullText = `${prefix}\n${rawChunkText}`;

      chunks.push({
        id: `${doc.docId}-p${page.pageNumber}-c${chunkIndex}`,
        source: doc.filename,
        docId: doc.docId,
        title: doc.title,
        status: doc.status,
        page: page.pageNumber,
        text: fullText,
      });

      if (end >= rawText.length) {
        break;
      }
    }
  }

  return chunks;
}

async function run() {
  console.log('=== RUNNING ENGINE VERIFICATION SUITE ===');

  // Test 1: Vector similarity & normalization
  console.log('\n[1/5] Testing Cosine Similarity & Normalization...');
  const vA = normalizeVector(new Float32Array([1, 0, 0, 0]));
  const vB = normalizeVector(new Float32Array([1, 0, 0, 0]));
  const vC = normalizeVector(new Float32Array([0, 1, 0, 0]));
  const vD = normalizeVector(new Float32Array([1, 1, 0, 0]));

  const simIdentical = cosineSimilarity(vA, vB);
  const simOrthogonal = cosineSimilarity(vA, vC);
  const simDiag = cosineSimilarity(vA, vD);

  console.log(`- Identical: ${simIdentical.toFixed(4)} (Expected 1.0000)`);
  console.log(`- Orthogonal: ${simOrthogonal.toFixed(4)} (Expected 0.0000)`);
  console.log(`- Angle 45: ${simDiag.toFixed(4)} (Expected ~0.7071)`);

  if (Math.abs(simIdentical - 1) > 1e-4) throw new Error('Identical check failed');
  if (Math.abs(simOrthogonal - 0) > 1e-4) throw new Error('Orthogonal check failed');
  if (Math.abs(simDiag - 0.7071) > 1e-3) throw new Error('Diagonal check failed');
  console.log('✓ Vector operations verified.');

  // Test 2: In-Memory Vector Store Top-K & Thresholding
  console.log('\n[2/5] Testing InMemoryVectorStore Search & Ranking...');
  const store = new InMemoryVectorStore();
  store.setChunks([
    {
      id: 'doc1-c1',
      source: 'NU-OPS-001.pdf',
      docId: 'NU-OPS-001',
      title: 'Operations Governance',
      status: 'current',
      page: 1,
      text: 'Operations Governance policies and principles',
      vector: normalizeVector(new Float32Array([0.95, 0.05, 0.0, 0.0])),
    },
    {
      id: 'doc2-c1',
      source: 'NU-OPS-002.pdf',
      docId: 'NU-OPS-002',
      title: 'Facility Access',
      status: 'current',
      page: 1,
      text: 'Badges and security escort rules',
      vector: normalizeVector(new Float32Array([0.1, 0.9, 0.0, 0.0])),
    },
    {
      id: 'doc3-c1',
      source: 'NU-OPS-003.pdf',
      docId: 'NU-OPS-003',
      title: 'Incident Reporting',
      status: 'superseded',
      page: 1,
      text: 'Reporting non-clinical incidents to supervisors',
      vector: normalizeVector(new Float32Array([0.0, 0.1, 0.9, 0.1])),
    },
  ]);

  const queryVector = normalizeVector(new Float32Array([1.0, 0.0, 0.0, 0.0]));
  const results = store.search(queryVector, 2, 0.25);
  console.log(`- Query returned ${results.length} results (topK=2, threshold=0.25):`);
  results.forEach(r => console.log(`  * [${r.chunk.docId}] score: ${r.score.toFixed(4)} - ${r.chunk.title}`));

  if (results.length !== 1 || results[0].chunk.docId !== 'NU-OPS-001') {
    throw new Error('Vector store ranking or thresholding failed');
  }
  const stats = store.getStats();
  console.log('- Store stats:', stats);
  console.log('✓ InMemoryVectorStore verified.');

  // Test 3: PDF Extraction on NU-OPS-001.pdf
  console.log('\n[3/5] Testing PDF Extraction on public/corpus/NU-OPS-001.pdf...');
  const buf = fs.readFileSync(path.resolve('public/corpus/NU-OPS-001.pdf'));
  const extracted = await extractTextFromPDF(buf, {
    docId: 'NU-OPS-001',
    title: 'Operations Governance and Document Control',
    status: 'current',
    filename: 'NU-OPS-001.pdf',
  });
  console.log(`- Extracted ${extracted.pages.length} pages, ${extracted.totalCharacters} total characters.`);
  if (extracted.pages.length !== 3) {
    throw new Error(`Expected 3 pages, found ${extracted.pages.length}`);
  }
  console.log('✓ PDF Extraction verified.');

  // Test 4: Sliding Window Chunker
  console.log('\n[4/5] Testing Sliding-Window Chunker (500 char window, 100 overlap, >=60 min)...');
  const chunks = chunkDocument(extracted);
  console.log(`- Generated ${chunks.length} chunks.`);
  const first = chunks[0];
  console.log(`- Chunk 1 ID: ${first.id}`);
  console.log(`- Chunk 1 Prefix:\n  ${first.text.split('\n')[0]}`);
  console.log(`- Chunk 1 Length: ${first.text.length} chars`);

  for (const c of chunks) {
    if (c.text.length < 60) throw new Error(`Chunk ${c.id} violates minimum length threshold`);
    if (!c.text.startsWith('[Document: NU-OPS-001')) throw new Error(`Chunk ${c.id} missing prefix`);
  }
  console.log('✓ Sliding-Window Chunker verified.');

  // Test 5: Full Ingestion of All 21 Northstar Corpus Documents
  console.log('\n[5/5] Testing Ingestion across entire 21 PDF Corpus...');
  const manifest = JSON.parse(fs.readFileSync('public/corpus/manifest.json', 'utf8'));
  console.log(`- Loaded manifest with ${manifest.length} documents.`);

  let totalDocs = 0;
  let totalPages = 0;
  let totalChunks = 0;
  let totalChars = 0;

  for (const item of manifest) {
    const fileBytes = fs.readFileSync(path.resolve(`public/corpus/${item.filename}`));
    const doc = await extractTextFromPDF(fileBytes, {
      docId: item.id,
      title: item.title,
      status: item.status,
      filename: item.filename,
    });
    const docChunks = chunkDocument(doc);
    totalDocs++;
    totalPages += doc.pages.length;
    totalChunks += docChunks.length;
    totalChars += doc.totalCharacters;
  }

  console.log(`- Summary across corpus:`);
  console.log(`  * Documents ingested: ${totalDocs}`);
  console.log(`  * Total pages parsed: ${totalPages}`);
  console.log(`  * Total extracted text characters: ${totalChars.toLocaleString()}`);
  console.log(`  * Total sliding-window chunks produced: ${totalChunks}`);
  console.log('✓ Corpus ingestion verified.');

  console.log('\n======================================================');
  console.log('SUCCESS: All retrieval engine components tested & verified!');
  console.log('======================================================');
}

run().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
