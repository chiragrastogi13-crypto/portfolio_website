import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";

const statusBadge = (s) =>
  ({ pending: "bg-warning text-dark", accepted: "bg-success", rejected: "bg-danger", open: "bg-success", closed: "bg-secondary" }[s] || "bg-secondary");

function ApplyForm({ reqId, onApplied }) {
  const [form, setForm] = useState({ message: "", proposed_budget: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await api.applyToRequirement(reqId, form);
      onApplied();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h3 className="h5 mb-3">Approach this requirement</h3>
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Your message</label>
            <textarea className="form-control" rows={4} value={form.message} onChange={set("message")}
              placeholder="Introduce yourself and explain why you're a good fit…" />
          </div>
          <div className="mb-3">
            <label className="form-label">Proposed budget / rate (optional)</label>
            <input className="form-control" value={form.proposed_budget} onChange={set("proposed_budget")} placeholder="₹18,000 or $40/hr" />
          </div>
          <p className="text-muted small">Your published portfolio link (if any) is automatically attached so the poster can view your work.</p>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Sending…" : "Send application"}</button>
        </form>
      </div>
    </div>
  );
}

function Applicants({ reqId }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApps(await api.requirementApplications(reqId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [reqId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, action) => {
    try {
      const updated = action === "accept" ? await api.acceptApplication(id) : await api.rejectApplication(id);
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="text-muted py-3">Loading applicants…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      <h3 className="h5 mb-3">Applicants ({apps.length})</h3>
      {apps.length === 0 && <div className="text-muted">No one has applied yet.</div>}
      <div className="d-flex flex-column gap-3">
        {apps.map((a) => (
          <div className="card border-0 shadow-sm" key={a.id}>
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div>
                  <strong>{a.applicant_email}</strong>
                  <span className={`badge ms-2 ${statusBadge(a.status)} text-capitalize`}>{a.status}</span>
                </div>
                {a.proposed_budget && <span className="text-muted">Quote: <strong>{a.proposed_budget}</strong></span>}
              </div>
              {a.message && <p className="mt-2 mb-2">{a.message}</p>}
              {a.portfolio_url && (
                <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="d-inline-block mb-2">
                  <i className="fas fa-arrow-up-right-from-square me-1"></i>View portfolio
                </a>
              )}
              {a.status === "pending" && (
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-sm btn-success" onClick={() => decide(a.id, "accept")}>Accept</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => decide(a.id, "reject")}>Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function HireDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setR(await api.requirement(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const close = async () => {
    if (!confirm("Close this requirement? It will stop accepting new applications.")) return;
    setR(await api.closeRequirement(id));
  };
  const remove = async () => {
    if (!confirm("Delete this requirement permanently?")) return;
    await api.deleteRequirement(id);
    navigate("/hire");
  };

  if (loading) return <main className="container py-5"><div className="text-center">Loading…</div></main>;
  if (error) return <main className="container py-5"><div className="alert alert-danger">{error}</div><Link to="/hire">← Back to board</Link></main>;

  return (
    <main className="container py-5" style={{ maxWidth: 860 }}>
      <Link to="/hire" className="text-muted small d-inline-block mb-3">← Back to board</Link>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <h1 className="h3 mb-0">{r.title}</h1>
            <span className={`badge ${statusBadge(r.status)} text-capitalize fs-6`}>{r.status}</span>
          </div>
          <div className="text-muted small mt-2">
            <i className="fas fa-user me-1"></i>{r.poster_email}
            {r.location && <> · <i className="fas fa-location-dot me-1"></i>{r.location}</>}
            {r.budget && <> · <i className="fas fa-indian-rupee-sign me-1"></i>{r.budget}</>}
          </div>
          {r.description && <p className="mt-3" style={{ whiteSpace: "pre-wrap" }}>{r.description}</p>}
          {r.skills.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mt-2">
              {r.skills.map((sk) => <span className="tag" key={sk} style={{ background: "#ece9fb", color: "#5546d6" }}>{sk}</span>)}
            </div>
          )}
          {r.is_mine && (
            <div className="d-flex gap-2 mt-3">
              {r.status === "open" && <button className="btn btn-sm btn-outline-secondary" onClick={close}>Close requirement</button>}
              <button className="btn btn-sm btn-outline-danger" onClick={remove}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Poster view: manage applicants. Applicant view: apply. */}
      {r.is_mine ? (
        <Applicants reqId={id} />
      ) : r.status !== "open" ? (
        <div className="alert alert-secondary">This requirement is closed and no longer accepting applications.</div>
      ) : !user ? (
        <div className="card border-0 shadow-sm"><div className="card-body text-center py-4">
          <p className="mb-3">Log in to approach this requirement.</p>
          <Link to="/login" state={{ from: `/hire/${id}` }} className="btn btn-primary">Log in to apply</Link>
        </div></div>
      ) : r.has_applied ? (
        <div className="alert alert-success"><i className="fas fa-check me-2"></i>You've already applied to this requirement. The poster can see your application.</div>
      ) : (
        <ApplyForm reqId={id} onApplied={load} />
      )}
    </main>
  );
}
