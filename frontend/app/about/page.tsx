import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — UP AI Labs · Nawab AI",
  description: "UP AI Labs is a nonprofit igniting AI knowledge-sharing across Uttar Pradesh.",
};

const STATS = [
  { value: "30+", label: "AI Projects" },
  { value: "3,000+", label: "Community Members" },
  { value: "15+", label: "Research Papers" },
  { value: "25+", label: "Partner Organisations" },
];

const ACTIVITIES = [
  "AI Education in tier-3 cities",
  "ML / AI Research",
  "Open-source contributions",
  "Startup support",
  "Hindi NLP development",
  "Local problem-solving",
];

const CITIES = [
  { name: "Lucknow", color: "#C8782E" },
  { name: "Kanpur", color: "#1A80C0" },
  { name: "Varanasi", color: "#D96020" },
  { name: "Noida", color: "#8840CC" },
];

export default function AboutPage() {
  return (
    <div className="about-root">
      {/* ── Nav ── */}
      <nav className="about-nav">
        <Link href="/" className="about-nav__logo">✦ Nawab AI</Link>
        <Link href="/" className="about-nav__back">← Back to chat</Link>
      </nav>

      <main className="about-main">
        {/* ── Hero ── */}
        <section className="about-hero">
          <div className="about-hero__ornament">✦</div>
          <h1 className="about-hero__title">UP AI Labs</h1>
          <p className="about-hero__tagline">AI Excellence for All</p>
        </section>

        {/* ── Mission ── */}
        <section className="about-section">
          <h2 className="about-section__heading">Our Mission</h2>
          <p className="about-section__body">
            Founded in Lucknow in 2022, UP AI Labs is a nonprofit dedicated to igniting
            knowledge-sharing across Uttar Pradesh through AI innovation and education.
            We unite communities, researchers, and industry to make artificial intelligence
            accessible to every corner of the state.
          </p>
        </section>

        {/* ── Stats ── */}
        <section className="about-stats-section">
          <div className="about-stats">
            {STATS.map((s) => (
              <div key={s.label} className="about-stat-card">
                <span className="about-stat-card__value">{s.value}</span>
                <span className="about-stat-card__label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── What we do ── */}
        <section className="about-section">
          <h2 className="about-section__heading">What We Do</h2>
          <div className="about-pills">
            {ACTIVITIES.map((a) => (
              <span key={a} className="about-pill">{a}</span>
            ))}
          </div>
        </section>

        {/* ── Cities ── */}
        <section className="about-section">
          <h2 className="about-section__heading">Where We Are</h2>
          <div className="about-cities">
            {CITIES.map((c) => (
              <span
                key={c.name}
                className="about-city-chip"
                style={{ borderColor: c.color, color: c.color }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="about-section about-contact">
          <h2 className="about-section__heading">Get in Touch</h2>
          <p className="about-section__body">
            <a href="mailto:contact@upailabs.org" className="about-link">contact@upailabs.org</a>
            <span className="about-contact__sep">·</span>
            <a href="tel:+919336247359" className="about-link">+91 93362 47359</a>
          </p>
          <p className="about-section__body" style={{ marginTop: "0.5rem" }}>
            <a
              href="https://upailabs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              upailabs.org ↗
            </a>
          </p>
        </section>
      </main>

      <footer className="about-footer">
        <span>© 2026 UP AI Labs · Lucknow, India</span>
      </footer>
    </div>
  );
}
