import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

const statusBadge = (s) =>
  ({ pending: "bg-warning text-dark", accepted: "bg-success", rejected: "bg-danger", open: "bg-success", closed: "bg-secondary" }[s] || "bg-secondary");

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, s] of units) {
    const n = Math.floor(secs / s);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function RequirementCard({ r }) {
  return (
    <div className="col-md-6 col-lg-4">
      <Link to={`/hire/${r.id}`} className="card border-0 shadow-sm h-100 text-decoration-none text-reset">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <h3 className="h5 mb-0">{r.title}</h3>
            <span className={`badge ${statusBadge(r.status)} text-capitalize`}>{r.status}</span>
          </div>
          <div className="text-muted small mt-1">
            {r.location && <><i className="fas fa-location-dot me-1"></i>{r.location} · </>}
            {r.budget && <><i className="fas fa-indian-rupee-sign me-1"></i>{r.budget} · </>}
            posted {timeAgo(r.created_at)}
          </div>
          <p className="text-muted mt-2 mb-3" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {r.description || "No description provided."}
          </p>
          <div className="d-flex flex-wrap gap-1 mb-3">
            {r.skills.slice(0, 5).map((sk) => (
              <span className="tag" key={sk} style={{ background: "#ece9fb", color: "#5546d6" }}>{sk}</span>
            ))}
          </div>
          <div className="mt-auto d-flex justify-content-between align-items-center small">
            <span className="text-muted"><i className="fas fa-user me-1"></i>{r.poster_email}</span>
            <span className="fw-semibold" style={{ color: "#6c5ce7" }}>
              {r.application_count} applicant{r.application_count === 1 ? "" : "s"} →
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function PostForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ title: "", description: "", skills: "", budget: "", location: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const created = await api.createRequirement(form);
      onCreated(created);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body">
        <h3 className="h5 mb-3">Post a requirement</h3>
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Title *</label>
            <input className="form-control" value={form.title} onChange={set("title")}
              placeholder="e.g. Need a React developer for a 2-week landing page" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={4} value={form.description} onChange={set("description")}
              placeholder="Describe the work, deliverables, timeline…" />
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Skills (comma-separated)</label>
              <input className="form-control" value={form.skills} onChange={set("skills")} placeholder="React, Figma, SEO" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Budget</label>
              <input className="form-control" value={form.budget} onChange={set("budget")} placeholder="₹20,000 or $500" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Location</label>
              <input className="form-control" value={form.location} onChange={set("location")} placeholder="Remote" />
            </div>
          </div>
          <div className="mt-3 d-flex gap-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? "Posting…" : "Post requirement"}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Hire() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("browse"); // browse | mine | applied
  const [showForm, setShowForm] = useState(false);
  const [reqs, setReqs] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "applied") {
        setApps(await api.myApplications());
      } else if (tab === "mine") {
        setReqs(await api.myRequirements());
      } else {
        setReqs(await api.requirements());
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const goTab = (t) => {
    if ((t === "mine" || t === "applied") && !user) {
      navigate("/login", { state: { from: "/hire" } });
      return;
    }
    setShowForm(false);
    setTab(t);
  };

  const startPost = () => {
    if (!user) { navigate("/login", { state: { from: "/hire" } }); return; }
    setShowForm(true);
  };

  return (
    <main className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div className="head text-start mb-0">
          <div className="eyebrow">Hiring board</div>
          <h2 className="mb-1">Find talent · Get hired</h2>
          <p className="text-muted mb-0">Post what you need, or approach open requirements with your portfolio.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={startPost}>+ Post a requirement</button>
      </div>

      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item"><button className={`nav-link ${tab === "browse" ? "active" : ""}`} onClick={() => goTab("browse")}>Browse all</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === "mine" ? "active" : ""}`} onClick={() => goTab("mine")}>My postings</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === "applied" ? "active" : ""}`} onClick={() => goTab("applied")}>My applications</button></li>
      </ul>

      {showForm && <PostForm onCancel={() => setShowForm(false)} onCreated={(r) => { setShowForm(false); navigate(`/hire/${r.id}`); }} />}

      {loading && <div className="text-center py-5">Loading…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && tab === "applied" && (
        apps.length === 0 ? (
          <div className="text-center text-muted py-5">You haven't applied to anything yet. <Link to="#" onClick={(e) => { e.preventDefault(); goTab("browse"); }}>Browse requirements →</Link></div>
        ) : (
          <div className="row g-3">
            {apps.map((a) => (
              <div className="col-12" key={a.id}>
                <div className="card border-0 shadow-sm">
                  <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                      <Link to={`/hire/${a.requirement_id}`} className="h6 mb-1 d-block text-reset">{a.requirement_title}</Link>
                      {a.message && <div className="text-muted small">"{a.message.slice(0, 120)}"</div>}
                      {a.proposed_budget && <div className="small mt-1">Your quote: <strong>{a.proposed_budget}</strong></div>}
                    </div>
                    <span className={`badge ${statusBadge(a.status)} text-capitalize fs-6`}>{a.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && !error && tab !== "applied" && (
        reqs.length === 0 ? (
          <div className="text-center text-muted py-5">
            {tab === "mine" ? "You haven't posted any requirements yet." : "No open requirements yet — be the first to post one!"}
          </div>
        ) : (
          <div className="row g-4">
            {reqs.map((r) => <RequirementCard r={r} key={r.id} />)}
          </div>
        )
      )}
    </main>
  );
}
