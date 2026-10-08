# Architecture Specification: Client-Only In-Memory Browser RAG

## 1. Executive Summary

This specification outlines the technical design for a zero-backend, 100% client-side Retrieval-Augmented Generation (RAG) system running entirely inside a modern web browser. Designed specifically as a teaching vehicle and a lightweight proof-of-concept, the system ingests a small corpus (~20 corporate PDF documents), computes dense vector representations, executes sub-millisecond similarity search using in-memory typed arrays, and generates grounded answers via WebGPU.

### Key Tenets
* **Zero Backend:** Pure static assets hosted via GitHub Pages or any static CDN.
* **Privacy by Design:** Documents, queries, embeddings, and chat interactions never leave the client's memory.
* **Radical Simplicity:** No relational database or vector indexing extensions (no SQLite, no vector plugins). Vector operations rely on direct flat-matrix vector math (`Float32Array` dot products) over an in-memory collection.
* **Inspectability:** Every transformation stage (parsing $\to$ chunking $\to$ vectorization $\to$ ranking $\to$ generation) can be inspected in browser developer tooling.

---

## 2. System Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              DOM Layer                                 │
 │     [Drag & Drop PDF Target]     [Query Input]     [Response Stream]   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Client Orchestrator (Worker / Main)               │
 └──────────────┬────────────────────────────────────────────┬────────────┘
                │ Ingestion Pipeline                         │ Query Pipeline
                ▼                                            ▼
 ┌──────────────────────────────┐             ┌───────────────────────────┐
 │       Parsing & Chunker      │             │     Query Embedding       │
 │  - PDF.js per-page extractor │             │  - Transformers.js        │
 │  - Sliding window chunker    │             │  - all-MiniLM-L6-v2 ONNX  │
 └──────────────┬───────────────┘             └─────────────┬─────────────┘
                │                                           │ Query Vector
                ▼                                           ▼
 ┌──────────────────────────────┐             ┌───────────────────────────┐
 │      Document Embedding      │             │  In-Memory Vector Search  │
 │  - Transformers.js           │             │  - Linear Scan (O(N))     │
 │  - Normalized Float32Arrays  │             │  - Dot Product Similarity │
 └──────────────┬───────────────┘             └─────────────┬─────────────┘
                │                                           │ Top-K Chunks
                ▼                                           ▼
 ┌────────────────────────────────────────┐   ┌───────────────────────────┐
 │     In-Memory Chunk Store (JS Heap)    │──>│     Prompt Assembler      │
 │  Array<ChunkRecord>                    │   │  - Context + Citations    │
 │  - id, source, page, text, vector      │   └─────────────┬─────────────┘
 └────────────────────────────────────────┘                 │
                                                            ▼
                                              ┌───────────────────────────┐
                                              │    Grounded Generation    │
                                              │  - WebLLM / WebGPU        │
                                              │  - Llama 3.2 1B (q4f16)   │
                                              └───────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Document Ingestion & Extraction (`PDF.js`)
* **Library:** `pdfjs-dist` (loaded as an ES module or via CDN).
* **Process:**
  1. Accepts `File` / `ArrayBuffer` instances via HTML drag-and-drop or preloaded static fetch (`/corpus/*.pdf`).
  2. Iterates pages: `doc.getPage(pageIndex)`.
  3. Extracts raw text strings from text content streams (`getTextContent()`).
  4. Preserves structural page boundaries for citation attribution.

### 3.2 Chunking Engine
* **Strategy:** Character/token-window recursive or sliding-window splitting.
* **Parameters:**
  * Target chunk size: $\approx 500\text{ characters}$ (~100–125 tokens).
  * Overlap: $100\text{ characters}$ (~20% overlap).
  * Minimum chunk threshold: $> 60\text{ characters}$ (discards page numbers, blank lines, and trailing footers).
* **Metadata Attachment:** Every chunk is assigned an immutable metadata descriptor:
  ```typescript
  interface ChunkRecord {
    id: string;              // e.g., "policy_travel_p3_c2"
    source: string;          // Filename (e.g., "travel_policy.pdf")
    page: number;            // 1-indexed page number
    text: string;            // Text payload
    vector: Float32Array;    // Dense embedding (384-dimensional)
  }
  ```

### 3.3 In-Browser Embedding (`Transformers.js`)
* **Engine:** `@huggingface/transformers` running ONNX Runtime Web.
* **Model:** `Xenova/all-MiniLM-L6-v2` (quantized 8-bit, $\approx 23\text{ MB}$).
* **Normalization:** Embeddings are output normalized ($\|v\|_2 = 1$). This enables calculating cosine similarity via dot product without divisor calculations during retrieval.

### 3.4 In-Memory Vector Store & Retrieval
Because the target corpus is bounded (~20 documents, $\approx 500\text{ to }1,500\text{ chunks}$), an indexing structure (HNSW or KD-Tree) adds unnecessary algorithmic overhead.

* **Storage Primitives:** A plain JavaScript array (`ChunkRecord[]`) allocated directly on the heap.
* **Memory Footprint:**
  * $1,500\text{ chunks} \times 384\text{ floats} \times 4\text{ bytes} \approx 2.3\text{ MB}$ of raw vector memory.
  * Total memory footprint including chunk strings and metadata is $\approx 10\text{–}15\text{ MB}$.
* **Search Complexity:**
  * **Brute-Force Linear Scan ($O(N)$):** For query vector $Q$ and candidate chunk vector $V$, similarity is computed via dot product:
    $$\text{Score} = Q \cdot V = \sum_{i=1}^{384} Q_i \cdot V_i$$
  * A full scan over $1,500$ vectors takes $< 2\text{ ms}$ on a single CPU thread.
* **Retrieval Output:** Top-$K$ scored chunks sorted in descending order (typical $K=3\text{ to }5$).

### 3.5 Context Assembly & Grounding Prompt
Retrieved chunks are assembled into a constrained system prompt to minimize hallucination:

```text
You are an internal corporate assistant. Answer the user question strictly using only the context snippets provided below. If the information is not contained in the context, explicitly respond: "I cannot find this information in the provided documentation."

--- CONTEXT SNIPPETS ---
[Source: travel_policy.pdf, Page: 4]
Employees will be reimbursed for meal expenses up to $75 per day.

[Source: travel_policy.pdf, Page: 5]
Alcoholic beverages are not eligible for reimbursement.
------------------------

Question: What is the maximum daily food allowance?
Answer:
```

### 3.6 In-Browser Generator (`WebLLM`)
* **Engine:** `@mlc-ai/web-llm` targeting the browser's native **WebGPU** backend.
* **Model Choices:**
  * Primary: `Llama-3.2-1B-Instruct-q4f16_1-MLC` ($\approx 800\text{ MB}$ download, minimal VRAM usage).
  * Alternative: `gemma-2-2b-it-q4f16_1-MLC` ($\approx 1.4\text{ GB}$ download, higher reasoning fidelity).
* **Caching:** WebLLM automatically stores downloaded model weights in the browser's Cache Storage API, requiring only one download across sessions.

---

## 4. Hardware & Browser Requirements

| Dimension | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Browser** | Chrome 113+, Edge 113+ (WebGPU supported) | Chrome 120+ / Edge 120+ |
| **GPU Acceleration** | Integrated GPU (Intel Iris Xe, Apple M-series) | Apple Silicon (M1+) or Discrete GPU (NVIDIA RTX) |
| **RAM** | 8 GB | 16 GB |
| **Network (Initial)** | Broadband (to download $\approx 850\text{ MB}$ initial models) | Broadband |
| **Network (Post-Init)**| Offline capable | Offline capable |

---

## 5. Failure Modes & Graceful Fallbacks

1. **No WebGPU Available (Unsupported Browser or GPU):**
   * *Fallback:* The application detects `navigator.gpu == undefined` on load.
   * *Behavior:* Embeddings and similarity search run unchanged (CPU/WASM), while the generation step either:
     * Disables generation and operates as a standalone semantic search engine with highlighted passages.
     * Proxies queries to a local Ollama instance (`http://localhost:11434`) via client-side `fetch`.
2. **Tab Eviction & Memory Pressure:**
   * Because chunks live in memory (`JS heap`), refreshing the tab clears indexed data.
   * *Mitigation for Future Iteration:* Cache precomputed `ChunkRecord[]` arrays (without the database engine) into IndexedDB as a serialized array blob for fast resume.

---

## 6. Implementation Milestones (Pedagogical Track)

* [ ] **Milestone 1: Extraction & Inspection:** Load 1 PDF via `pdfjs-dist`, chunk text, and render chunks with source/page badges into HTML cards.
* [ ] **Milestone 2: In-Memory Semantic Search:** Initialize `Transformers.js`, embed chunks, embed input queries, and display top-$K$ cosine matches with similarity scores.
* [ ] **Milestone 3: Grounded In-Browser Generation:** Initialize `WebLLM`, pipe top-$K$ context into the prompt, and stream answers with inline source citations directly into the UI.