import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { DEFAULT_DATA, withIds, stripIds, newId, SOCIAL_KEYS, THEMES, LAYOUTS } from "../data.js";
import Editable, { EditableImage } from "../components/Editable.jsx";

const SKILL_COLORS = ["var(--primary-color)", "var(--accent-color)", "var(--success-color)", "var(--warning-color)"];
const SOCIAL_ICONS = { github: "fa-github", linkedin: "fa-linkedin-in", twitter: "fa-twitter", instagram: "fa-instagram", dribbble: "fa-dribbble", youtube: "fa-youtube", facebook: "fa-facebook-f" };

// Small section header used inside the editor. The title is editable.
function Head({ eyebrow, value, onCommit }) {
  return (
    <div className="head">
      <div className="eyebrow">{eyebrow}</div>
      <Editable tag="h2" value={value} onCommit={onCommit} />
      <div className="bar"></div>
    </div>
  );
}

export default function Editor() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(() => withIds(DEFAULT_DATA));
  const [isNew, setIsNew] = useState(true);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(DEFAULT_DATA.theme);
  const [layout, setLayout] = useState(DEFAULT_DATA.layout);
  const [uname, setUname] = useState(null);
  const debounce = useRef(null);

  const patch = (fn) => setData((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const touched = (fn) => { patch(fn); setSaved(false); };

  useEffect(() => { if (user && !user.is_subscribed) navigate("/subscribe", { replace: true }); }, [user, navigate]);

  useEffect(() => {
    api.getPortfolio()
      .then((p) => {
        const merged = { ...DEFAULT_DATA, ...p.data };
        setData(withIds(merged));
        setTheme(merged.theme || "aurora");
        setLayout(merged.layout || "classic");
        setUsername(p.username);
        setIsNew(false);
      })
      .catch((e) => { if (e.status !== 404) setError(e.message); setIsNew(true); })
      .finally(() => setLoading(false));
  }, []);

  // Apply the chosen design (color) + layout (structure) as body classes so the
  // whole live page restyles.
  useEffect(() => {
    const all = [...THEMES.map((t) => `theme-${t.id}`), ...LAYOUTS.map((l) => `layout-${l.id}`)];
    document.body.classList.remove(...all);
    document.body.classList.add(`theme-${theme}`, `layout-${layout}`);
    return () => document.body.classList.remove(...all);
  }, [theme, layout]);

  const pickTheme = (id) => { setTheme(id); touched((d) => { d.theme = id; }); };
  const pickLayout = (id) => { setLayout(id); touched((d) => { d.layout = id; }); };

  // Mark the body so the immersive 3D tilt becomes an edit-safe lift while editing.
  useEffect(() => {
    document.body.classList.add("editing");
    return () => document.body.classList.remove("editing");
  }, []);

  const onUsername = (value) => {
    const v = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setUsername(v); setUname(null);
    clearTimeout(debounce.current);
    if (v.length < 3) return;
    debounce.current = setTimeout(async () => { try { setUname(await api.checkUsername(v)); } catch (_) {} }, 350);
  };

  const editUrl = (label, current, apply) => { const url = window.prompt(`${label}:`, current || ""); if (url !== null) touched(apply.bind(null, url.trim())); };

  const persist = async () => {
    const clean = stripIds(data);
    if (isNew) {
      if (!username || username.length < 3) throw new Error("Choose a username (3+ chars) for your URL.");
      if (uname && !uname.available) throw new Error("That username isn't available.");
      const created = await api.createPortfolio({ username, data: clean });
      setUsername(created.username); setIsNew(false);
    } else {
      await api.updatePortfolio({ data: clean });
    }
  };

  const saveDraft = async () => { setError(""); setBusy(true); try { await persist(); setSaved(true); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const generate = async () => {
    setError(""); setBusy(true);
    try { await persist(); const pub = await api.generate(); await refresh(); navigate("/result", { state: { url: pub.public_url, username: pub.username } }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // Public URL preview. In production the site is path-based, so set
  // VITE_PUBLIC_SITE (e.g. https://wlelo.com) and we show wlelo.com/p/<user>.
  // Locally, with no VITE_PUBLIC_SITE, we fall back to the subdomain form
  // derived from the API base (nip.io wildcard) -> <user>.127.0.0.1.nip.io:8000.
  const host = (() => { try { return new URL(api.base).host; } catch { return "127.0.0.1.nip.io:8000"; } })();
  const pubSite = import.meta.env.VITE_PUBLIC_SITE;
  const pathMode = !!pubSite;
  const siteHost = pubSite ? (() => { try { return new URL(pubSite).host; } catch { return pubSite; } })() : host;
  if (loading) return <div className="text-center py-5">Loading editor…</div>;

  const colorAt = (i) => SKILL_COLORS[i % 4];

  return (
    <div>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="container d-flex flex-wrap align-items-center gap-3">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate("/")}><i className="fas fa-arrow-left me-1"></i> Exit</button>
          <div className="flex-grow-1 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
            <span className="text-muted small">URL:</span>
            {isNew ? (
              <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                <div className="input-group input-group-sm" style={{ maxWidth: 380, width: "100%" }}>
                  {pathMode && <span className="input-group-text">{siteHost}/</span>}
                  <input className="form-control" placeholder="your-name" value={username} onChange={(e) => onUsername(e.target.value)} />
                  {!pathMode && <span className="input-group-text">.{host}</span>}
                </div>
                {uname && <small className={uname.available ? "text-success" : "text-danger"}>{uname.available ? "✓ Available" : `✗ ${uname.reason || "Taken"}`}</small>}
              </div>
            ) : <strong className="small">{pathMode ? `${siteHost}/${username}` : `${username}.${host}`}</strong>}
          </div>
          <div className="d-flex align-items-center gap-1" title="Layout (structure)">
            <i className="fas fa-table-cells-large text-muted"></i>
            <select className="form-select form-select-sm" style={{ width: 120 }} value={layout} onChange={(e) => pickLayout(e.target.value)}>
              {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div className="d-flex align-items-center gap-1" title="Color design">
            <i className="fas fa-palette text-muted"></i>
            <select className="form-select form-select-sm" style={{ width: 120 }} value={theme} onChange={(e) => pickTheme(e.target.value)}>
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <button className="btn btn-sm btn-outline-primary" onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
          <button className="btn btn-sm btn-primary" onClick={generate} disabled={busy}><i className="fas fa-rocket me-1"></i> Generate</button>
          {saved && <span className="text-success small">Saved ✓</span>}
        </div>
        {error && <div className="container mt-2"><div className="alert alert-danger py-2 mb-0">{error}</div></div>}
      </div>
      <div className="alert alert-info text-center mb-0 rounded-0 py-2 small"><i className="fas fa-pen me-1"></i> This is your live website. Click any text or image to edit it, add/remove items, then hit <strong>Generate</strong>.</div>

      {/* Hero */}
      <header className="hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <Editable className="greeting d-block" value={data.greeting} onCommit={(v) => touched((d) => { d.greeting = v; })} />
              <Editable tag="h1" value={data.name} onCommit={(v) => touched((d) => { d.name = v; })} />
              <Editable tag="div" className="role" value={data.role} onCommit={(v) => touched((d) => { d.role = v; })} />
              <Editable tag="p" className="tagline" value={data.tagline} onCommit={(v) => touched((d) => { d.tagline = v; })} />
              <div className="hero-cta">
                <span className="btn btn-light btn-rounded"><Editable tag="span" value={data.ctaText} onCommit={(v) => touched((d) => { d.ctaText = v; })} /></span>
                <span className="btn btn-ghost btn-rounded"><Editable tag="span" value={data.resumeText} onCommit={(v) => touched((d) => { d.resumeText = v; })} /></span>
              </div>
              <div className="hero-socials mt-4">
                {SOCIAL_KEYS.filter((k) => k in data.socials).map((k) => (
                  <a key={k} title={`Edit ${k}`} onClick={() => editUrl(`${k} URL`, data.socials[k], (url) => (d) => { d.socials[k] = url; })}>
                    <i className={`fab ${SOCIAL_ICONS[k]}`}></i>
                  </a>
                ))}
              </div>
            </div>
            <div className="col-lg-5">
              <div className="hero-photo-wrap">
                <EditableImage src={data.image} alt={data.name} className="hero-photo" onCommit={(v) => touched((d) => { d.image = v; })} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container stats-strip">
        <div className="row g-4">
          {data.stats.map((s, i) => (
            <div className="col-md-3 col-6" key={s._id}>
              <div className="stat-card">
                <button className="remove-chip float-end" onClick={() => touched((d) => { d.stats.splice(i, 1); })}>×</button>
                <Editable tag="div" className="num" value={s.value} onCommit={(v) => touched((d) => { d.stats[i].value = v; })} />
                <Editable tag="div" className="lbl" value={s.label} onCommit={(v) => touched((d) => { d.stats[i].label = v; })} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-3"><button className="add-btn" onClick={() => touched((d) => { d.stats.push({ _id: newId(), value: "10+", label: "New Stat" }); })}>+ Add stat</button></div>
      </div>

      {/* About */}
      <section className="section-pad" id="about">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-5"><EditableImage src={data.image} alt="" className="about-img" onCommit={(v) => touched((d) => { d.image = v; })} /></div>
            <div className="col-lg-7">
              <div className="eyebrow text-primary fw-bold">About Me</div>
              <Editable tag="h2" className="fw-bold mb-3" value={data.aboutHeading} onCommit={(v) => touched((d) => { d.aboutHeading = v; })} />
              <Editable tag="p" className="text-muted" value={data.about} onCommit={(v) => touched((d) => { d.about = v; })} />
              <ul className="about-list">
                {[["email", "fa-envelope", "Email"], ["phone", "fa-phone", "Phone"], ["location", "fa-location-dot", "Location"], ["availability", "fa-circle-check", "Status"], ["languages", "fa-language", "Languages"]].map(([key, icon, label]) => (
                  <li key={key}><i className={`fas ${icon}`}></i> <strong>{label}</strong> <Editable tag="span" value={data.personal[key]} onCommit={(v) => touched((d) => { d.personal[key] = v; })} /></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-pad bg-soft" id="services">
        <div className="container">
          <Head eyebrow="What I Do" value={data.hServices} onCommit={(v) => touched((d) => { d.hServices = v; })} />
          <div className="row g-4">
            {data.services.map((s, i) => (
              <div className="col-md-6 col-lg-4" key={s._id}>
                <div className="svc-card">
                  <div className="d-flex justify-content-between">
                    <div className="svc-icon"><i className={`fas ${s.icon || "fa-star"}`}></i></div>
                    <button className="remove-chip" style={{ height: 22 }} onClick={() => touched((d) => { d.services.splice(i, 1); })}>×</button>
                  </div>
                  <Editable tag="h5" value={s.title} onCommit={(v) => touched((d) => { d.services[i].title = v; })} />
                  <Editable tag="p" value={s.desc} onCommit={(v) => touched((d) => { d.services[i].desc = v; })} />
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4"><button className="add-btn" onClick={() => touched((d) => { d.services.push({ _id: newId(), icon: "fa-star", title: "New Service", desc: "Describe this service" }); })}>+ Add service</button></div>
        </div>
      </section>

      {/* Skills */}
      <section className="section-pad">
        <div className="container">
          <Head eyebrow="My Expertise" value={data.hSkills} onCommit={(v) => touched((d) => { d.hSkills = v; })} />
          <div className="row gx-5">
            {data.skills.map((s, i) => (
              <div className="col-lg-6" key={s._id}>
                <div className="progress-container">
                  <div className="progress-title">
                    <span className="skill-name d-flex align-items-center gap-2">
                      <Editable value={s.name} onCommit={(v) => touched((d) => { d.skills[i].name = v; })} />
                      <button className="remove-chip" onClick={() => touched((d) => { d.skills.splice(i, 1); })}>×</button>
                    </span>
                    <span className="skill-percent"><Editable tag="span" value={String(s.percent)} onCommit={(v) => touched((d) => { const n = parseInt(v, 10); d.skills[i].percent = isNaN(n) ? 0 : Math.max(0, Math.min(100, n)); })} />%</span>
                  </div>
                  <div className="progress"><div className="progress-bar" style={{ width: `${s.percent}%`, backgroundColor: colorAt(i) }}></div></div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-3"><button className="add-btn" onClick={() => touched((d) => { d.skills.push({ _id: newId(), name: "New Skill", percent: 80 }); })}>+ Add skill</button></div>
        </div>
      </section>

      {/* Projects */}
      <section className="section-pad bg-soft" id="work">
        <div className="container">
          <Head eyebrow="Portfolio" value={data.hWork} onCommit={(v) => touched((d) => { d.hWork = v; })} />
          <div className="row g-4">
            {data.projects.map((p, i) => (
              <div className="col-md-6 col-lg-4" key={p._id}>
                <div className="card border-0 shadow-sm h-100">
                  <EditableImage src={p.image} alt={p.title} className="card-img-top" style={{ height: 170, objectFit: "cover" }} onCommit={(v) => touched((d) => { d.projects[i].image = v; })} />
                  <div className="card-body">
                    <Editable className="text-primary fw-bold small text-uppercase" value={p.category} onCommit={(v) => touched((d) => { d.projects[i].category = v; })} />
                    <Editable tag="h5" className="mt-1" value={p.title} onCommit={(v) => touched((d) => { d.projects[i].title = v; })} />
                    <Editable tag="p" className="text-muted small" value={p.desc} onCommit={(v) => touched((d) => { d.projects[i].desc = v; })} />
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">Link: <Editable tag="span" value={p.url} onCommit={(v) => touched((d) => { d.projects[i].url = v; })} /></small>
                      <button className="remove-chip" onClick={() => touched((d) => { d.projects.splice(i, 1); })}>×</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4"><button className="add-btn" onClick={() => touched((d) => { d.projects.push({ _id: newId(), title: "New Project", category: "Category", image: "https://picsum.photos/seed/" + newId() + "/600/400", desc: "Short description", url: "#" }); })}>+ Add project</button></div>
        </div>
      </section>

      {/* Resume */}
      <section className="section-pad">
        <div className="container">
          <Head eyebrow="My Resume" value={data.hResume} onCommit={(v) => touched((d) => { d.hResume = v; })} />
          <div className="row g-5">
            <div className="col-lg-6 resume-col">
              <h4><i className="fas fa-briefcase text-primary"></i> <Editable tag="span" value={data.hExperience} onCommit={(v) => touched((d) => { d.hExperience = v; })} /></h4>
              <div className="timeline">
                {data.experience.map((e, i) => (
                  <div className="timeline-item" key={e._id}>
                    <button className="remove-chip float-end" onClick={() => touched((d) => { d.experience.splice(i, 1); })}>×</button>
                    <span className="period"><Editable tag="span" value={e.period} onCommit={(v) => touched((d) => { d.experience[i].period = v; })} /></span>
                    <Editable tag="h6" value={e.role} onCommit={(v) => touched((d) => { d.experience[i].role = v; })} />
                    <Editable tag="div" className="org" value={e.company} onCommit={(v) => touched((d) => { d.experience[i].company = v; })} />
                    <Editable tag="p" value={e.desc} onCommit={(v) => touched((d) => { d.experience[i].desc = v; })} />
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={() => touched((d) => { d.experience.push({ _id: newId(), period: "Year", role: "Role", company: "Company", desc: "What you did" }); })}>+ Add</button>
            </div>
            <div className="col-lg-6 resume-col">
              <h4><i className="fas fa-graduation-cap text-primary"></i> <Editable tag="span" value={data.hEducation} onCommit={(v) => touched((d) => { d.hEducation = v; })} /></h4>
              <div className="timeline">
                {data.education.map((e, i) => (
                  <div className="timeline-item" key={e._id}>
                    <button className="remove-chip float-end" onClick={() => touched((d) => { d.education.splice(i, 1); })}>×</button>
                    <span className="period"><Editable tag="span" value={e.period} onCommit={(v) => touched((d) => { d.education[i].period = v; })} /></span>
                    <Editable tag="h6" value={e.degree} onCommit={(v) => touched((d) => { d.education[i].degree = v; })} />
                    <Editable tag="div" className="org" value={e.company} onCommit={(v) => touched((d) => { d.education[i].company = v; })} />
                    <Editable tag="p" value={e.desc} onCommit={(v) => touched((d) => { d.education[i].desc = v; })} />
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={() => touched((d) => { d.education.push({ _id: newId(), period: "Year", degree: "Degree", company: "School", desc: "Details" }); })}>+ Add</button>
            </div>
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="section-pad bg-soft">
        <div className="container">
          <Head eyebrow="Recognition" value={data.hAchievements} onCommit={(v) => touched((d) => { d.hAchievements = v; })} />
          <div className="row g-4">
            {data.achievements.map((a, i) => (
              <div className="col-md-4" key={a._id}>
                <div className="achievement-badge">
                  <div className="achievement-icon"><i className={`fas ${a.icon || "fa-trophy"}`}></i></div>
                  <div className="flex-grow-1">
                    <Editable tag="h6" className="mb-0 fw-bold" value={a.title} onCommit={(v) => touched((d) => { d.achievements[i].title = v; })} />
                    <Editable tag="small" className="text-muted" value={a.subtitle} onCommit={(v) => touched((d) => { d.achievements[i].subtitle = v; })} />
                  </div>
                  <button className="remove-chip" onClick={() => touched((d) => { d.achievements.splice(i, 1); })}>×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4"><button className="add-btn" onClick={() => touched((d) => { d.achievements.push({ _id: newId(), icon: "fa-star", title: "New Award", subtitle: "Year" }); })}>+ Add achievement</button></div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-pad">
        <div className="container">
          <Head eyebrow="Testimonials" value={data.hTestimonials} onCommit={(v) => touched((d) => { d.hTestimonials = v; })} />
          <div className="row g-4">
            {data.testimonials.map((t, i) => (
              <div className="col-md-6 col-lg-4" key={t._id}>
                <div className="testimonial-card">
                  <div className="quote">&ldquo;</div>
                  <Editable tag="p" className="t-text" value={t.text} onCommit={(v) => touched((d) => { d.testimonials[i].text = v; })} />
                  <div className="t-meta">
                    <EditableImage src={t.avatar} alt={t.author} style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }} onCommit={(v) => touched((d) => { d.testimonials[i].avatar = v; })} />
                    <div className="flex-grow-1">
                      <Editable tag="h6" value={t.author} onCommit={(v) => touched((d) => { d.testimonials[i].author = v; })} />
                      <Editable tag="small" className="text-muted d-block" value={t.role} onCommit={(v) => touched((d) => { d.testimonials[i].role = v; })} />
                    </div>
                    <button className="remove-chip" onClick={() => touched((d) => { d.testimonials.splice(i, 1); })}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4"><button className="add-btn" onClick={() => touched((d) => { d.testimonials.push({ _id: newId(), text: "A glowing review...", author: "Client Name", role: "Company", avatar: "https://i.pravatar.cc/100?u=" + newId() }); })}>+ Add testimonial</button></div>
        </div>
      </section>

      {/* Contact */}
      <section className="section-pad bg-soft">
        <div className="container">
          <div className="head">
            <div className="eyebrow">Get In Touch</div>
            <Editable tag="h2" value={data.contactHeading} onCommit={(v) => touched((d) => { d.contactHeading = v; })} />
            <div className="bar"></div>
            <Editable tag="p" value={data.contactText} onCommit={(v) => touched((d) => { d.contactText = v; })} />
          </div>
          <div className="row g-4">
            <div className="col-lg-5">
              {[["email", "fa-envelope", "Email"], ["phone", "fa-phone", "Phone"], ["location", "fa-location-dot", "Location"]].map(([key, icon, label]) => (
                <div className="contact-info-card" key={key}>
                  <div className="ci-icon"><i className={`fas ${icon}`}></i></div>
                  <div><h6>{label}</h6><Editable tag="span" value={data.personal[key]} onCommit={(v) => touched((d) => { d.personal[key] = v; })} /></div>
                </div>
              ))}
            </div>
            <div className="col-lg-7">
              <div className="contact-form">
                <div className="row g-3">
                  <div className="col-md-6"><input className="form-control" placeholder="Your Name" disabled /></div>
                  <div className="col-md-6"><input className="form-control" placeholder="Your Email" disabled /></div>
                  <div className="col-12"><input className="form-control" placeholder="Subject" disabled /></div>
                  <div className="col-12"><textarea className="form-control" rows="4" placeholder="Your Message" disabled></textarea></div>
                  <div className="col-12"><span className="btn btn-primary btn-rounded disabled">Send Message</span> <small className="text-muted ms-2">(works on your live site)</small></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container">
          <h4>{data.name}</h4>
          <p className="mb-0">{data.role}</p>
          <div className="copyright mt-3">This footer appears on your published site.</div>
        </div>
      </footer>
    </div>
  );
}
