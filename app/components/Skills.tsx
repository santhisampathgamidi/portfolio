const skillGroups = [
  {
    category: "Languages & Systems",
    icon: "💻",
    color: "purple",
    skills: ["Python", "SQL", "JavaScript", "TypeScript", "R", "Java", "C#", "Bash", "HTML/CSS"],
  },
  {
    category: "GenAI & Agentic AI",
    icon: "🤖",
    color: "blue",
    skills: ["LangChain", "LangGraph", "RAG", "Hybrid Retrieval", "MCP", "LLM-as-a-Judge", "Agent Evals", "Guardrails", "GPT-5", "GPT-4", "Claude", "Gemini", "OpenAI API", "CrewAI", "n8n", "Prompt Engineering", "LLM Evaluation"],
  },
  {
    category: "ML & NLP",
    icon: "🧠",
    color: "teal",
    skills: ["PyTorch", "TensorFlow", "Scikit-learn", "XGBoost", "LSTM", "Hugging Face", "DistilBERT", "RoBERTa", "OpenCV", "YOLOv5", "SHAP", "LIME", "A/B Testing"],
  },
  {
    category: "DevOps & MLOps",
    icon: "⚙️",
    color: "green",
    skills: ["Docker", "Kubernetes", "GitHub Actions", "Jenkins", "MLflow", "FastAPI", "CI/CD", "Terraform", "Playwright", "LangSmith", "Langfuse"],
  },
  {
    category: "Cloud Platforms",
    icon: "☁️",
    color: "orange",
    skills: ["AWS (Lambda, S3, EC2, SageMaker)", "GCP (Cloud Run, Vertex AI, Firebase, Firestore, BigQuery)", "Azure", "Pinecone", "FAISS", "ChromaDB"],
  },
  {
    category: "Data Engineering",
    icon: "📊",
    color: "pink",
    skills: ["Apache Spark", "PySpark", "Airflow", "Kafka", "DBT", "Databricks", "PostgreSQL", "MongoDB", "Redis", "Supabase", "Snowflake", "Redshift", "BigQuery", "Tableau", "Power BI", "QlikSense", "Superset", "Plotly Dash"],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; heading: string }> = {
  purple: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20", heading: "text-purple-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/20", heading: "text-blue-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-300", border: "border-teal-500/20", heading: "text-teal-400" },
  green: { bg: "bg-green-500/10", text: "text-green-300", border: "border-green-500/20", heading: "text-green-400" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/20", heading: "text-orange-400" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-300", border: "border-pink-500/20", heading: "text-pink-400" },
};

export default function Skills() {
  return (
    <section id="skills" className="py-24 px-6 bg-[#0d0d17]/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Technical <span className="gradient-text">Skills</span>
        </h2>
        <div className="section-divider mb-12" />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skillGroups.map((group) => {
            const c = colorMap[group.color];
            return (
              <div key={group.category} className="card-glow bg-[#0a0a0f] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{group.icon}</span>
                  <h3 className={`font-bold text-sm uppercase tracking-wider ${c.heading}`}>
                    {group.category}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <span
                      key={skill}
                      className={`text-xs px-2 py-1 rounded-md font-mono ${c.bg} ${c.text} border ${c.border}`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
