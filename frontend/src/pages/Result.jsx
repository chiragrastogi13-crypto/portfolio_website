import { useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";

// Step 4: the generated link.
export default function Result() {
  const location = useLocation();
  const url = location.state?.url;
  const username = location.state?.username;
  const [copied, setCopied] = useState(false);

  if (!url) return <Navigate to="/editor" replace />;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) {}
  };

  return (
    <div className="container" style={{ maxWidth: 620 }}>
      <div className="card border-0 shadow-sm my-5 text-center">
        <div className="card-body p-5">
          <div style={{ fontSize: "3rem" }}>🎉</div>
          <h2 className="h3">Your portfolio is live!</h2>
          <p className="text-muted">
            Congratulations{username ? `, ${username}` : ""} — your portfolio has been generated and published. Share this link with anyone:
          </p>
          <div className="input-group my-4">
            <input className="form-control" value={url} readOnly />
            <button className="btn btn-primary" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <a className="btn btn-primary btn-lg" href={url} target="_blank" rel="noopener noreferrer">Open my portfolio →</a>
            <Link className="btn btn-outline-primary btn-lg" to="/editor">Keep editing</Link>
          </div>
          <p className="text-muted small mt-4 mb-0">
            This link works because <code>*.127.0.0.1.nip.io</code> resolves to your local machine.
          </p>
        </div>
      </div>
    </div>
  );
}
