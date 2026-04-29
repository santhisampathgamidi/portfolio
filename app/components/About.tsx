const stats = [
  { label: "Years Experience", value: "5+" },
  { label: "Industries", value: "4+" },
  { label: "Projects Shipped", value: "20+" },
  { label: "Cloud Platforms", value: "3" },
];

export default function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          About <span className="gradient-text">Me</span>
        </h2>
        <div className="section-divider mb-12" />

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-slate-300 text-lg leading-relaxed mb-6">
              I&apos;m a Full-Stack AI/ML Engineer and Data Scientist who builds the systems
              behind <span className="text-purple-400 font-medium">reliable LLM products</span> —
              evaluation harnesses, multi-agent workflows, and data pipelines that hold up in
              production.
            </p>
            <p className="text-slate-400 leading-relaxed mb-6">
              With five years shipping across legal, logistics, healthcare, and analytics,
              I bring deep hands-on experience in PyTorch, RAG architectures, and cloud-native
              MLOps on GCP and AWS. I care about systems that are not just smart — but
              <span className="text-blue-400 font-medium"> measurably reliable</span>.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Currently at Lemmata, Inc in Palo Alto, building a model-agnostic evaluation and
              guardrails framework with <span className="text-purple-400 font-medium">MCP-grounded factuality</span>,
              LLM-as-a-judge scoring, and agent trajectory eval — shipped on GCP as a drop-in
              eval layer that cuts validation cycles by ~90%.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="card-glow bg-[#0d0d17] rounded-xl p-6 text-center">
                <div className="text-4xl font-bold gradient-text mb-2">{s.value}</div>
                <div className="text-slate-400 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
