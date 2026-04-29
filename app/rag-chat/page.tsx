"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = { label: string; detail: string; done: boolean };

type PipelineStage =
  | "idle" | "routing" | "retrieving" | "reranking" | "synthesising" | "validating" | "done";

interface Source {
  label: string;
  citation: string;
  preview: string;
  sectionMatch: boolean;
  sectionLevel: number;
}

interface EvalScores {
  faithfulness: number;
  answerRelevance: number;
  contextRelevance: number;
  factuality: number;
  confidence: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  sources?: Source[];
  evalScores?: EvalScores;
  rewrittenQuery?: string;
  grounding?: { grounded: boolean; issue?: string; unsupportedClaims?: string[] };
  completeness?: { complete: boolean; missed?: string[] };
}

// ─── Ingest stepper ───────────────────────────────────────────────────────────

const INGEST_STEPS: Omit<Step, "done">[] = [
  { label: "Parsing document",         detail: "Extracting text page-by-page via PDF.js" },
  { label: "Structure-aware chunking", detail: "Detecting section headers · building BM25 index" },
  { label: "Generating embeddings",    detail: "Embedding chunks via Gemini gemini-embedding-001" },
];

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "routing",      label: "Routing" },
  { id: "retrieving",   label: "Retrieving" },
  { id: "reranking",    label: "Reranking" },
  { id: "synthesising", label: "Synthesising" },
  { id: "validating",   label: "Validating" },
];

const INTENT_COLORS: Record<string, string> = {
  lookup:      "text-sky-400 bg-sky-950/40 border-sky-700/40",
  aggregation: "text-violet-400 bg-violet-950/40 border-violet-700/40",
  comparison:  "text-amber-400 bg-amber-950/40 border-amber-700/40",
  negative:    "text-rose-400 bg-rose-950/40 border-rose-700/40",
  summary:     "text-emerald-400 bg-emerald-950/40 border-emerald-700/40",
};

// ─── Eval helpers ─────────────────────────────────────────────────────────────

function scoreLabel(n: number): { tag: string; color: string; bar: string } {
  if (n >= 90) return { tag: "EXCELLENT", color: "text-emerald-400", bar: "bg-emerald-500" };
  if (n >= 75) return { tag: "GOOD",      color: "text-sky-400",     bar: "bg-sky-500" };
  if (n >= 60) return { tag: "FAIR",      color: "text-amber-400",   bar: "bg-amber-500" };
  return           { tag: "POOR",      color: "text-red-400",     bar: "bg-red-500" };
}

function EvalPanel({ scores }: { scores: EvalScores }) {
  const [open, setOpen] = useState(false);
  const rows: [string, number][] = [
    ["Faithfulness",      scores.faithfulness],
    ["Answer Relevance",  scores.answerRelevance],
    ["Context Relevance", scores.contextRelevance],
    ["Factuality",        scores.factuality],
  ];
  const { tag, color } = scoreLabel(scores.confidence);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        <span className={`font-semibold ${color}`}>{tag}</span>
        <span className="text-slate-700">·</span>
        <span>Confidence {scores.confidence}%</span>
        <span className="text-slate-700">{open ? "▲" : "▼"} RAG Eval</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-1">
          {rows.map(([label, score]) => {
            const { tag, color, bar } = scoreLabel(score);
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-32 flex-shrink-0">{label}</span>
                <span className={`text-xs font-semibold w-16 flex-shrink-0 ${color}`}>{tag}</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${bar} rounded-full`} style={{ width: `${score}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{score}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline trace bar ───────────────────────────────────────────────────────

function PipelineTrace({ activeStage }: { activeStage: PipelineStage }) {
  if (activeStage === "idle") return null;
  const doneStages = new Set<string>();
  for (const s of PIPELINE_STAGES) {
    if (s.id === activeStage) break;
    doneStages.add(s.id);
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PIPELINE_STAGES.map((s, i) => {
        const done   = doneStages.has(s.id);
        const active = s.id === activeStage;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-md transition-all ${
              done    ? "text-emerald-400 bg-emerald-950/30" :
              active  ? "text-white bg-purple-700/50 animate-pulse" :
                        "text-slate-700 bg-white/[0.02]"
            }`}>
              {done ? "✓ " : active ? "⟳ " : ""}{s.label}
            </span>
            {i < PIPELINE_STAGES.length - 1 && (
              <span className="text-slate-800 text-xs">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MsgText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split("\n").map((line, li) => (
        <p key={li} className={line === "" ? "h-1" : ""}>
          {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
            j % 2 === 1
              ? <strong key={j} className="font-semibold text-white">{part}</strong>
              : <span key={j}>{part}</span>
          )}
        </p>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RagChatPage() {
  const [phase, setPhase]       = useState<"upload" | "processing" | "workspace">("upload");
  const [stepIdx, setStepIdx]   = useState(0);
  const [stepsData, setStepsData] = useState<Step[]>(INGEST_STEPS.map((s) => ({ ...s, done: false })));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessionData, setSessionData] = useState<any>(null);
  const [numPages, setNumPages]     = useState(0);
  const [numChunks, setNumChunks]   = useState(0);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const timerRefs  = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Upload ─────────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);
    setPhase("processing");
    setStepsData(INGEST_STEPS.map((s) => ({ ...s, done: false })));
    setStepIdx(0);

    const t1 = setTimeout(() => {
      setStepsData((p) => p.map((s, i) => i === 0 ? { ...s, done: true } : s));
      setStepIdx(1);
    }, 900);
    const t2 = setTimeout(() => {
      setStepsData((p) => p.map((s, i) => i <= 1 ? { ...s, done: true } : s));
      setStepIdx(2);
    }, 2000);
    timerRefs.current = [t1, t2];

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      timerRefs.current.forEach(clearTimeout);

      if (!res.ok) {
        const text = await res.text();
        let msg = "Upload failed";
        try { msg = JSON.parse(text).error ?? msg; } catch { /* html */ }
        throw new Error(msg);
      }

      const data = await res.json();
      setStepsData(INGEST_STEPS.map((s) => ({ ...s, done: true })));
      setStepIdx(3);

      setTimeout(() => {
        setSessionData(data.sessionData);
        setNumPages(data.numPages);
        setNumChunks(data.numChunks);
        setMessages([{
          role: "assistant",
          content: `I've processed **${file.name}** — ${data.numPages} page${data.numPages !== 1 ? "s" : ""}, ${data.numChunks} indexed chunks.\n\nAsk me anything about this document.`,
        }]);
        setPhase("workspace");
        setTimeout(() => inputRef.current?.focus(), 100);
      }, 500);
    } catch (err: unknown) {
      timerRefs.current.forEach(clearTimeout);
      setUploadError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("upload");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  // ── Chat (SSE) ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isQuerying) return;

    setInput("");
    setMessages((p) => [...p, { role: "user", content: q }]);
    setIsQuerying(true);
    setPipelineStage("routing");

    // Accumulate partial assistant message
    let partialMsg: ChatMessage = { role: "assistant", content: "" };
    const pushPartial = (update: Partial<ChatMessage>) => {
      partialMsg = { ...partialMsg, ...update };
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant" && last.content === partialMsg.content && !update.content) {
          return [...p.slice(0, -1), partialMsg];
        }
        if (last?.role === "user") return [...p, partialMsg];
        return [...p.slice(0, -1), partialMsg];
      });
    };

    try {
      const res = await fetch("/api/chat-rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionData, question: q }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        let msg = "Query failed";
        try { msg = JSON.parse(text).error ?? msg; } catch { /* html */ }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Add empty assistant message placeholder
      setMessages((p) => [...p, partialMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const events = buf.split("\n\n");
        buf = events.pop() ?? "";

        for (const raw of events) {
          const eventLine = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataLine  = raw.match(/^data:\s*(.+)$/m)?.[1]?.trim();
          if (!eventLine || !dataLine) continue;

          try {
            const payload = JSON.parse(dataLine);
            switch (eventLine) {
              case "stage":
                setPipelineStage(payload.stage as PipelineStage);
                break;
              case "route":
                pushPartial({ intent: payload.intent, rewrittenQuery: payload.rewrittenQuery });
                break;
              case "sources":
                pushPartial({ sources: payload.sources });
                break;
              case "answer":
                pushPartial({ content: payload.answer });
                break;
              case "eval":
                pushPartial({
                  evalScores: payload.evalScores,
                  grounding: payload.grounding,
                  completeness: payload.completeness,
                });
                setPipelineStage("done");
                break;
              case "error":
                pushPartial({ content: `Error: ${payload.error}` });
                setPipelineStage("idle");
                break;
              case "done":
                setPipelineStage("idle");
                break;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") {
          return [...p.slice(0, -1), { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}` }];
        }
        return [...p, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}` }];
      });
      setPipelineStage("idle");
    } finally {
      setIsQuerying(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 50);
    }
  };

  const reset = () => {
    setPhase("upload");
    setMessages([]);
    setSessionData(null);
    setUploadError(null);
    setFileName("");
    setPipelineStage("idle");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0d0d12] text-slate-200 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-600 hover:text-slate-400 transition-colors text-sm">← Portfolio</a>
          <span className="text-white/10">|</span>
          <span className="text-sm font-medium text-slate-300">Document Q&amp;A</span>
          <span className="text-xs bg-purple-950/60 text-purple-400 px-2 py-0.5 rounded-full border border-purple-800/40">
            RAG · Project 1
          </span>
        </div>
        {phase === "workspace" && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-600 truncate max-w-[180px]">{fileName}</span>
            <span className="hidden sm:block text-xs text-slate-700">{numPages}p · {numChunks} chunks</span>
            <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all">
              New document
            </button>
          </div>
        )}
      </header>

      {/* ── Upload ─────────────────────────────────────────────────────────── */}
      {phase === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
          <div className="w-full max-w-2xl text-center mb-10">
            <div className="inline-flex items-center gap-2 text-xs text-purple-400/70 bg-purple-950/30 border border-purple-800/30 px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Hybrid RAG · Query Routing · LLM Reranker · Live Eval
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Chat with any<br />
              <span className="gradient-text">document</span>
            </h1>
            <p className="text-slate-500 text-base max-w-md mx-auto">
              Upload a PDF or TXT. Get instant answers with section-aware citations, live quality scores, and a full pipeline trace.
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`w-full max-w-lg cursor-pointer rounded-2xl border-2 border-dashed p-12
              flex flex-col items-center gap-5 transition-all duration-200
              ${isDragActive
                ? "border-purple-400 bg-purple-950/20 shadow-[0_0_60px_rgba(139,92,246,0.2)]"
                : "border-white/10 bg-white/[0.02] hover:border-purple-700/50 hover:bg-white/[0.04]"}`}
          >
            <input {...getInputProps()} />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isDragActive ? "bg-purple-600/20" : "bg-white/5"}`}>
              <svg className={`w-6 h-6 ${isDragActive ? "text-purple-300" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-center">
              {isDragActive
                ? <p className="text-purple-300 font-medium">Drop to upload</p>
                : <>
                    <p className="text-slate-300 font-medium">Drop a PDF or TXT here</p>
                    <p className="text-slate-600 text-sm mt-1">or click to browse · max 5 MB</p>
                  </>}
            </div>
          </div>

          {uploadError && (
            <p className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-900/40 px-4 py-2.5 rounded-xl max-w-lg text-center">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {/* ── Processing ─────────────────────────────────────────────────────── */}
      {phase === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <p className="text-slate-400 text-sm">Processing <span className="text-white font-medium">{fileName}</span></p>
          <div className="w-full max-w-sm space-y-3">
            {stepsData.map((step, i) => {
              const active = i === stepIdx;
              const done   = step.done;
              return (
                <div key={step.label} className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-500 ${
                  done   ? "border-purple-700/40 bg-purple-950/20" :
                  active ? "border-white/10 bg-white/[0.03]" :
                           "border-white/5 opacity-30"}`}>
                  <div className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center ${done ? "bg-purple-600" : active ? "bg-white/10" : "bg-white/5"}`}>
                    {done
                      ? <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      : active
                      ? <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      : <div className="w-2 h-2 rounded-full bg-white/20" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${done || active ? "text-white" : "text-slate-600"}`}>{step.label}</p>
                    {(done || active) && <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chat workspace ─────────────────────────────────────────────────── */}
      {phase === "workspace" && (
        <div className="flex-1 flex flex-col min-h-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                      AI
                    </div>
                  )}

                  <div className={`${msg.role === "user" ? "max-w-[65%]" : "flex-1 min-w-0"}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#3b3b4f] text-slate-100 rounded-tr-sm"
                        : "bg-transparent text-slate-200"
                    }`}>
                      <MsgText text={msg.content || "…"} />
                    </div>

                    {/* Intent badge */}
                    {msg.intent && (
                      <div className="mt-2 px-1">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md border font-medium ${INTENT_COLORS[msg.intent] ?? "text-slate-400 bg-white/5 border-white/10"}`}>
                          {msg.intent}
                        </span>
                        {msg.rewrittenQuery && (
                          <span className="ml-2 text-xs text-slate-700 italic">
                            searched: &ldquo;{msg.rewrittenQuery}&rdquo;
                          </span>
                        )}
                      </div>
                    )}

                    {/* Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                        {msg.sources.map((src) => (
                          <span
                            key={src.label}
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border ${
                              src.sectionMatch
                                ? "bg-purple-950/40 border-purple-700/50 text-purple-300"
                                : src.sectionLevel === 1
                                ? "bg-white/[0.04] border-white/10 text-slate-400"
                                : "bg-white/[0.02] border-white/[0.06] text-slate-600"
                            }`}
                            title={src.preview}
                          >
                            {src.sectionMatch && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />}
                            {src.citation || src.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Grounding */}
                    {msg.grounding && (
                      <div className="mt-1.5 px-1">
                        <p className={`text-xs flex items-center gap-1.5 ${msg.grounding.grounded ? "text-emerald-500/70" : "text-amber-500/70"}`}>
                          {msg.grounding.grounded ? "✓ Grounded in document" : `⚠ ${msg.grounding.issue}`}
                        </p>
                        {!msg.grounding.grounded && msg.grounding.unsupportedClaims && msg.grounding.unsupportedClaims.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {msg.grounding.unsupportedClaims.map((c, i) => (
                              <li key={i} className="text-xs text-amber-500/60 pl-3 before:content-['·'] before:mr-1.5">{c}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Completeness */}
                    {msg.completeness && !msg.completeness.complete && (msg.completeness.missed?.length ?? 0) > 0 && (
                      <div className="mt-2 mx-1 text-xs text-amber-400/80 bg-amber-950/20 border border-amber-800/20 rounded-lg px-3 py-2">
                        ⚠ Possibly missed: {msg.completeness.missed!.join(", ")}
                      </div>
                    )}

                    {/* Eval */}
                    {msg.evalScores && (
                      <div className="px-1"><EvalPanel scores={msg.evalScores} /></div>
                    )}
                  </div>
                </div>
              ))}

              {/* Pipeline trace (shown while querying) */}
              {isQuerying && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                    AI
                  </div>
                  <div className="flex-1 py-1">
                    <PipelineTrace activeStage={pipelineStage} />
                    {pipelineStage === "idle" && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: "120ms" }} />
                        <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: "240ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 px-4 pb-5 pt-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-3 bg-[#1a1a24] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-purple-700/50 transition-colors shadow-lg">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Ask anything about your document…"
                  disabled={isQuerying}
                  className="flex-1 bg-transparent resize-none text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed disabled:opacity-50 max-h-40"
                  style={{ height: "24px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isQuerying}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_16px_rgba(139,92,246,0.5)]"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <p className="text-center text-xs text-slate-700 mt-2">
                Hybrid RAG · Query Routing · LLM Reranker · Groq Llama 3.3 · Enter to send
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
