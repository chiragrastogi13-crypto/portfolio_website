import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/editor";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await login(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container" style={{ maxWidth: 460 }}>
      <div className="card border-0 shadow-sm my-5">
        <div className="card-body p-4">
          <h2 className="h4">Welcome back</h2>
          <p className="text-muted">Log in to manage your portfolio.</p>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <div className="input-group">
                <input type={showPassword ? "text" : "password"} className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((s) => !s)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
              </div>
            </div>
            <button className="btn btn-primary w-100" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          </form>
          <p className="text-muted small mt-3 mb-0">No account? <Link to="/register">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}
