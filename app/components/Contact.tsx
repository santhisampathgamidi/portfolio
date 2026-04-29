const links = [
  {
    label: "Email",
    value: "santhi.sampath.gamidi@gmail.com",
    href: "mailto:santhi.sampath.gamidi@gmail.com",
    icon: "✉️",
  },
  {
    label: "Phone",
    value: "+1 716-232-1868",
    href: "tel:+17162321868",
    icon: "📱",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/santhi-sampath",
    href: "https://linkedin.com",
    icon: "💼",
  },
  {
    label: "Location",
    value: "New York, NY",
    href: "#",
    icon: "📍",
  },
];

export default function Contact() {
  return (
    <section id="contact" className="py-24 px-6 bg-[#0d0d17]/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Get in <span className="gradient-text">Touch</span>
        </h2>
        <div className="section-divider mb-12" />

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              Open to full-time roles, consulting engagements, and interesting AI/ML
              collaborations.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Whether you&apos;re building a new AI product, scaling an existing system, or need
              a thought partner on LLM reliability — let&apos;s talk.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="card-glow bg-[#0a0a0f] rounded-xl p-4 flex items-start gap-3 group"
              >
                <span className="text-2xl">{l.icon}</span>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{l.label}</p>
                  <p className="text-slate-300 text-sm group-hover:text-purple-300 transition-colors break-all">
                    {l.value}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-20 pt-8 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-600 text-sm">
        <p>© 2026 Santhi Sampath Gamidi. All rights reserved.</p>
        <p className="gradient-text text-xs font-mono">Built with Next.js · Deployed on Vercel</p>
      </div>
    </section>
  );
}
