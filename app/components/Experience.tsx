const jobs = [
  {
    company: "Lemmata, Inc",
    location: "Palo Alto, CA",
    role: "Full-Stack AI Engineer",
    period: "Oct 2025 – Present",
    color: "purple",
    bullets: [
      "Built a model-agnostic LLM evaluation and guardrails framework with pluggable LLM-as-a-judge scoring, semantic similarity, and statistical drift metrics to track model quality, detect failure modes, and enforce audit-ready production behavior.",
      "Designed an agent factuality pipeline using MCP (Model Context Protocol) servers to ground AI responses in trusted enterprise data, enabling claim-level auditability and hallucination detection for agentic BI copilots.",
      "Automated end-to-end agent trajectory evaluation across multi-turn interactions with a composite scoring harness, cutting validation cycles by ~90% and enabling repeatable, statistically grounded model releases.",
      "Shipped the full eval stack on GCP (Cloud Run, Firestore, Firebase) with CI/CD as a framework-agnostic, drop-in evaluation layer for any AI agent, delivering drift heatmaps, scorecards, and diff views through a self-serve portal.",
    ],
  },
  {
    company: "Community Dreams Foundation",
    location: "Orlando, FL",
    role: "AI Engineer",
    period: "Feb 2025 – Oct 2025",
    color: "blue",
    bullets: [
      "Built a multi-modal AI assistant combining OCR (Tesseract), speech-to-text (Whisper), and GPT-4, orchestrated through n8n and CrewAI, reducing donor workflow time by 45% and cutting fallback rate from 43% to 30%.",
      "Designed a LangGraph multi-agent workflow for domain-specific research using query classification and dynamic routing, with structured logging and token-level observability for monitoring, debugging, and auditability.",
    ],
  },
  {
    company: "Rupp Pfalzgraf LLC",
    location: "Buffalo, NY",
    role: "AI Engineer",
    period: "Aug 2024 – Feb 2025",
    color: "teal",
    bullets: [
      "Built an agentic RAG system with LangChain agents and GPT-4 to automate legal data ingestion, cleaning, and modeling, coordinating multi-step tool use (Selenium, APIs) and prompt orchestration across the pipeline.",
      "Deployed production RAG inference pipelines on AWS (Lambda, S3, EC2) with CI/CD, MLflow for experiment tracking, and Pinecone for real-time vector retrieval, delivering document-grounded legal intelligence.",
    ],
  },
  {
    company: "Imaginnovate",
    location: "India",
    role: "Data Scientist",
    period: "Jul 2021 – Aug 2023",
    color: "green",
    bullets: [
      "Built a rate-engine email intelligence system using regex and Hugging Face Transformers (DistilBERT, RoBERTa) to extract contract details from 1K+ daily emails, automatically flagging profitable loads and alerting stakeholders.",
      "Deployed PyTorch LSTM forecasting models for demand, supply, and revenue prediction, paired with supply chain dashboards (dispatch, fleet, driver performance) that enabled proactive workforce planning and operational decisions.",
      "Automated freight document processing with OCR and object detection (OpenCV, YOLOv5) to extract structured data, barcodes, and container IDs, reducing manual entry and improving inventory tracking.",
      "Architected an analytics platform with Airflow ETL orchestration over 5M+ records on PySpark and BigQuery (partitioning/clustering), enabling self-service BI (Plotly Dash, Superset) for 200+ users and cutting reporting time by 80%.",
    ],
  },
];

const colorMap: Record<string, string> = {
  purple: "border-purple-500 bg-purple-500/10 text-purple-400",
  blue: "border-blue-500 bg-blue-500/10 text-blue-400",
  teal: "border-teal-500 bg-teal-500/10 text-teal-400",
  green: "border-green-500 bg-green-500/10 text-green-400",
};

const dotMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  green: "bg-green-500",
};

export default function Experience() {
  return (
    <section id="experience" className="py-24 px-6 bg-[#0d0d17]/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Work <span className="gradient-text">Experience</span>
        </h2>
        <div className="section-divider mb-12" />

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-purple-600 via-blue-600 to-transparent" />

          <div className="space-y-10">
            {jobs.map((job) => (
              <div key={job.company} className="relative pl-12 md:pl-16">
                {/* Dot */}
                <div
                  className={`absolute left-2 md:left-4 top-2 w-4 h-4 rounded-full border-2 border-[#0a0a0f] ${dotMap[job.color]}`}
                />
                <div className="card-glow bg-[#0d0d17] rounded-xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{job.role}</h3>
                      <p className="text-slate-400 text-sm">
                        {job.company} · {job.location}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-mono px-3 py-1 rounded-full border ${colorMap[job.color]}`}
                    >
                      {job.period}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {job.bullets.map((b, i) => (
                      <li key={i} className="text-slate-400 text-sm leading-relaxed flex gap-2">
                        <span className="text-purple-500 mt-1 shrink-0">▸</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
