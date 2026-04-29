const education = [
  {
    degree: "Master of Science in Data Science",
    school: "University at Buffalo",
    location: "Buffalo, NY",
    period: "Dec 2024",
    icon: "🎓",
    color: "purple",
  },
  {
    degree: "Bachelor of Business Analytics",
    school: "GITAM University",
    location: "Visakhapatnam, India",
    period: "Jun 2021",
    icon: "📚",
    color: "blue",
  },
];

export default function Education() {
  return (
    <section id="education" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          <span className="gradient-text">Education</span>
        </h2>
        <div className="section-divider mb-12" />

        <div className="grid md:grid-cols-2 gap-6">
          {education.map((e) => (
            <div key={e.degree} className="card-glow bg-[#0d0d17] rounded-xl p-6 flex gap-4">
              <div className="text-4xl">{e.icon}</div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight mb-1">{e.degree}</h3>
                <p className="text-purple-400 font-medium text-sm">{e.school}</p>
                <p className="text-slate-500 text-sm mt-1">
                  {e.location} · {e.period}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
