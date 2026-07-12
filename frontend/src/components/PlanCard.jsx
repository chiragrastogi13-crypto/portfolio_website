// One pricing plan card. Shared by the Home pricing section and the Subscribe
// flow so both stay visually in sync. `onChoose(plan)` fires on the CTA.
export default function PlanCard({ plan, onChoose }) {
  const p = plan;
  return (
    <div className={`plan-card ${p.popular ? "plan-card--popular" : ""}`}>
      {p.badge && <span className="plan-badge">{p.badge}</span>}

      <div className="plan-head">
        <div className="plan-name">{p.name}</div>
        {p.tagline && <div className="plan-tagline">{p.tagline}</div>}
      </div>

      <div className="plan-price">
        <span className="cur">₹</span>{p.price}
        <span className="per">/ {p.period}</span>
      </div>

      {p.domain && (
        <div className="plan-domain" title="Your published URL">
          <i className="fas fa-globe"></i>
          <span>{p.domain}</span>
        </div>
      )}

      <ul className="plan-features">
        {p.features.map((f) => (
          <li key={f}><i className="fas fa-check"></i><span>{f}</span></li>
        ))}
      </ul>

      <button
        className={`btn plan-cta ${p.popular ? "btn-primary" : "btn-outline-primary"}`}
        onClick={() => onChoose(p)}
      >
        Choose {p.name}
      </button>
    </div>
  );
}
