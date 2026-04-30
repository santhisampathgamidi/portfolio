"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_RAG_SCRATCH_URL || "http://localhost:8000";

const MAX_TEXT = 20_000;
const MAX_QUERY = 500;

type Status = "idle" | "warming" | "running" | "done" | "error";

interface ChunkOut {
  id: number;
  text: string;
  start: number;
  end: number;
  chars: number;
}

interface EmbedOut {
  id: number;
  dim: number;
  norm: number;
  preview: number[];
}

interface SearchHit {
  chunk_id: number;
  score: number;
  text: string;
  rank: number;
}

interface RunResult {
  chunks: ChunkOut[];
  embeddings: EmbedOut[];
  embedMs: number;
  hits: SearchHit[];
  searchMs: number;
}

const CHUNK_PALETTE = [
  { bg: "rgba(168, 85, 247, 0.18)", border: "rgba(168, 85, 247, 0.55)", text: "text-purple-300" }, // purple
  { bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.55)", text: "text-blue-300" },   // blue
  { bg: "rgba(20, 184, 166, 0.18)", border: "rgba(20, 184, 166, 0.55)", text: "text-teal-300" },   // teal
  { bg: "rgba(244, 114, 182, 0.18)", border: "rgba(244, 114, 182, 0.55)", text: "text-pink-300" }, // pink
  { bg: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.55)", text: "text-amber-300" }, // amber
  { bg: "rgba(34, 197, 94, 0.18)", border: "rgba(34, 197, 94, 0.55)", text: "text-emerald-300" }, // emerald
];

const colorFor = (chunkId: number) => CHUNK_PALETTE[chunkId % CHUNK_PALETTE.length];

export default function RagScratchPage() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [chunkSize, setChunkSize] = useState(300);
  const [overlap, setOverlap] = useState(60);
  const [topK, setTopK] = useState(3);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [highlightedChunkId, setHighlightedChunkId] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Load demo corpus on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/demo`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setText(data.text);
        if (data.queries?.length) setQuery(data.queries[0]);
      } catch {
        // network down — leave fields blank, the user can paste.
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = status === "warming" || status === "running";
  const overlapInvalid = overlap >= chunkSize;

  const handleRun = async () => {
    if (isBusy || !text.trim() || !query.trim() || overlapInvalid) return;

    setStatus("warming");
    setErrorMsg("");
    setResult(null);
    setHighlightedChunkId(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const chunkRes = await fetch(`${API_URL}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, chunk_size: chunkSize, overlap }),
        signal,
      });
      if (!chunkRes.ok) {
        const data = await chunkRes.json().catch(() => ({}));
        throw new Error(data.detail || `Chunking failed (${chunkRes.status})`);
      }
      const chunkData = await chunkRes.json();
      const chunks: ChunkOut[] = chunkData.chunks;

      setStatus("running");

      const embedRes = await fetch(`${API_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: chunks.map((c) => c.text) }),
        signal,
      });
      if (!embedRes.ok) {
        const data = await embedRes.json().catch(() => ({}));
        throw new Error(data.detail || `Embedding failed (${embedRes.status})`);
      }
      const embedData = await embedRes.json();

      const searchRes = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          chunks: chunks.map((c) => ({ id: c.id, text: c.text })),
          top_k: topK,
        }),
        signal,
      });
      if (!searchRes.ok) {
        const data = await searchRes.json().catch(() => ({}));
        throw new Error(data.detail || `Search failed (${searchRes.status})`);
      }
      const searchData = await searchRes.json();

      setResult({
        chunks,
        embeddings: embedData.embeddings,
        embedMs: embedData.elapsed_ms,
        hits: searchData.hits,
        searchMs: searchData.search_ms,
      });
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setErrorMsg((err as Error).message || "Network error.");
    }
  };

  const resetToDemo = async () => {
    abortRef.current?.abort();
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/demo`);
      const data = await res.json();
      setText(data.text);
      setQuery(data.queries[0]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-purple-400 transition-colors">
            ← Back to portfolio
          </Link>
          <span className="text-xs font-mono text-emerald-500/70 uppercase tracking-widest">
            ✦ Live Demo
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">
            RAG <span className="gradient-text">From Scratch</span>
          </h1>
          <div className="section-divider" />
          <p className="text-slate-400 max-w-2xl">
            See every primitive that makes a RAG system work. Paste text, watch it get sliced into
            overlapping chunks, embedded into 384-dim vectors, then ranked by cosine similarity to
            your query — no LangChain, no vector DB, just numpy and{" "}
            <code className="text-purple-400">sentence-transformers</code>.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["FastAPI", "sentence-transformers", "all-MiniLM-L6-v2", "numpy", "Docker", "Render"].map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-1 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Step 1 — Source text + chunking knobs */}
        <Section step={1} title="Source text" subtitle="Paste any passage, or use the bundled solar-system corpus.">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              placeholder="Paste a few paragraphs to chunk and search…"
              className="w-full bg-[#0d0d17] border border-slate-800 rounded-xl p-4 pr-20 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 min-h-[160px] resize-y font-mono text-sm leading-relaxed transition-colors"
              disabled={isBusy}
              maxLength={MAX_TEXT}
            />
            <span className="absolute bottom-3 right-4 text-xs font-mono text-slate-600">
              {text.length}/{MAX_TEXT}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Slider label="Chunk size (chars)" value={chunkSize} min={50} max={1000} step={10} onChange={setChunkSize} disabled={isBusy} />
            <Slider label="Overlap (chars)" value={overlap} min={0} max={500} step={10} onChange={setOverlap} disabled={isBusy} />
          </div>
          {overlapInvalid && (
            <p className="text-xs text-red-400 font-mono mt-2">overlap must be &lt; chunk size</p>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={resetToDemo}
              className="text-xs text-slate-500 hover:text-purple-400 underline underline-offset-2"
            >
              Reset to demo corpus
            </button>
          </div>
        </Section>

        {/* Step 2 — Query + run */}
        <Section step={2} title="Query" subtitle="What do you want to retrieve from the text?">
          <div className="space-y-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY))}
              placeholder='e.g. "What is the largest planet?"'
              disabled={isBusy}
              maxLength={MAX_QUERY}
              className="w-full bg-[#0d0d17] border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 transition-colors"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Slider label="Top-K" value={topK} min={1} max={10} step={1} onChange={setTopK} disabled={isBusy} compact />
              <button
                type="button"
                onClick={handleRun}
                disabled={isBusy || !text.trim() || !query.trim() || overlapInvalid}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isBusy ? (status === "warming" ? "Warming model…" : "Running pipeline…") : "Run pipeline"}
              </button>
              {status === "warming" && (
                <Badge tone="amber" pulse>Render cold start ~30s on first call</Badge>
              )}
              {status === "running" && <Badge tone="blue">⚡ Embedding + searching…</Badge>}
              {status === "done" && result && (
                <Badge tone="emerald">
                  ✓ {result.chunks.length} chunks · embed {result.embedMs.toFixed(0)}ms · search {result.searchMs.toFixed(0)}ms
                </Badge>
              )}
              {status === "error" && <Badge tone="red">⚠ Error</Badge>}
            </div>

            {errorMsg && <p className="text-red-400 text-sm font-mono">{errorMsg}</p>}
          </div>
        </Section>

        {/* Step 3 — Chunks visualisation */}
        {result && (
          <Section step={3} title="Chunks" subtitle={`${result.chunks.length} windows of ≤${chunkSize} chars with ${overlap} chars of overlap. Hover a chunk to highlight it in the text.`}>
            <ChunkedText text={text} chunks={result.chunks} highlightedChunkId={highlightedChunkId} />
            <div className="mt-4 flex flex-wrap gap-2">
              {result.chunks.map((c) => {
                const color = colorFor(c.id);
                const isHl = highlightedChunkId === c.id;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setHighlightedChunkId(c.id)}
                    onMouseLeave={() => setHighlightedChunkId(null)}
                    className={`text-xs font-mono px-2 py-1 rounded border transition-all ${color.text}`}
                    style={{
                      backgroundColor: color.bg,
                      borderColor: color.border,
                      transform: isHl ? "translateY(-1px)" : undefined,
                      boxShadow: isHl ? `0 0 12px ${color.border}` : undefined,
                    }}
                  >
                    #{c.id} · {c.chars} chars · [{c.start}–{c.end}]
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Step 4 — Embeddings */}
        {result && (
          <Section step={4} title="Embeddings" subtitle={`Each chunk → a 384-dim vector. Sparkline shows the first 32 dims; norm is the vector's L2 magnitude.`}>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.embeddings.map((e) => {
                const color = colorFor(e.id);
                return (
                  <div
                    key={e.id}
                    className="rounded-lg border bg-[#0d0d17] p-3 flex items-center gap-3"
                    style={{ borderColor: color.border }}
                    onMouseEnter={() => setHighlightedChunkId(e.id)}
                    onMouseLeave={() => setHighlightedChunkId(null)}
                  >
                    <span className={`text-xs font-mono ${color.text} w-10 shrink-0`}>#{e.id}</span>
                    <Sparkline values={e.preview} stroke={color.border} />
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">‖v‖={e.norm.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Step 5 — Search results */}
        {result && (
          <Section step={5} title="Top results" subtitle={`Cosine similarity between the query embedding and each chunk embedding. Higher is more semantically similar.`}>
            <div className="space-y-3">
              {result.hits.map((hit) => {
                const color = colorFor(hit.chunk_id);
                return (
                  <div
                    key={hit.chunk_id}
                    className="rounded-lg border bg-[#0d0d17] p-4"
                    style={{ borderColor: color.border }}
                    onMouseEnter={() => setHighlightedChunkId(hit.chunk_id)}
                    onMouseLeave={() => setHighlightedChunkId(null)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-slate-500 w-10">#{hit.rank + 1}</span>
                      <span className={`text-xs font-mono ${color.text}`}>chunk #{hit.chunk_id}</span>
                      <ScoreBar score={hit.score} color={color.border} />
                      <span className="text-xs font-mono text-slate-400 ml-auto tabular-nums">
                        {hit.score.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-mono">{hit.text}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer hover:text-purple-400 transition-colors">
            What&apos;s happening behind this UI?
          </summary>
          <ul className="mt-3 space-y-2 pl-4 list-disc text-slate-500">
            <li>
              <code className="text-purple-400">/chunk</code> slides a fixed-size window across the
              text. <code className="text-purple-400">step = chunk_size − overlap</code>.
            </li>
            <li>
              <code className="text-purple-400">/embed</code> runs each chunk through{" "}
              <code className="text-purple-400">all-MiniLM-L6-v2</code> (~22M params, 384-dim
              output). The model is baked into the Docker image so cold start is fast.
            </li>
            <li>
              <code className="text-purple-400">/search</code> embeds the query, then computes{" "}
              <code className="text-purple-400">cos(q, c) = (q·c) / (‖q‖·‖c‖)</code> against every
              chunk vector with numpy. No FAISS, no Pinecone — the math is the lesson.
            </li>
            <li>
              Try shrinking <code className="text-purple-400">chunk_size</code> to 100 with no
              overlap and re-running — you&apos;ll see retrieval quality drop because answers get split
              across chunk boundaries. That&apos;s why overlap exists.
            </li>
          </ul>
        </details>
      </main>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-glow bg-[#0d0d17] rounded-xl p-6 border border-slate-800/60">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">Step {step}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

function Slider({
  label, value, min, max, step, onChange, disabled, compact,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean; compact?: boolean;
}) {
  return (
    <label className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col"} text-xs font-mono text-slate-400`}>
      <span className={compact ? "" : "mb-1"}>
        {label}: <span className="text-slate-200">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="accent-purple-500 w-full disabled:opacity-50"
      />
    </label>
  );
}

interface Region {
  start: number;
  end: number;
  chunkIds: number[];
}

function buildRegions(textLength: number, chunks: ChunkOut[]): Region[] {
  if (textLength === 0 || chunks.length === 0) return [];
  // Collect every boundary point so we can split the text into maximal regions
  // that all share the same chunk membership.
  const points = new Set<number>([0, textLength]);
  for (const c of chunks) {
    points.add(c.start);
    points.add(c.end);
  }
  const sorted = Array.from(points).sort((a, b) => a - b);
  const regions: Region[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;
    const chunkIds = chunks.filter((c) => c.start <= start && c.end >= end).map((c) => c.id);
    regions.push({ start, end, chunkIds });
  }
  return regions;
}

function ChunkedText({
  text,
  chunks,
  highlightedChunkId,
}: {
  text: string;
  chunks: ChunkOut[];
  highlightedChunkId: number | null;
}) {
  const regions = useMemo(() => buildRegions(text.length, chunks), [text, chunks]);

  return (
    <div className="rounded-lg border border-slate-800 bg-[#08080d] p-4 max-h-96 overflow-auto">
      <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
        {regions.map((r, i) => {
          const slice = text.slice(r.start, r.end);
          if (r.chunkIds.length === 0) {
            return <span key={i}>{slice}</span>;
          }
          const colors = r.chunkIds.map(colorFor);
          const isHl =
            highlightedChunkId !== null && r.chunkIds.includes(highlightedChunkId);

          let background: string;
          if (colors.length === 1) {
            background = colors[0].bg;
          } else {
            // Striped gradient signals "this character belongs to multiple chunks".
            const stops = colors.map((c, idx) => {
              const a = (idx / colors.length) * 100;
              const b = ((idx + 1) / colors.length) * 100;
              return `${c.bg} ${a}%, ${c.bg} ${b}%`;
            }).join(", ");
            background = `repeating-linear-gradient(45deg, ${stops})`;
          }

          return (
            <span
              key={i}
              style={{
                background,
                outline: isHl ? `1px solid ${colors[0].border}` : undefined,
                borderRadius: "2px",
                padding: "1px 0",
              }}
            >
              {slice}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length === 0) return null;
  const w = 200;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="flex-1 min-w-0" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.2} />
    </svg>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return (
    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden max-w-xs">
      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function Badge({
  children, tone, pulse,
}: {
  children: React.ReactNode;
  tone: "amber" | "blue" | "emerald" | "red";
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full border ${tones[tone]} ${pulse ? "animate-pulse" : ""}`}
    >
      {children}
    </span>
  );
}
