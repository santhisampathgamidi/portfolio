"use client";
import { useState, useEffect } from "react";

const links = ["About", "Experience", "Projects", "Skills", "Education", "Contact"];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#0a0a0f]/90 backdrop-blur-md border-b border-purple-900/30 py-3" : "py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <a href="#hero" className="text-lg font-bold gradient-text tracking-tight">
          SSG
        </a>
        {/* Desktop */}
        <ul className="hidden md:flex gap-8">
          {links.map((l) => (
            <li key={l}>
              <a
                href={`#${l.toLowerCase()}`}
                className="text-sm text-slate-400 hover:text-purple-400 transition-colors duration-200"
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
        {/* Mobile */}
        <button
          className="md:hidden text-slate-400"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-[#0d0d17] border-t border-purple-900/30 px-6 py-4">
          <ul className="flex flex-col gap-4">
            {links.map((l) => (
              <li key={l}>
                <a
                  href={`#${l.toLowerCase()}`}
                  className="text-sm text-slate-400 hover:text-purple-400 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
