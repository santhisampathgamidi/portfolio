/**
 * Shared in-memory RAG store — hybrid retrieval (semantic + BM25 via RRF),
 * section-aware chunking, and per-chunk metadata.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredChunk {
  text: string;
  embedding: number[];
  sectionNum: string;    // "1", "2.1", "3.2.1", "?"
  sectionTitle: string;  // "Student Certification", etc.
  sectionLevel: number;  // 1 = top-level, 2 = subsection, 3 = sub-subsection
  pageNum: number;
}

export interface RagSession {
  chunks: StoredChunk[];
  docText: string;
  numPages: number;
  numChunks: number;
  idf: Record<string, number>; // BM25 IDF table
  avgChunkLen: number;         // average token count per chunk
}

export interface EvalScores {
  faithfulness: number;
  answerRelevance: number;
  contextRelevance: number;
  factuality: number;
  confidence: number;
}

// Module-level session store
export const ragSessions = new Map<string, RagSession>();

// ─── Section-aware chunking ───────────────────────────────────────────────────

// Matches nested sections: "Section 1.2.3", "1.", "1.2.", "2.3.4 Title"
// Also: "Part II", "Article 5", "Chapter 3"
const SECTION_RE =
  /^(?:(?:section|part|article|chapter)\s+(\d+(?:\.\d+)*)[.\s:\-–]*(.{0,80})|(\d+(?:\.\d+)*)\.?\s+([A-Z][^\n]{0,80}))/;

/**
 * Splits page-level texts into section-based chunks with accurate metadata.
 * Falls back to character chunking with first-line titling if no headers found.
 */
export function splitIntoSections(
  pageTexts: string[]
): Omit<StoredChunk, "embedding">[] {
  type Draft = { lines: string[]; num: string; title: string; page: number };

  const sections: Draft[] = [];
  let current: Draft = { lines: [], num: "0", title: "Preamble", page: 1 };

  for (let p = 0; p < pageTexts.length; p++) {
    for (const rawLine of pageTexts[p].split("\n")) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const m = trimmed.match(SECTION_RE);
      const isHeader = !!m && trimmed.length < 120;

      if (isHeader) {
        if (current.lines.join("").trim().length > 20) sections.push({ ...current });
        const rawNum   = m[1] ?? m[3] ?? "?";
        const rawTitle = (m[2] ?? m[4] ?? "").trim();
        current = {
          lines: [trimmed],
          num: rawNum,
          title: rawTitle || trimmed.replace(/^[\w\s]*\d[\d.]*[.\s:\-–]*/i, "").trim().slice(0, 80),
          page: p + 1,
        };
      } else {
        current.lines.push(rawLine);
      }
    }
  }
  if (current.lines.join("").trim().length > 0) sections.push(current);

  if (sections.length >= 2) {
    return sections.map((s) => {
      const derivedTitle =
        s.title ||
        s.lines.find((l) => l.trim().length > 3)?.trim().slice(0, 60) ||
        `Section ${s.num}`;
      // Level = number of dots + 1  (e.g. "1" → 1, "1.2" → 2, "1.2.3" → 3)
      const level = s.num === "?" ? 1 : s.num.split(".").filter(Boolean).length;
      return {
        text: s.lines.join("\n").trim(),
        sectionNum: s.num,
        sectionTitle: derivedTitle,
        sectionLevel: level,
        pageNum: s.page,
      };
    });
  }

  // Fallback: character chunking
  const flatText = pageTexts.join("\n\n");
  const charChunks = splitText(flatText, 800, 80);
  const totalPages = pageTexts.length;

  const pageBoundaries: number[] = [];
  let offset = 0;
  for (const pt of pageTexts) { pageBoundaries.push(offset); offset += pt.length + 2; }

  let chunkOffset = 0;
  return charChunks.map((text, i) => {
    const pageNum = pageBoundaries.findLastIndex((b) => b <= chunkOffset) + 1 || 1;
    chunkOffset += text.length;
    const firstLine =
      text.split("\n").find((l) => l.trim().length > 5)?.trim().slice(0, 60) ?? `Part ${i + 1}`;
    return {
      text,
      sectionNum: String(i + 1),
      sectionTitle: firstLine,
      sectionLevel: 1,
      pageNum: Math.min(totalPages, pageNum),
    };
  });
}

// ─── Simple character splitter (fallback) ─────────────────────────────────────

export function splitText(text: string, chunkSize = 1000, overlap = 80): string[] {
  if (text.length <= chunkSize) return [text.trim()];

  for (const sep of ["\n\n", "\n", " ", ""]) {
    const parts = sep ? text.split(sep) : text.split("");
    if (parts.length === 1) continue;

    const chunks: string[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
    if (current) chunks.push(current);

    if (overlap > 0 && chunks.length > 1) {
      return [
        chunks[0],
        ...chunks.slice(1).map((c, i) => chunks[i].slice(-overlap) + c),
      ];
    }
    return chunks;
  }
  return [text];
}

// ─── BM25 ─────────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((t) => t.length > 1);
}

export function buildIDF(chunks: { text: string }[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const c of chunks) {
    for (const t of new Set(tokenize(c.text))) df[t] = (df[t] ?? 0) + 1;
  }
  const N = chunks.length;
  const idf: Record<string, number> = {};
  for (const [t, freq] of Object.entries(df)) {
    idf[t] = Math.log((N - freq + 0.5) / (freq + 0.5) + 1);
  }
  return idf;
}

function bm25Score(
  query: string,
  chunkText: string,
  idf: Record<string, number>,
  avgLen: number,
  k1 = 1.5,
  b = 0.75
): number {
  const docTerms = tokenize(chunkText);
  const docLen = docTerms.length;
  const tf: Record<string, number> = {};
  for (const t of docTerms) tf[t] = (tf[t] ?? 0) + 1;

  let score = 0;
  for (const term of tokenize(query)) {
    const termTF = tf[term] ?? 0;
    if (termTF === 0) continue;
    score +=
      (idf[term] ?? 0) *
      ((termTF * (k1 + 1)) / (termTF + k1 * (1 - b + (b * docLen) / avgLen)));
  }
  return score;
}

// ─── Vector math ──────────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Hybrid retrieval (RRF) ───────────────────────────────────────────────────

export interface RetrievedChunk extends StoredChunk {
  score: number;
  index: number;
  sectionMatch: boolean;
  semScore: number;
  kwScore: number;
}

export function hybridTopK(
  queryEmbedding: number[],
  query: string,
  chunks: StoredChunk[],
  idf: Record<string, number>,
  avgLen: number,
  k = 5
): RetrievedChunk[] {
  const n = chunks.length;

  // Semantic scores → ranks
  const semScores = chunks.map((c) => cosineSimilarity(queryEmbedding, c.embedding));
  const semOrder = [...semScores.keys()].sort((a, b) => semScores[b] - semScores[a]);
  const semRankOf: number[] = new Array(n);
  semOrder.forEach((idx, rank) => (semRankOf[idx] = rank));

  // BM25 scores → ranks
  const kwScores = chunks.map((c) => bm25Score(query, c.text, idf, avgLen));
  const kwOrder = [...kwScores.keys()].sort((a, b) => kwScores[b] - kwScores[a]);
  const kwRankOf: number[] = new Array(n);
  kwOrder.forEach((idx, rank) => (kwRankOf[idx] = rank));

  // RRF fusion (k=60 is the standard constant)
  const rrfScores = chunks.map(
    (_, i) => 1 / (60 + semRankOf[i]) + 1 / (60 + kwRankOf[i])
  );

  // Detect section reference in query
  const sectionRef = query.match(/section\s+(\d+(?:\.\d+)*)/i)?.[1];

  return chunks
    .map((c, i): RetrievedChunk => ({
      ...c,
      score: rrfScores[i],
      index: i,
      semScore: semScores[i],
      kwScore: kwScores[i],
      sectionMatch: sectionRef
        ? c.sectionNum === sectionRef ||
          c.text.toLowerCase().includes(`section ${sectionRef}`)
        : false,
    }))
    .sort((a, b) => {
      // Always surface direct section matches first
      if (a.sectionMatch && !b.sectionMatch) return -1;
      if (!a.sectionMatch && b.sectionMatch) return 1;
      return b.score - a.score;
    })
    .slice(0, k);
}
