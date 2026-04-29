import { NextRequest } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { embedQuery } from "@/app/lib/embeddings";
import { hybridTopK, EvalScores, RetrievedChunk } from "@/app/lib/rag-store";

export const runtime = "nodejs";
export const maxDuration = 60;

function getGroq() {
  return new ChatGroq({
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0.0,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryIntent = "lookup" | "aggregation" | "comparison" | "negative" | "summary";

interface QueryRoute {
  intent: QueryIntent;
  sectionRef?: string;
  rewrittenQuery: string;
}

// ── Step 1: Query router ──────────────────────────────────────────────────────

async function routeQuery(question: string): Promise<QueryRoute> {
  const sectionRef = question.match(/section\s+(\d+(?:\.\d+)*)/i)?.[1];

  try {
    const res = await getGroq().invoke([
      new SystemMessage(
        `Classify the user's document question intent and rewrite for retrieval.

Intents:
- lookup: specific fact, definition, or section content
- aggregation: list, enumerate, count multiple items or obligations
- comparison: compare two or more things
- negative: asking what is NOT present, NOT required, or excluded
- summary: general overview

Rewrite rules:
- Preserve exact section/page references verbatim
- Add at most 3 relevant keywords
- Keep under 15 words

Return ONLY valid JSON: { "intent": "...", "rewrittenQuery": "..." }`
      ),
      new HumanMessage(question),
    ]);

    const text = typeof res.content === "string" ? res.content : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no json");
    const parsed = JSON.parse(m[0]);
    const rewritten = (parsed.rewrittenQuery ?? question).trim();
    return {
      intent: parsed.intent ?? "lookup",
      sectionRef,
      rewrittenQuery: rewritten.split(/\s+/).length <= 20 ? rewritten : question,
    };
  } catch {
    return { intent: "lookup", sectionRef, rewrittenQuery: question };
  }
}

// ── Step 2: LLM reranker ──────────────────────────────────────────────────────

async function rerank(
  question: string,
  chunks: RetrievedChunk[],
  topN = 4
): Promise<RetrievedChunk[]> {
  if (chunks.length <= topN) return chunks;
  try {
    const candidates = chunks
      .map((c, i) => `[${i}] Section ${c.sectionNum}: ${c.text.slice(0, 200)}`)
      .join("\n\n");

    const res = await getGroq().invoke([
      new SystemMessage(
        `You are a retrieval reranker. Return indices of the ${topN} most relevant passages as a JSON array, e.g. [2, 0, 4, 1]. Return ONLY the array.`
      ),
      new HumanMessage(`Question: ${question}\n\nCandidates:\n${candidates}`),
    ]);

    const text = typeof res.content === "string" ? res.content : "";
    const m = text.match(/\[[\d,\s]+\]/);
    if (!m) return chunks.slice(0, topN);
    const indices: number[] = JSON.parse(m[0]);
    return indices
      .filter((i) => i >= 0 && i < chunks.length)
      .slice(0, topN)
      .map((i) => chunks[i]);
  } catch {
    return chunks.slice(0, topN);
  }
}

// ── Step 3: Multi-mode generator ─────────────────────────────────────────────

// Shared governance rules prepended to every prompt
const GOVERNANCE = `ANSWER GOVERNANCE RULES (non-negotiable):
1. Only state what is explicitly written or clearly implied in the context.
2. Never infer, assume, or extrapolate beyond the text.
3. If information is absent, say "The document does not mention [X]" — never speculate.
4. Every factual claim must map directly to a [Source N] citation.
5. Do not paraphrase so loosely that meaning changes.`;

const SYSTEM_PROMPTS: Record<QueryIntent, string> = {
  lookup: `${GOVERNANCE}

You are performing exact extraction from a document.
- Find and quote the specific information requested.
- Cite every fact as [Section X – Page Y].
- If the section exists but does not contain the requested info, say so explicitly.
- If the section does not exist in the retrieved context, say "Section X was not found in the retrieved chunks."`,

  aggregation: `${GOVERNANCE}

You are performing complete enumeration from a document.
PIPELINE:
1. Extract every relevant item from ALL sources — do not skip any.
2. Classify each item into one of: Regulatory Obligation | Administrative Data | Form Metadata | Instruction.
3. Deduplicate — if the same obligation appears in multiple sections, list it once and note all source locations.
4. Present as a categorized numbered list.
5. After listing, state the total count and confirm: "I have checked all [N] retrieved sections."
Cite each item as [Section X – Page Y].`,

  comparison: `${GOVERNANCE}

You are performing structured comparison from a document.
- Present differences and similarities clearly (use a table if 3+ attributes).
- Cite each point as [Section X – Page Y].
- Do not infer relationships not stated in the document.
- Explicitly state what is the same and what differs.`,

  negative: `${GOVERNANCE}

You are answering a question about absent or excluded content.
VERIFICATION STEPS:
1. First, locate the relevant section(s) in the context. State which sections you checked.
2. Scan each section carefully for any mention of the queried topic.
3. Only after checking ALL retrieved sections, state whether it is present or absent.
4. Use the phrase "The document does not mention [X] in [Sections checked]" — never say "X is not required" unless the document explicitly states that.
5. Cite with [Section X – Page Y] wherever absence is implied or stated.`,

  summary: `${GOVERNANCE}

You are producing a structured document summary.
- Group related information logically by topic, not by source order.
- Cite each point as [Section X – Page Y].
- Do not add interpretive commentary.
- End with: "Summary covers [N] sections. The following sections were not retrieved: [list if any obvious gaps]."`,
};

async function generateAnswer(
  question: string,
  intent: QueryIntent,
  chunks: RetrievedChunk[]
): Promise<string> {
  const context = chunks
    .map((c, i) =>
      `[Source ${i + 1} | Section ${c.sectionNum}${c.sectionTitle ? ` – ${c.sectionTitle}` : ""} | Page ${c.pageNum}]:\n${c.text}`
    )
    .join("\n\n---\n\n");

  const res = await getGroq().invoke([
    new SystemMessage(SYSTEM_PROMPTS[intent]),
    new HumanMessage(`Context:\n\n${context}\n\nQuestion: ${question}`),
  ]);

  return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
}

// ── Step 4: Claim-by-claim grounding validator ────────────────────────────────

async function verifyGrounding(
  context: string,
  answer: string
): Promise<{ grounded: boolean; issue?: string; unsupportedClaims?: string[] }> {
  try {
    const res = await getGroq().invoke([
      new SystemMessage(
        `You are a strict grounding auditor for a document QA system.

For each factual claim in the answer:
1. Check whether it is explicitly supported by the provided context.
2. Flag any claim that is inferred, assumed, or not present in the context.

Return ONLY valid JSON:
{
  "grounded": true/false,
  "issue": "brief summary or null",
  "unsupportedClaims": ["claim 1", "claim 2"] or []
}`
      ),
      new HumanMessage(`Context:\n${context.slice(0, 2000)}\n\nAnswer:\n${answer}`),
    ]);

    const text = typeof res.content === "string" ? res.content : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { grounded: true };
    const p = JSON.parse(m[0]);
    return {
      grounded: !!p.grounded,
      issue: p.issue ?? undefined,
      unsupportedClaims: p.unsupportedClaims ?? [],
    };
  } catch {
    return { grounded: true };
  }
}

// ── Step 5: Aggregation completeness checker ─────────────────────────────────

const COMPLETENESS_RE = /\b(list|all|every|each|summarize all|what are the|enumerate)\b/i;

async function checkCompleteness(
  question: string,
  context: string,
  answer: string
): Promise<{ complete: boolean; missed?: string[] }> {
  try {
    const res = await getGroq().invoke([
      new SystemMessage(
        `You are a completeness auditor for document QA.
Check whether the answer covers ALL items present in the context that are relevant to the question.
Look for items that appear in the context but are missing from the answer.
Return ONLY valid JSON: { "complete": true/false, "missed": ["item1", ...] or [] }`
      ),
      new HumanMessage(`Question: ${question}\n\nContext:\n${context.slice(0, 2000)}\n\nAnswer:\n${answer}`),
    ]);

    const text = typeof res.content === "string" ? res.content : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { complete: true };
    const p = JSON.parse(m[0]);
    return { complete: !!p.complete, missed: p.missed ?? [] };
  } catch {
    return { complete: true };
  }
}

// ── Step 6: Eval ──────────────────────────────────────────────────────────────

async function evaluateAnswer(
  question: string,
  context: string,
  answer: string
): Promise<EvalScores> {
  try {
    const res = await getGroq().invoke([
      new SystemMessage(
        `You are an RAG evaluation expert. Score 0-100 (integer only).
Return ONLY valid JSON: { "faithfulness": N, "answerRelevance": N, "contextRelevance": N, "factuality": N }`
      ),
      new HumanMessage(
        `Question: ${question}\n\nContext:\n${context.slice(0, 2000)}\n\nAnswer:\n${answer}`
      ),
    ]);
    const text = typeof res.content === "string" ? res.content : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no json");
    const s = JSON.parse(m[0]);
    const clamp = (v: number) => Math.min(100, Math.max(0, v ?? 70));
    const f = clamp(s.faithfulness), ar = clamp(s.answerRelevance),
          cr = clamp(s.contextRelevance), fa = clamp(s.factuality);
    return {
      faithfulness: f, answerRelevance: ar,
      contextRelevance: cr, factuality: fa,
      confidence: Math.round((f + ar + cr + fa) / 4),
    };
  } catch {
    return { faithfulness: 70, answerRelevance: 70, contextRelevance: 70, factuality: 70, confidence: 70 };
  }
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function encodeEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { sessionData, question } = await request.json();

  if (!sessionData || !question) {
    return Response.json({ error: "sessionData and question are required" }, { status: 400 });
  }

  const { chunks, idf, avgChunkLen } = sessionData;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return Response.json({ error: "Invalid session data. Please re-upload your document." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Route
        controller.enqueue(encodeEvent("stage", { stage: "routing", label: "Routing query…" }));
        const route = await routeQuery(question);
        controller.enqueue(encodeEvent("route", {
          intent: route.intent,
          rewrittenQuery: route.rewrittenQuery !== question ? route.rewrittenQuery : undefined,
        }));

        // Stage 2: Retrieve
        controller.enqueue(encodeEvent("stage", { stage: "retrieving", label: "Retrieving chunks…" }));
        const queryVec = await embedQuery(route.rewrittenQuery);

        const topK = route.intent === "aggregation" ? 12 : 10;
        const candidates = hybridTopK(
          queryVec, route.rewrittenQuery,
          chunks, idf, avgChunkLen, topK
        );

        // Stage 3: Rerank
        controller.enqueue(encodeEvent("stage", { stage: "reranking", label: "Reranking…" }));
        // Aggregation keeps more chunks for completeness
        const keepN = route.intent === "aggregation" ? 6 : 4;
        const topChunks = await rerank(question, candidates, keepN);

        controller.enqueue(encodeEvent("sources", {
          sources: topChunks.map((c, i) => ({
            label: `Source ${i + 1}`,
            citation: `Page ${c.pageNum} – Section ${c.sectionNum}: ${c.sectionTitle}`.trim(),
            preview: c.text.slice(0, 300).trim(),
            sectionMatch: c.sectionMatch,
            sectionLevel: c.sectionLevel,
          })),
        }));

        // Stage 4: Synthesise
        controller.enqueue(encodeEvent("stage", { stage: "synthesising", label: "Synthesising answer…" }));
        const context = topChunks
          .map((c, i) =>
            `[Source ${i + 1} | Section ${c.sectionNum} – ${c.sectionTitle} | Page ${c.pageNum}]:\n${c.text}`
          )
          .join("\n\n---\n\n");

        const answer = await generateAnswer(question, route.intent, topChunks);
        controller.enqueue(encodeEvent("answer", { answer }));

        // Stage 5: Validate
        controller.enqueue(encodeEvent("stage", { stage: "validating", label: "Validating…" }));
        const needsCompleteness = COMPLETENESS_RE.test(question) || route.intent === "aggregation";

        const [evalScores, grounding, completeness] = await Promise.all([
          evaluateAnswer(question, context, answer),
          verifyGrounding(context, answer),
          needsCompleteness
            ? checkCompleteness(question, context, answer)
            : Promise.resolve({ complete: true }),
        ]);

        controller.enqueue(encodeEvent("eval", {
          evalScores,
          grounding,
          completeness: needsCompleteness ? completeness : undefined,
        }));

        controller.enqueue(encodeEvent("done", {}));
      } catch (err: unknown) {
        controller.enqueue(encodeEvent("error", {
          error: err instanceof Error ? err.message : "Internal error",
        }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
