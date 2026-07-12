import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { THEMES, themeGradient, layoutLabel, PLANS } from "../data.js";
import TiltCard from "../components/TiltCard.jsx";
import Reveal from "../components/Reveal.jsx";
import Counter from "../components/Counter.jsx";
import Carousel from "../components/Carousel.jsx";
import PlanCard from "../components/PlanCard.jsx";

const themeLabel = (id) => (THEMES.find((t) => t.id === id) || THEMES[0]).label;

const MOCKUPS = [
  { theme: "royal", name: "Nina Patel", role: "Brand Strategist", rotate: -9, top: "4%", left: "0%" },
  { theme: "coral", name: "Diego Cruz", role: "Photographer", rotate: 6, top: "34%", left: "52%" },
  { theme: "forest", name: "Mia Tanaka", role: "Architect", rotate: -4, top: "62%", left: "14%" },
];

const HOME_STATS = [
  { value: 20, suffix: "+", label: "Layouts to choose from" },
  { value: 10, suffix: "", label: "Color themes" },
  { value: 500, suffix: "+", label: "Portfolios launched" },
  { value: 98, suffix: "%", label: "Happy creators" },
];

const MARQUEE_AUDIENCE = [
  "Designers", "Developers", "Photographers", "Writers", "Architects",
  "Marketers", "Consultants", "Freelancers", "Coaches", "Agencies",
];

export default function Home() {
  const [samples, setSamples] = useState([]);
  const heroRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Pricing CTA: send guests to register, subscribed users to the editor.
  const startPlan = () => {
    if (!user) navigate("/register", { state: { from: "/subscribe" } });
    else if (!user.is_subscribed) navigate("/subscribe");
    else navigate("/editor");
  };

  useEffect(() => {
    api.samples().then((data) => setSamples(data.slice(0, 8))).catch(() => {});
  }, []);

  // Subtle parallax: blobs drift opposite the cursor for a premium feel.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty("--px", `${x * -24}px`);
      hero.style.setProperty("--py", `${y * -24}px`);
    };
    hero.addEventListener("mousemove", onMove);
    return () => hero.removeEventListener("mousemove", onMove);
  }, []);

  const sampleUrl = (slug) => `${api.base}/sample/${slug}`;

  return (
    <main className="home-v2">
      {/* ===== Hero ===== */}
      <section className="hero-landing hero-landing-v2" ref={heroRef}>
        <div className="hero-blob blob-a"></div>
        <div className="hero-blob blob-b"></div>
        <div className="hero-blob blob-c"></div>

        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 text-lg-start">
              <span className="badge rounded-pill text-bg-light mb-3">✨ Launch your portfolio in minutes</span>
              <h1 className="display-4 fw-bold">
                Professional portfolios,<br />
                <span className="gradient-text">without the busywork.</span>
              </h1>
              <p className="lead text-muted mt-3" style={{ maxWidth: 520 }}>
                Website Lelo designs clean, fast personal sites. Browse our work, then build your
                own — everything starts pre-filled with sample content, so you just click and edit.
              </p>
              <div className="d-flex gap-3 flex-wrap mt-4">
                <Link to="/samples" className="btn btn-primary btn-lg glow-btn">View portfolio samples</Link>
                <Link to="/register" className="btn btn-outline-primary btn-lg">Create yours</Link>
              </div>
            </div>

            <div className="col-lg-6 d-none d-lg-block">
              <div className="hero-mockups">
                {MOCKUPS.map((m, i) => (
                  <TiltCard
                    key={m.name}
                    className="mockup-card float-card"
                    restTransform={`rotate(${m.rotate}deg)`}
                    style={{
                      background: themeGradient(m.theme),
                      top: m.top,
                      left: m.left,
                      animationDelay: `${i * 0.7}s`,
                    }}
                  >
                    <div className="mockup-dots"><span></span><span></span><span></span></div>
                    <div className="mockup-avatar"></div>
                    <div className="mockup-line w-70"></div>
                    <div className="mockup-line w-40"></div>
                    <div className="mockup-chip">{themeLabel(m.theme)}</div>
                  </TiltCard>
                ))}
              </div>
            </div>
          </div>
        </div>
        <svg className="hero-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path style={{ fill: "var(--bg)" }} d="M0,32 C240,80 480,0 720,24 C960,48 1200,8 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>

      {/* ===== Audience marquee ===== */}
      <section className="marquee-section">
        <div className="marquee-track">
          {[...MARQUEE_AUDIENCE, ...MARQUEE_AUDIENCE].map((tag, i) => (
            <span className="marquee-item" key={i}>
              <i className="fas fa-star marquee-star"></i> Built for {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      <section className="container">
        <div className="stats-row-home row g-3">
          {HOME_STATS.map((s) => (
            <div className="col-6 col-md-3" key={s.label}>
              <Reveal className="stat-counter-card text-center">
                <div className="stat-counter-num gradient-text">
                  <Counter value={s.value} suffix={s.suffix} />
                </div>
                <div className="stat-counter-lbl">{s.label}</div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Featured portfolios ===== */}
      {samples.length > 0 && (
        <section className="container py-5">
          <Reveal as="div" className="head text-start mb-4">
            <div className="eyebrow">Featured</div>
            <h2 className="mb-1">Real portfolios, built in minutes</h2>
            <p className="text-muted">A few of our sample designs — click any to open the full live site.</p>
          </Reveal>
          <Reveal>
            <Carousel>
              {samples.map((s) => (
                <TiltCard as="a" href={sampleUrl(s.slug)} target="_blank" rel="noopener noreferrer" className="feat-card" intensity={6} key={s.slug}>
                  <div className="feat-top" style={{ background: themeGradient(s.theme) }}>
                    <span className="design-badge feat-badge-l"><i className="fas fa-table-cells-large me-1"></i>{layoutLabel(s.layout)}</span>
                    <span className="design-badge feat-badge-r"><i className="fas fa-palette me-1"></i>{themeLabel(s.theme)}</span>
                  </div>
                  <div className="feat-body">
                    {s.avatar_url && <img className="feat-avatar" src={s.avatar_url} alt={s.full_name} />}
                    <h3 className="h5 mt-2 mb-0">{s.full_name}</h3>
                    <div className="fw-semibold feat-role">{s.title}</div>
                    <div className="d-flex flex-wrap mt-2">
                      {s.skills.slice(0, 3).map((sk) => <span className="tag" key={sk}>{sk}</span>)}
                    </div>
                    <div className="mt-3 fw-semibold feat-link">View live website <i className="fas fa-arrow-up-right-from-square ms-1 small"></i></div>
                  </div>
                </TiltCard>
              ))}
            </Carousel>
          </Reveal>
          <Reveal className="text-center mt-4">
            <Link to="/samples" className="btn btn-outline-primary btn-lg">See all 10 designs →</Link>
          </Reveal>
        </section>
      )}

      {/* ===== What we do ===== */}
      <section className="container py-5">
        <Reveal as="h2" className="section-title text-center">What we do</Reveal>
        <div className="row g-4">
          {[
            ["fa-palette", "Beautiful design", "A polished, professional template with stats, skills, blog posts, testimonials, timeline and dark mode."],
            ["fa-bolt", "Edit in place", "No blank forms. Your portfolio shows sample content everywhere — click any text or image to make it yours."],
            ["fa-link", "Your own link", "Hit Generate and publish to a personal address you can share anywhere."],
          ].map(([icon, title, body], i) => (
            <div className="col-md-4" key={title}>
              <Reveal delay={i * 120}>
                <TiltCard className="card feature-card border-0 shadow-sm" intensity={6}>
                  <div className="feature-icon mb-2"><i className={`fas ${icon}`}></i></div>
                  <h3 className="h5">{title}</h3>
                  <p className="text-muted mb-0">{body}</p>
                </TiltCard>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="bg-white border-top border-bottom py-5">
        <div className="container">
          <Reveal as="h2" className="section-title text-center">How it works</Reveal>
          <div className="row g-4 how-it-works">
            {[
              ["1", "Explore the samples", "See live portfolios and pick the vibe you want."],
              ["2", "Subscribe", "Unlock the editor with one click. (Payment gateway coming soon.)"],
              ["3", "Customize in place", "Everything is pre-filled with dummy data — just click to edit your details."],
              ["4", "Generate your link", "Publish and instantly get your personal portfolio URL to share."],
            ].map(([num, title, body], i) => (
              <div className="col-md-6" key={num}>
                <Reveal delay={i * 100}>
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body d-flex gap-3">
                      <div className="step-num">{num}</div>
                      <div><h4 className="h6 mb-1">{title}</h4><p className="text-muted mb-0">{body}</p></div>
                    </div>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
          <Reveal className="mt-4 text-center">
            <Link to="/samples" className="btn btn-primary btn-lg glow-btn">Start with the samples →</Link>
          </Reveal>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="container py-5" id="pricing">
        <Reveal as="div" className="text-center mb-5">
          <div className="eyebrow">Pricing</div>
          <h2 className="mb-1">Simple, yearly pricing</h2>
          <p className="text-muted">One payment, a full year online. Pick a plan and unlock the portfolio editor.</p>
        </Reveal>
        <div className="row g-4 justify-content-center pricing-grid">
          {PLANS.map((p, i) => (
            <div className="col-md-6 col-lg-4" key={p.id}>
              <Reveal delay={i * 100}>
                <PlanCard plan={p} onChoose={startPlan} />
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="container py-5">
        <Reveal className="cta-banner text-center">
          <h2 className="fw-bold mb-2">Ready to stand out online?</h2>
          <p className="mb-4">Join hundreds of creators with a portfolio that actually looks professional.</p>
          <Link to="/register" className="btn btn-light btn-lg glow-btn">Create your portfolio — it's free →</Link>
        </Reveal>
      </section>
    </main>
  );
}
