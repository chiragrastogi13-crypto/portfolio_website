import { useEffect, useState } from "react";
import { api } from "../api";

const BADGE = {
  approved: "text-bg-success",
  rejected: "text-bg-danger",
  pending: "text-bg-warning",
  disapproved: "text-bg-danger",
};

// --- Users tab --------------------------------------------------------------
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.adminUsers().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body d-flex justify-content-between align-items-center">
        <div>
          <strong>{users.length}</strong> registered user{users.length === 1 ? "" : "s"}
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={load}><i className="fas fa-rotate me-1"></i>Refresh</button>
      </div>
      {error && <div className="alert alert-danger m-3">{error}</div>}
      {loading ? (
        <div className="text-center py-5">Loading users…</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th><th>Email</th><th>Role</th><th>Status</th><th>Subscribed</th><th>Portfolio</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No users yet.</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-muted">{u.id}</td>
                  <td className="fw-semibold">{u.email}</td>
                  <td>{u.is_admin ? <span className="badge text-bg-dark">Admin</span> : <span className="badge text-bg-light">User</span>}</td>
                  <td><span className={`badge ${BADGE[u.status] || "text-bg-secondary"}`}>{u.status}</span></td>
                  <td>{u.is_subscribed ? <span className="text-success"><i className="fas fa-check"></i></span> : <span className="text-muted">—</span>}</td>
                  <td>
                    {u.has_portfolio ? (
                      u.portfolio_url
                        ? <a href={u.portfolio_url} target="_blank" rel="noopener noreferrer">{u.portfolio_username} <i className="fas fa-arrow-up-right-from-square ms-1 small"></i></a>
                        : <span title="Not published yet">{u.portfolio_username} <span className="text-muted small">(draft)</span></span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted small">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Payments tab -----------------------------------------------------------
function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("pending");

  const load = () => {
    setLoading(true);
    api.adminPayments().then(setPayments).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (id, fn) => {
    setBusyId(id); setError("");
    try {
      const updated = await fn(id);
      setPayments((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  const reject = async (id) => {
    const reason = window.prompt("Reason for rejecting this payment? (emailed to the user)", "Payment not received / details didn't match.");
    if (reason === null) return;
    setBusyId(id); setError("");
    try {
      const updated = await api.rejectPayment(id, reason);
      setPayments((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  const shown = payments.filter((p) => filter === "all" || p.status === filter);
  const count = (s) => payments.filter((p) => p.status === s).length;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center justify-content-between">
        <div className="d-flex flex-wrap gap-2">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}{f !== "all" && <span className="badge text-bg-light ms-1">{count(f)}</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={load}><i className="fas fa-rotate me-1"></i>Refresh</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div className="text-center py-5">Loading payments…</div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>#</th><th>User</th><th>Plan</th><th>Amount</th><th>UPI Ref / UTR</th><th>Status</th><th>Date</th><th className="text-end">Actions</th></tr>
              </thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan="8" className="text-center text-muted py-4">No payments in this view.</td></tr>}
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td className="text-muted">{p.id}</td>
                    <td>{p.user_email}</td>
                    <td>{p.plan}</td>
                    <td className="fw-semibold">₹{p.amount}</td>
                    <td>{p.reference ? <code>{p.reference}</code> : <span className="text-muted">—</span>}</td>
                    <td><span className={`badge ${BADGE[p.status] || "text-bg-secondary"}`}>{p.status}</span></td>
                    <td className="text-muted small">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-success" disabled={busyId === p.id || p.status === "approved"} onClick={() => act(p.id, api.approvePayment)}>Approve</button>
                        <button className="btn btn-outline-danger" disabled={busyId === p.id || p.status === "rejected"} onClick={() => reject(p.id)}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("users");
  return (
    <main className="container py-5">
      <div className="mb-4">
        <h2 className="fw-bold mb-1"><i className="fas fa-user-shield text-primary me-2"></i>Admin Panel</h2>
        <p className="text-muted mb-0">Manage users and review payments.</p>
      </div>

      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button className={`nav-link ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
            <i className="fas fa-users me-1"></i>Users
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "payments" ? "active" : ""}`} onClick={() => setTab("payments")}>
            <i className="fas fa-indian-rupee-sign me-1"></i>Payments
          </button>
        </li>
      </ul>

      {tab === "users" ? <UsersTab /> : <PaymentsTab />}
    </main>
  );
}
