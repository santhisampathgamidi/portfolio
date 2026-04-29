"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_LLM_API_URL || "http://localhost:8000";
const MAX_PROMPT = 2000;

type Status = "idle" | "warming" | "streaming" | "done" | "cached" | "ratelimited" | "error";

export default function LlmApiDemo() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const isBusy = status === "warming" || status === "streaming";

  const reset = () => {
    setResponse("");
    setErrorMsg("");
    setLatencyMs(null);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim() || isBusy) return;

    reset();
    setStatus("warming");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    startedAtRef.current = performance.now();

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abortRef.current.signal,
      });

      if (res.status === 429) {
        setStatus("ratelimited");
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.detail || "Rate limit exceeded.");
        return;
      }
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.detail || "Invalid prompt.");
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.detail || `Request failed (${res.status}).`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let firstChunk = true;
      let streamed = "";
      let sawCached = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let data: { cached?: boolean; chunk?: string; error?: string };
          try {
            data = JSON.parse(line);
          } catch {
            continue;
          }

          if (firstChunk) {
            firstChunk = false;
            setStatus(data.cached ? "cached" : "streaming");
            setLatencyMs(Math.round(performance.now() - startedAtRef.current));
          }
          if (data.cached) sawCached = true;
          if (data.chunk) {
            streamed += data.chunk;
            setResponse(streamed);
          }
          if (data.error) {
            setStatus("error");
            setErrorMsg(data.error);
            return;
          }
        }
      }
      setStatus(sawCached ? "cached" : "done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStatus("error");
      setErrorMsg(
        (err as Error).message ||
          "Network error. Verify the API is running and CORS is configured."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-purple-400 transition-colors">
            ← Back to portfolio
          </Link>
          <span className="text-xs font-mono text-emerald-500/70 uppercase tracking-widest">
            ✦ Live Demo
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">
            Production <span className="gradient-text">LLM API</span>
          </h1>
          <div className="section-divider" />
          <p className="text-slate-400 max-w-2xl">
            FastAPI service with async streaming, Redis sliding-window rate limiting, MD5
            prompt caching, and a pluggable provider abstraction. Swaps between local
            Ollama and cloud Groq via a single env var.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["FastAPI", "httpx async", "Groq · Llama 3.3 70B", "Redis", "Docker", "Render"].map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-1 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
              placeholder="Ask anything. Try sending the same prompt twice to see the cache hit."
              className="w-full bg-[#0d0d17] border border-slate-800 rounded-xl p-4 pr-20 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 min-h-[140px] resize-y transition-colors"
              disabled={isBusy}
              maxLength={MAX_PROMPT}
            />
            <span className="absolute bottom-3 right-4 text-xs font-mono text-slate-600">
              {prompt.length}/{MAX_PROMPT}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="submit"
              disabled={isBusy || !prompt.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isBusy ? "Generating…" : "Generate"}
            </button>
            {isBusy && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 border border-slate-700 hover:border-red-500/60 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <span className="text-xs text-slate-500 font-mono ml-auto">
              Rate limit: 10 req/min · per IP
            </span>
          </div>
        </form>

        <div className="card-glow bg-[#0d0d17] rounded-xl p-6 min-h-[260px] relative">
          <div className="absolute top-4 right-4 flex flex-wrap gap-2 justify-end">
            {status === "warming" && (
              <Badge tone="amber" pulse>
                Warming up… (Render cold start ~30s)
              </Badge>
            )}
            {status === "streaming" && latencyMs !== null && (
              <Badge tone="blue">⚡ Streaming · TTFB {latencyMs}ms</Badge>
            )}
            {status === "cached" && latencyMs !== null && (
              <Badge tone="emerald">⚡ Cache hit · {latencyMs}ms</Badge>
            )}
            {status === "done" && latencyMs !== null && (
              <Badge tone="emerald">✓ Done · TTFB {latencyMs}ms</Badge>
            )}
            {status === "ratelimited" && <Badge tone="red">🛑 429 Rate limit exceeded</Badge>}
            {status === "error" && <Badge tone="red">⚠ Error</Badge>}
          </div>

          <div className="pt-10">
            {errorMsg ? (
              <p className="text-red-400 text-sm font-mono">{errorMsg}</p>
            ) : response ? (
              <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{response}</p>
            ) : (
              <p className="text-slate-600 italic">Response will appear here…</p>
            )}
          </div>
        </div>

        <details className="text-sm text-slate-500">
          <summary className="cursor-pointer hover:text-purple-400 transition-colors">
            What's happening behind this UI?
          </summary>
          <ul className="mt-3 space-y-2 pl-4 list-disc text-slate-500">
            <li>Request hits a sliding-window rate limiter backed by Redis sorted sets.</li>
            <li>Prompt is MD5-hashed; identical prompts within 1h return from cache instantly.</li>
            <li>On miss, the request streams via <code className="text-purple-400">httpx.AsyncClient</code> from Groq's chat completions endpoint, parsing SSE.</li>
            <li>Response is streamed back as NDJSON, then cached after the stream closes.</li>
            <li>Same FastAPI code runs locally with Ollama via <code className="text-purple-400">docker compose up</code>.</li>
          </ul>
        </details>
      </main>
    </div>
  );
}

function Badge({
  children,
  tone,
  pulse,
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
      className={`px-3 py-1 text-xs font-semibold rounded-full border ${tones[tone]} ${
        pulse ? "animate-pulse" : ""
      }`}
    >
      {children}
    </span>
  );
}
