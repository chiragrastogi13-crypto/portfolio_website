import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { PLANS } from "../data.js";
import PlanCard from "../components/PlanCard.jsx";

export default function Subscribe() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("plans"); // plans | pay
  const [plan, setPlan] = useState(null);
  const [upi, setUpi] = useState(null); // {vpa, name}
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pstatus, setPstatus] = useState(null); // none | pending | approved | rejected
  const [preason, setPreason] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => { api.paymentInfo().then(setUpi).catch(() => {}); }, []);
  useEffect(() => {
    api.myPaymentStatus()
      .then((s) => { setPstatus(s.status); setPreason(s.reason || ""); })
      .catch(() => setPstatus("none"))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="text-center py-5">Loading…</div>;

  // Already paid & approved → straight to the editor.
  if (user?.is_subscribed || pstatus === "approved") {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card border-0 shadow-sm my-5 text-center">
          <div className="card-body p-5">
            <div style={{ fontSize: "3rem" }}>✅</div>
            <h2 className="h4">You're all set</h2>
            <p className="text-muted">Your payment was approved and your account is active.</p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/editor")}>Open the editor →</button>
          </div>
        </div>
      </div>
    );
  }

  // Payment submitted, waiting for admin to verify.
  if (pstatus === "pending") {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card border-0 shadow-sm my-5 text-center">
          <div className="card-body p-5">
            <div style={{ fontSize: "3rem" }}>⏳</div>
            <h2 className="h4">Payment under review</h2>
            <p className="text-muted">
              Thanks! We've received your payment details. An admin will verify it shortly —
              once approved, your portfolio editor unlocks automatically. Please check back soon.
            </p>
            <button className="btn btn-outline-primary" onClick={() => window.location.reload()}>Refresh status</button>
          </div>
        </div>
      </div>
    );
  }

  const choose = (p) => { setPlan(p); setStep("pay"); setError(""); };

  const upiUri = () => {
    if (!upi || !plan) return "#";
    const q = new URLSearchParams({
      pa: upi.vpa, pn: upi.name, am: String(plan.price), cu: "INR",
      tn: `Website Lelo - ${plan.name}`,
    });
    return `upi://pay?${q.toString()}`;
  };

  const qrSrc = plan ? `${api.base}/api/payment/qr?amount=${plan.price}&note=${encodeURIComponent("Website Lelo - " + plan.name)}` : "";

  const copyVpa = async () => {
    try { await navigator.clipboard.writeText(upi.vpa); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) {}
  };

  const confirmPaid = async () => {
    setBusy(true); setError("");
    try {
      // Submit a payment claim for admin verification (not unlocked yet).
      await api.claimPayment(plan.name, plan.price, ref);
      setPstatus("pending");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ---------------- Step 1: Pricing ----------------
  if (step === "plans") {
    return (
      <main className="container py-5">
        <div className="text-center mb-5">
          <span className="badge rounded-pill text-bg-light">Step 2 · Choose a plan</span>
          <h2 className="fw-bold mt-2">Simple, yearly pricing</h2>
          <p className="text-muted">One payment unlocks the editor for a full year. Pick a plan and pay securely via UPI.</p>
          {pstatus === "rejected" && (
            <div className="alert alert-warning d-inline-block text-start">
              <strong>Your previous payment couldn't be verified.</strong>
              {preason && <div className="mt-1">Reason: {preason}</div>}
              <div className="mt-1">Please pay again and resubmit.</div>
            </div>
          )}
        </div>
        <div className="row g-4 justify-content-center pricing-grid">
          {PLANS.map((p) => (
            <div className="col-md-6 col-lg-4" key={p.id}>
              <PlanCard plan={p} onChoose={choose} />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ---------------- Step 2: UPI / QR payment ----------------
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card border-0 shadow-sm my-5">
        <div className="card-body p-4 p-md-5">
          <button className="btn btn-sm btn-link text-decoration-none px-0 mb-2" onClick={() => setStep("plans")}>
            <i className="fas fa-arrow-left me-1"></i> Back to plans
          </button>
          <h2 className="h4 fw-bold">Pay ₹{plan.price} via UPI</h2>
          <p className="text-muted">Plan: <strong>{plan.name}</strong> · Scan the QR with any UPI app (GPay, PhonePe, Paytm…) or use the UPI ID below.</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="row g-4 align-items-center">
            <div className="col-md-5 text-center">
              <div className="p-3 bg-white d-inline-block rounded shadow-sm" style={{ border: "1px solid var(--border, #e5e7eb)" }}>
                <img src={qrSrc} alt="UPI QR code" width="220" height="220" style={{ display: "block" }} />
              </div>
              <div className="text-muted small mt-2">Scan to pay ₹{plan.price}</div>
            </div>

            <div className="col-md-7">
              <label className="form-label fw-semibold mb-1">UPI ID</label>
              <div className="input-group mb-3">
                <input className="form-control" value={upi?.vpa || "loading…"} readOnly />
                <button className="btn btn-outline-secondary" onClick={copyVpa}>{copied ? "Copied ✓" : "Copy"}</button>
              </div>

              <a href={upiUri()} className="btn btn-primary w-100 mb-3"><i className="fas fa-mobile-screen me-2"></i>Open in UPI app</a>

              <label className="form-label fw-semibold mb-1">UPI Transaction / Reference ID <span className="text-muted fw-normal">(optional)</span></label>
              <input className="form-control mb-3" placeholder="e.g. 4012 3456 7890" value={ref} onChange={(e) => setRef(e.target.value)} />

              <button className="btn btn-success w-100 btn-lg" onClick={confirmPaid} disabled={busy}>
                {busy ? "Submitting…" : "I've paid — Submit for verification"}
              </button>
              <p className="text-muted small mt-2 mb-0">After paying, enter your UPI reference and submit. An admin will verify it and unlock your editor.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
