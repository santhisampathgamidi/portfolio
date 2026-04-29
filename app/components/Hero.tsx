"use client";
import { useEffect, useState } from "react";

const roles = [
  "Full-Stack AI Engineer",
  "LLM Systems Builder",
  "Multi-Agent Architect",
  "Data Scientist",
  "MLOps Engineer",
];

export default function Hero() {
  const [roleIdx, setRoleIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = roles[roleIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting && displayed.length < current.length) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 60);
    } else if (!deleting && displayed.length === current.length) {
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setRoleIdx((i) => (i + 1) % roles.length);
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, roleIdx]);

  return (
    <section
      id="hero"
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden"
    >
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <p className="text-purple-400 text-sm font-mono tracking-widest uppercase mb-4">
          👋 Hello, I&apos;m
        </p>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
          Santhi Sampath{" "}
          <span className="gradient-text">Gamidi</span>
        </h1>
        <div className="text-xl md:text-2xl text-slate-300 font-light mb-6 h-8">
          <span className="text-purple-400 font-medium">{displayed}</span>
          <span className="animate-pulse text-purple-400">|</span>
        </div>
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Building the systems behind reliable LLM products — evaluation harnesses,
          multi-agent workflows, and production-grade data pipelines across legal, healthcare,
          logistics, and analytics.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="#projects"
            className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
          >
            View Projects
          </a>
          <a
            href="#contact"
            className="px-8 py-3 border border-purple-500/50 text-purple-300 hover:border-purple-400 hover:text-purple-200 rounded-full font-medium transition-all duration-200"
          >
            Get in Touch
          </a>
          <a
            href="mailto:santhi.sampath.gamidi@gmail.com"
            className="px-8 py-3 border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 rounded-full font-medium transition-all duration-200"
          >
            Email Me
          </a>
        </div>
        <div className="mt-14 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          <span>📍 New York, NY</span>
          <span>5+ Years Experience</span>
          <span>MS Data Science · UB</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-600 text-xs">
        <span>scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
      </div>
    </section>
  );
}
