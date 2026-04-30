import Link from "next/link";

type Project = {
  title: string;
  tags: string[];
  description: string;
  color: string;
  icon: string;
  link: string;
  live: boolean;
};

const liveProjects: Project[] = [
  {
    title: "AI Document Analyst (RAG)",
    tags: ["LangChain.js", "Groq · Llama 3.3", "Gemini Embeddings", "Next.js", "BM25 + Semantic"],
    description:
      "A full-stack serverless RAG pipeline leveraging LangChain, Groq (Llama 3), and Gemini Embeddings to instantly query your documents. Features hybrid retrieval, query routing, LLM reranking, live eval scores, and a pipeline trace UI.",
    color: "purple",
    icon: "📄",
    link: "/rag-chat",
    live: true,
  },
  {
    title: "Production LLM API",
    tags: ["FastAPI", "httpx async", "Groq", "Redis", "Docker", "Render"],
    description:
      "A production-grade FastAPI service wrapping an LLM with async streaming, Redis sliding-window rate limiting, MD5 prompt caching, and a pluggable provider abstraction — Ollama for local Docker, Groq for serverless prod. Single env var swaps backends.",
    color: "blue",
    icon: "⚡",
    link: "/llm-api",
    live: true,
  },
  {
    title: "RAG From Scratch",
    tags: ["FastAPI", "sentence-transformers", "MiniLM", "numpy", "Docker", "Render"],
    description:
      "An interactive visualiser for RAG primitives. Watch text get sliced into overlapping chunks, embedded into 384-dim vectors via all-MiniLM-L6-v2, and ranked by cosine similarity to your query — no LangChain, no vector DB, just numpy and the math.",
    color: "teal",
    icon: "🧩",
    link: "/rag-scratch",
    live: true,
  },
];

const projects: Project[] = [
  {
    title: "NG12 Cancer Risk Assessor",
    tags: ["Python", "LangGraph", "Google ADK", "Vertex AI", "FastAPI", "ChromaDB", "React"],
    description:
      "Clinical AI decision-support system using guideline-grounded reasoning to assess cancer risk per NICE NG12. Cloud-deployed API and web interface with retrieval-backed, non-hallucinatory outputs on GCP Vertex AI.",
    color: "purple",
    icon: "🏥",
    link: "#",
    live: false,
  },
  {
    title: "AI Lease Assistant",
    tags: ["LangGraph", "FastAPI", "Supabase", "Groq", "Next.js"],
    description:
      "Dual-agent lease assistant using hybrid retrieval for tenant Q&A and owner analytics grounded in lease documents. FastAPI + Groq backend with a Next.js interface, streaming chat, and interactive benchmarking dashboards.",
    color: "blue",
    icon: "🏠",
    link: "#",
    live: false,
  },
  {
    title: "AI Voice Agent — Load Bookings",
    tags: ["Retell AI", "n8n", "Voice AI"],
    description:
      "AI-powered voice agent automating inbound data capture and generating real-time rate quotes via backend integration. Orchestrated workflow automation with n8n, handling system updates, validations, and notifications at scale.",
    color: "teal",
    icon: "🎙️",
    link: "#",
    live: false,
  },
];

const colorBorder: Record<string, string> = {
  purple: "border-purple-500/30 hover:border-purple-500/60",
  blue:   "border-blue-500/30 hover:border-blue-500/60",
  teal:   "border-teal-500/30 hover:border-teal-500/60",
};

const tagColor: Record<string, string> = {
  purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  blue:   "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  teal:   "bg-teal-500/10 text-teal-400 border border-teal-500/20",
};

function ProjectCard({ p }: { p: Project }) {
  const card = (
    <div
      className={`bg-[#0d0d17] rounded-xl p-6 border transition-all duration-300 flex flex-col h-full ${colorBorder[p.color]} ${p.live ? "hover:shadow-[0_0_32px_rgba(139,92,246,0.2)]" : ""}`}
      style={{ boxShadow: "0 0 20px rgba(109,40,217,0.05)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{p.icon}</span>
        {p.live && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/40 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Demo
          </span>
        )}
      </div>
      <h3 className="text-white font-bold text-lg mb-2">{p.title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">{p.description}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {p.tags.map((t) => (
          <span key={t} className={`text-xs px-2 py-1 rounded-full font-mono ${tagColor[p.color]}`}>
            {t}
          </span>
        ))}
      </div>
      <span className={`text-sm flex items-center gap-1 transition-colors ${p.live ? "text-purple-400 font-medium" : "text-slate-500 hover:text-purple-400"}`}>
        {p.live ? "Try it live →" : "View Project →"}
      </span>
    </div>
  );

  if (p.live) {
    return <Link href={p.link} className="flex flex-col">{card}</Link>;
  }
  return <a href={p.link} className="flex flex-col">{card}</a>;
}

export default function Projects() {
  return (
    <section id="projects" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Featured <span className="gradient-text">Projects</span>
        </h2>
        <div className="section-divider mb-4" />
        <p className="text-slate-500 mb-12">
          More live AI tools coming soon — stay tuned for 20 interactive demos.
        </p>

        {/* Live demos */}
        <div className="mb-6">
          <p className="text-xs font-mono text-emerald-500/70 uppercase tracking-widest mb-4">
            ✦ Live & Interactive
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveProjects.map((p) => <ProjectCard key={p.title} p={p} />)}
          </div>
        </div>

        {/* Other projects */}
        <div className="mb-12">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-4">
            Other Projects
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {projects.map((p) => <ProjectCard key={p.title} p={p} />)}
          </div>
        </div>

        {/* Teaser */}
        <div className="card-glow bg-[#0d0d17] rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🚀</div>
          <h3 className="text-xl font-bold text-white mb-2">20 Live AI Tools — Coming Soon</h3>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            An interactive showcase of AI-powered apps — each with a live demo, built with
            Claude AI. Each tool includes 3 free trials so anyone can test it.
          </p>
        </div>
      </div>
    </section>
  );
}
