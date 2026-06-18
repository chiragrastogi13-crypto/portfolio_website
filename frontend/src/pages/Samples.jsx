import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { THEMES, themeGradient, layoutLabel } from "../data.js";

const themeLabel = (id) => (THEMES.find((t) => t.id === id) || THEMES[0]).label;

export default function Samples() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.samples().then(setSamples).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  // Entry point into the subscribe → edit → generate flow.
  const startBuilding = () => {
    if (!user) navigate("/register", { state: { from: "/subscribe" } });
    else if (!user.is_subscribed) navigate("/subscribe");
    else navigate("/editor");
  };

  // Each sample's full live website is server-rendered by the backend.
  const sampleUrl = (slug) => `${api.base}/sample/${slug}`;

  return (
    <main className="container py-5">
      <div className="head text-start mb-4">
        <div className="eyebrow">Showcase · 10 Designs</div>
        <h2 className="mb-1">Pick a design you love</h2>
        <p className="text-muted">Each sample uses a different professional design. Click any one to open its full live website — then build yours in that same design.</p>
      </div>

      {loading && <div className="text-center py-5">Loading samples…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        {samples.map((s) => (
          <div className="col-md-6 col-lg-4" key={s.slug}>
            <a
              href={sampleUrl(s.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="card border-0 shadow-sm h-100 sample-card text-decoration-none"
              style={{ color: "inherit" }}
            >
              <div className="sample-top" style={{ background: themeGradient(s.theme) }}>
                <span className="design-badge" style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.9)" }}>
                  <i className="fas fa-table-cells-large me-1"></i>{layoutLabel(s.layout)}
                </span>
                <span className="design-badge" style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.9)" }}>
                  <i className="fas fa-palette me-1"></i>{themeLabel(s.theme)}
                </span>
              </div>
              <div className="card-body">
                {s.avatar_url && <img className="sample-av" src={s.avatar_url} alt={s.full_name} />}
                <h3 className="h5 mt-2">{s.full_name}</h3>
                <div className="fw-semibold" style={{ color: "#6c5ce7" }}>{s.title}</div>
                <p className="text-muted small mt-2">{s.bio}</p>
                <div className="d-flex flex-wrap">{s.skills.slice(0, 4).map((sk) => <span className="tag" key={sk} style={{ background: "#ece9fb", color: "#5546d6" }}>{sk}</span>)}</div>
                <div className="mt-3 fw-semibold" style={{ color: "#6c5ce7" }}>View live website <i className="fas fa-arrow-up-right-from-square ms-1 small"></i></div>
              </div>
            </a>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm text-center mt-5">
        <div className="card-body py-5">
          <h2 className="h4">Ready to create your own?</h2>
          <p className="text-muted">Subscribe to unlock the editor, customize the pre-filled design, and generate your link.</p>
          <button className="btn btn-primary btn-lg" onClick={startBuilding}>Create your portfolio →</button>
        </div>
      </div>
    </main>
  );
}
