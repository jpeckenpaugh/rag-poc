# Client-Only In-Memory Browser RAG Proof-of-Concept

[![Deploy to GitHub Pages](https://github.com/jpeckenpaugh/rag-poc/actions/workflows/deploy.yml/badge.svg)](https://github.com/jpeckenpaugh/rag-poc/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2563eb)](https://jpeckenpaugh/rag-poc/)

> **Live Demo:** [https://jpeckenpaugh.github.io/rag-poc/](https://jpeckenpaugh.github.io/rag-poc/)

A **100% client-side, zero-backend Retrieval-Augmented Generation (RAG)** single-page application running entirely inside modern web browsers. All document parsing, text chunking, ONNX embedding generation, vector similarity indexing, and large language model generation occur locally on your machine with zero server-side compute or external API calls.

---

## 🚀 Key Highlights & Architectural Overview

```mermaid
flowchart TD
    subgraph Browser["Client Browser Sandbox (Zero Backend / Zero External APIs)"]
        subgraph Ingestion["1. Ingestion & Chunking"]
            PDFs["21 Operational PDFs (64 pages)"] -->|pdfjs-dist| Extractor["Per-Page Text Extractor"]
            Extractor -->|500 char sliding window / 100 char overlap| Chunker["Chunker + Metadata Header Prefix"]
        end

        subgraph Embeddings["2. Embedding Pipeline"]
            Chunker -->|367 chunks| WebWorker["Dedicated Web Worker (Comlink / Worker API)"]
            WebWorker -->|@huggingface/transformers / ONNX WASM| MiniLM["Xenova/all-MiniLM-L6-v2 (384d Normalized)"]
        end

        subgraph VectorStore["3. In-Memory Vector Store"]
            MiniLM -->|Contiguous Typed Arrays| FloatArray["Float32Array Heap Store (~564 KB RAM)"]
            QueryText["User Query"] -->|Embed Query| QueryVec["Query Vector (384d)"]
            QueryVec -->|Linear Dot Product O(N)| VectorSearch["Top-K Cosine Similarity Scan"]
            FloatArray --> VectorSearch
        end

        subgraph Grounding["4. Grounding & Generation"]
            VectorSearch -->|Top Matched Chunks + Citations| PromptEngine["Prompt Assembler & Anti-Hallucination Guardrails"]
            PromptEngine -->|System + Grounded Context| WebLLM["@mlc-ai/web-llm (WebGPU Acceleration)"]
            WebLLM -.->|Llama-3.2-1B-Instruct-q4f16_1-MLC| LLMGen["Streaming Grounded Answer"]
            VectorSearch -.->|WebGPU Fallback Mode| SemanticView["Interactive Semantic Retrieval View"]
        end

        subgraph Inspectability["5. Developer Inspectability Drawer"]
            Chunker --> DevChunks["1. Chunks & Metadata Inspector"]
            FloatArray --> DevVectors["2. Vector Math & Dimensions"]
            VectorSearch --> DevScores["3. Similarity Scoring Breakdown"]
            PromptEngine --> DevPrompt["4. Raw Assembled Prompt Preview"]
            BrowserInfo["WebGPU / Web Worker / Heap"] --> DevDiag["5. Runtime Diagnostics"]
        end
    end
```

### Architectural Principles

1. **Zero Backend Required:** Fully static bundle hosted on GitHub Pages. No backend microservices, vector databases (like Pinecone or Weaviate), or cloud LLM endpoints (like OpenAI or Anthropic).
2. **Private & Secure:** Your queries, documents, embeddings, and completions never leave your browser sandbox.
3. **In-Memory Heap Vector Index:** 367 chunk embeddings stored as contiguous `Float32Array` buffers directly in JavaScript memory. Similarity search runs via high-speed linear dot-product vector mathematics ($O(N)$, $< 2\text{ ms}$ for the entire corpus).
4. **WebGPU Local Inference:** Powered by `@mlc-ai/web-llm` running `Llama-3.2-1B-Instruct-q4f16_1-MLC` (~880 MB weights cached locally in browser Cache Storage).
5. **Graceful Fallback:** Automatically detects WebGPU support (`navigator.gpu`). If WebGPU is unavailable or disabled, the app falls back to **Semantic Retrieval Mode**, displaying ranked chunk matches, cosine similarity scores, and source evidence.
6. **Educational DevTools:** A built-in developer drawer exposes raw chunking, vector norms, similarity math breakdown, and assembled system prompts.

---

## 📚 The Corpus: Northstar Urgent Care Cooperative

The demo is preloaded with the official operational non-clinical policy corpus of **Northstar Urgent Care Cooperative**:

* **Documents:** 21 operational policy and governance PDFs (`NU-OPS-001` through `NU-OPS-021`).
* **Page Count:** 64 total pages of operational standards, governance, facilities, and access controls.
* **Indexed Chunks:** 367 chunks with rich metadata headers (`[Document: NU-OPS-XXX.pdf | Title: ... | Status: Active | Page: Y]`).
* **Total Vector Memory:** ~564 KB RAM in standard `Float32Array` buffers.

---

## 🧪 Evaluation Benchmark & Guardrail Queries

The application features a dedicated **Evaluation Query Bar** with 15 pre-configured benchmark queries:

### 1. Answerable Queries (10 Queries)
These test precise semantic retrieval and accurate citation attribution:
* **Q-001:** Routine site opening handoff requirements (`NU-OPS-002.pdf`, p. 2)
* **Q-002:** Scheduled Harbor Point after-hours exception window (`NU-OPS-004.pdf`, p. 1)
* **Q-003:** Current facilities procedure vs superseded edition (`NU-OPS-003.pdf`, p. 1; `NU-OPS-016.pdf`, p. 1)
* **Q-004:** Schedule request approval requirements (`NU-OPS-005.pdf`, p. 2)
* **Q-005:** Staffing shortage escalation tier 1 and tier 2 (`NU-OPS-006.pdf`, p. 1)
* **Q-006:** Temporary badge issuance retention and retrieval log (`NU-OPS-007.pdf`, p. 2)
* **Q-007:** Lost property logged in locked storage duration (`NU-OPS-008.pdf`, p. 1)
* **Q-008:** Minor spill kit contents and maximum threshold (`NU-OPS-009.pdf`, p. 1)
* **Q-009:** Clean linen delivery verification discrepancy notation (`NU-OPS-010.pdf`, p. 2)
* **Q-010:** Courier pickup temperature-sensitive specimen pouch status (`NU-OPS-011.pdf`, p. 2)

### 2. Negative & Guardrail Queries (5 Queries)
These test strict grounding and anti-hallucination guardrails where the policy corpus does not contain the answer:
* **Q-011 (Clinical Triage):** Adult chest pain dosage recommendations *(Correct response: Abstain; policies are strictly non-clinical administrative documents)*
* **Q-012 (Out of Scope Facility):** Downtown Clinic pediatric weekend urgent care hours *(Correct response: Abstain; Downtown Clinic is not in the cooperative directory)*
* **Q-013 (Medical Device):** Site Lead calibration procedure for GE ultrasound machines *(Correct response: Abstain; no ultrasound calibration protocol exists in the corpus)*
* **Q-014 (Financial / Billing):** Sliding-fee discount schedule for uninsured patients *(Correct response: Abstain; billing and charity care policies are outside the operational corpus)*
* **Q-015 (Unverified Rumor):** Closing date for West End site consolidation *(Correct response: Abstain; no West End closure or consolidation is authorized in active policy)*

---

## 🛠️ Developer Inspectability & Educational Features

Open the **DevTools Drawer** at the bottom of the screen to explore each phase of the RAG pipeline:

1. **Chunks Inspector:** Search, filter, and inspect all 367 extracted chunks, complete with source PDF, page numbers, character lengths, and metadata tags.
2. **Search & Vector Math:** View the 384-dimensional query vector, Top-$K$ retrieved matches, and exact cosine similarity score calculations:
   $$\text{Similarity}(q, c) = \frac{\mathbf{q} \cdot \mathbf{c}}{\|\mathbf{q}\| \|\mathbf{c}\|}$$
3. **Prompt Preview:** View the exact system prompt, ground truth constraints, citation requirements, and formatted context snippets passed to the LLM.
4. **Diagnostics:** Inspect real-time client diagnostics, including WebGPU adapter info, Web Worker status, in-memory heap footprint, and cache utilization.

---

## 💻 Local Development & Build

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22+
- npm v10+
- A modern browser (Chrome 113+, Edge 113+, Safari 18+, or Firefox Nightly) for WebGPU acceleration.

### Getting Started

```bash
# Clone the repository
git clone https://github.com/jpeckenpaugh/rag-poc.git
cd rag-poc

# Install dependencies
npm install

# Start the Vite local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

```bash
# Type check and build optimized static assets
npm run build

# Preview production build locally
npm run preview
```

The compiled output will be generated in `dist/`.

---

## 🚢 Continuous Deployment

This repository uses GitHub Actions (`.github/workflows/deploy.yml`) to automatically build and deploy to GitHub Pages on every push to the `main` branch.

To enable GitHub Pages in your own fork:
1. Navigate to **Settings > Pages** in your GitHub repository.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Push to `main` to trigger the build and deployment.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
