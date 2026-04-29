import { NextRequest } from "next/server";
import { embedDocuments } from "@/app/lib/embeddings";
import { splitIntoSections, buildIDF } from "@/app/lib/rag-store";

// Polyfill browser APIs missing in Vercel's Node.js serverless runtime
if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrix {
    a=1; b=0; c=0; d=1; e=0; f=0;
    m11=1; m12=0; m13=0; m14=0;
    m21=0; m22=1; m23=0; m24=0;
    m31=0; m32=0; m33=1; m34=0;
    m41=0; m42=0; m43=0; m44=1;
    is2D=true; isIdentity=true;
    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
    multiply() { return new DOMMatrix(); }
    translate(tx=0, ty=0) { const m=new DOMMatrix(); m.e=tx; m.f=ty; return m; }
    scale(sx=1, sy=sx) { const m=new DOMMatrix(); m.a=sx; m.d=sy; return m; }
    rotate() { return new DOMMatrix(); }
    inverse() { return new DOMMatrix(); }
    transformPoint(p?: {x?:number;y?:number}) { return {x:p?.x??0, y:p?.y??0, z:0, w:1}; }
  }
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTxt =
      file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPdf && !isTxt) {
      return Response.json(
        { error: "Only PDF and TXT files are supported" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Step 1: Parse into page-level texts ───────────────────────────────────
    let pageTexts: string[] = [];

    if (isPdf) {
      const { resolve } = await import("path");
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

      pdfjsLib.GlobalWorkerOptions.workerSrc = resolve(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
      );

      const pdfDoc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(
          content.items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ")
        );
      }
    } else {
      pageTexts = [buffer.toString("utf-8")];
    }

    const docText = pageTexts.join("\n\n");

    if (!docText.trim()) {
      return Response.json(
        { error: "Could not extract text from file" },
        { status: 422 }
      );
    }

    // ── Step 2: Section-aware chunking ────────────────────────────────────────
    const rawChunks = splitIntoSections(pageTexts);

    // ── Step 3: Embed ─────────────────────────────────────────────────────────
    const vectors = await embedDocuments(rawChunks.map((c) => c.text));

    const chunks = rawChunks.map((c, i) => ({ ...c, embedding: vectors[i] }));

    // ── Step 4: Build BM25 IDF table ─────────────────────────────────────────
    const idf = buildIDF(chunks);
    const avgChunkLen = Math.round(
      chunks.reduce((s, c) => s + c.text.split(/\s+/).length, 0) / chunks.length
    );

    // Return everything to the client — no server-side session needed.
    // Client stores in sessionStorage and sends back on each chat request.
    return Response.json({
      numPages: pageTexts.length,
      numChunks: chunks.length,
      // Full session payload stored client-side
      sessionData: {
        chunks,       // includes embeddings
        idf,
        avgChunkLen,
      },
    });
  } catch (err: unknown) {
    console.error("[ingest] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
