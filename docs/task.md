# Production-Grade Advanced RAG (Tasks)

- `[x]` **Query Router**: Implement `classifyQuery` to detect intent (`lookup`, `aggregation`, `comparison`, `negative`, `summary`) and extract metadata constraints.
- `[ ]` **Advanced Chunking**: Refine `rag-store.ts` regex to handle nested structure (e.g., "Section 1.2.3") and preserve semantic boundaries completely.
- `[x]` **LLM Reranker**: Implement an ultra-fast Groq-based reranking prompt to filter/score retrieved chunks from the RRF hybrid search.
- `[ ]` **Multi-Mode Generator**: Implement strict extraction vs. synthesis prompts based on routing logic, with enforced citation formats `[Section X - Page Y]`.
- `[x]` **Grounding Validator**: Add the final validation loop to verify all generator claims against the provided context.
- `[ ]` **UI Integration**: Update the frontend to show the "pipeline execution trace" (Routing -> Retrieving -> Synthesizing -> Validating).
