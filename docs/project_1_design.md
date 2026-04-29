# Production-Grade Structured Document QA Pipeline

## Goal Description
Upgrade the existing Document Analysis portfolio project from a basic semantic search tool into an enterprise-grade RAG (Retrieval-Augmented Generation) pipeline. This upgrade will demonstrate profound knowledge of modern LLM architectures, incorporating query routing, hybrid retrieval, reranking, and multi-stage output validation.

## Proposed Architecture

A production RAG pipeline cannot rely on a single `User Query -> Retrieval -> LLM -> Answer` flow. It requires a multi-agent orchestration pattern to ensure high accuracy and mitigate hallucinations.

### Core Modules

1. **Query Engine (The Router/Classifier)**
   - Before retrieval, an initial LLM call analyzes the user query.
   - It classifies the query type: `section_lookup`, `aggregation`, `comparison`, `negative_verification`, or `summary`.
   - It extracts metadata constraints (e.g., target section number, target page).

2. **Advanced Retrieval Pipeline**
   - **Hybrid Retrieval**: Execute Vector Search (Semantic) AND BM25 (Keyword) simultaneously over the vector store.
   - **Pre-filtering**: Apply extracted metadata from the Query Engine to narrow down the search space *before* vector distance calculation.
   - **Reranking**: An LLM or Cross-Encoder (like Cohere Rerank API, or simply a secondary fast LLM prompt) processes the Top 20 retrieved chunks and assigns relevance scores, pruning chunks that don't actually answer the query.

3. **Generator Engine**
   - **Modes**: Two distinct prompts based on the Query Engine classification:
     - *Strict Extraction*: For lookup queries. Focuses on returning verbatim text or stating "Not found".
     - *Structured Synthesis*: For aggregations and summaries. Focuses on synthesizing points into lists.
   - **Handling Negatives**: If the query is "Does Section 5 require X?", the Engine actively checks retrieved chunks strictly from Section 5. If "X" isn't found, it defaults to a definitive "No, based on Section 5..." rather than hallucinating from Section 6.

4. **Validator Layer (Self-Correction)**
   - **Grounding Validator**: A final, fast LLM call that receives the generated Answer and the Retrieved Chunks. It acts as an evaluator: *Does every claim in the answer exist in the context?* If no, it flags or rewrites the answer.
   - **Completeness Checker**: For aggregation queries, it checks if the answer fully addresses the prompt based on the retrieved context volume.

## Proposed Changes

### Next.js Backend Components
#### [MODIFY] `app/api/chat/route.ts`
- Implement the orchestration logic (Query Router -> Retrievers -> Reranker -> Generator -> Validator).
- Implement streaming using LangChain's intermediate step callbacks to push progress to the frontend (e.g., "Routing query...", "Retrieving documents...", "Validating answer...").

#### [MODIFY] `app/lib/rag-store.ts`
- **Structure-Aware Chunking**: Enhance existing regex splitting to guarantee chunking by `<h1>`, `<h2>`, or Section headers rigorously, tagging every chunk with rich metadata.
- **Reranker Integration**: Add a function to submit hybrid retrieval results to a reranking prompt.

### UI Enhancements
#### [MODIFY] `app/rag-chat/page.tsx`
- Add a UI element showing the "Pipeline Status" to flex your architecture to recruiters (e.g., seeing the app routing, reranking, and validating live).
- Enhance citations to clearly show `[Section X - Page Y]` badges that link precisely to the parsed document.

## Evaluation Metrics

To prove this is "production-grade", we will implement an evaluation capability that measures:
1. **Faithfulness / Grounding**: % of sentences in the generated answer supported by context.
2. **Context Precision (Reranker efficacy)**: Are the highly ranked chunks actually relevant?
3. **Answer Relevance**: Does the generated answer completely satisfy the prompt constraints?
4. **Latency**: Tracking the performance cost of the multi-agent orchestration.

---

## User Review Required

> [!IMPORTANT]
> The complexity of this system increases the latency of a single text response (due to 3-4 LLM calls per query instead of 1). 
> 
> **Open Decisions for your review:**
> 1. **Model Hierarchy**: Do you want to use the Groq Llama 3 API for *all* steps to keep it blazing fast, or use Gemini for the heavy Generator and Groq for the fast Routing/Validation steps?
> 2. **Reranker**: Do you want to build a custom LLM prompt for reranking, or integrate a dedicated API like Cohere Rerank? (For a portfolio, a custom LLM reranker shows more underlying knowledge).
> 3. **Orchestration Tool**: Do you want to implement this using pure LangChain/LangGraph, or write the orchestration cleanly in TypeScript (often easier to debug)?
