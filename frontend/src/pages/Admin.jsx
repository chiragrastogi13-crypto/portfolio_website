import { useEffect, useState } from "react";
import { api } from "../api";

const BADGE = {
  approved: "text-bg-success",
  rejected: "text-bg-danger",
  pending: "text-bg-warning",
};

export default function Admin() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("pending");

  const load = () => {
    setLoading(true);
    api.adminPayments()
      .then(setPayments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (id, fn) => {
    setBusyId(id);
    setError("");
    try {
      const updated = await fn(id);
      setPayments((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Rejecting asks for a reason — it's emailed to the user.
  const reject = async (id) => {
    const reason = window.prompt(
      "Reason for rejecting this payment? (emailed to the user)",
      "Payment not received / details didn't match."
    );
    if (reason === null) return;
    setBusyId(id);
    setError("");
    try {
      const updated = await api.rejectPayment(id, reason);
      setPayments((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const shown = payments.filter((p) => filter === "all" || p.status === filter);
  const count = (s) => payments.filter((p) => p.status === s).length;

  return (
    <main className="container py-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-2">
        <div>
          <h2 className="fw-bold mb-1"><i className="fas fa-indian-rupee-sign text-primary me-2"></i>Payment Approvals</h2>
          <p className="text-muted mb-0">Check each payment in your UPI/bank app, then Approve to unlock that user's editor.</p>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={load}><i className="fas fa-rotate me-1"></i>Refresh</button>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {["pending", "approved", "rejected", "all"].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
            {f !== "all" && <span className="badge text-bg-light ms-1">{count(f)}</span>}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div className="text-center py-5">Loading payments…</div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th><th>User</th><th>Plan</th><th>Amount</th><th>UPI Ref / UTR</th><th>Status</th><th>Date</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No payments in this view.</td></tr>
                )}
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
    </main>
  );
}
