// Thin API client around fetch. Stores the JWT in localStorage and attaches it.
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1.nip.io:8000";

const TOKEN_KEY = "ps_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers["Authorization"] = `Bearer ${getToken()}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (_) {}
    const err = new Error(typeof detail === "string" ? detail : "Request failed");
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  // NOTE: don't set Content-Type — the browser adds the multipart boundary.
  const headers = {};
  if (getToken()) headers["Authorization"] = `Bearer ${getToken()}`;
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", headers, body: fd });
  if (!res.ok) {
    let detail = "Upload failed";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json(); // { url }
}

export const api = {
  base: API_BASE,
  uploadImage,
  // auth
  register: (email, password) =>
    request("/api/auth/register", { method: "POST", body: { email, password }, auth: false }),
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  // subscription
  subscribe: () => request("/api/subscribe", { method: "POST" }),
  // portfolio
  getPortfolio: () => request("/api/portfolio"),
  createPortfolio: (data) => request("/api/portfolio", { method: "POST", body: data }),
  updatePortfolio: (data) => request("/api/portfolio", { method: "PUT", body: data }),
  changeUsername: (username) =>
    request("/api/portfolio/username", { method: "PUT", body: { username } }),
  generate: () => request("/api/portfolio/generate", { method: "POST" }),
  checkUsername: (u) =>
    request(`/api/portfolio/check-username?username=${encodeURIComponent(u)}`),
  // samples
  samples: () => request("/api/samples", { auth: false }),
  sampleData: (slug) => request(`/api/samples/${encodeURIComponent(slug)}`, { auth: false }),
  // payment
  paymentInfo: () => request("/api/payment/info", { auth: false }),
  claimPayment: (plan, amount, reference) =>
    request("/api/payment/claim", { method: "POST", body: { plan, amount, reference } }),
  myPaymentStatus: () => request("/api/payment/my-status"),
  // admin
  adminStats: () => request("/api/admin/stats"),
  adminUsers: () => request("/api/admin/users"),
  blockUser: (id) => request(`/api/admin/users/${id}/block`, { method: "POST" }),
  unblockUser: (id) => request(`/api/admin/users/${id}/unblock`, { method: "POST" }),
  deleteUserPortfolio: (id) => request(`/api/admin/users/${id}/portfolio`, { method: "DELETE" }),
  adminPayments: () => request("/api/admin/payments"),
  approvePayment: (id) => request(`/api/admin/payments/${id}/approve`, { method: "POST" }),
  rejectPayment: (id, reason) => request(`/api/admin/payments/${id}/reject`, { method: "POST", body: { reason } }),
  // hiring board — requirements + applications
  requirements: () => request("/api/requirements", { auth: false }),
  myRequirements: () => request("/api/requirements?mine=true"),
  requirement: (id) => request(`/api/requirements/${id}`, { auth: false }),
  createRequirement: (body) => request("/api/requirements", { method: "POST", body }),
  closeRequirement: (id) => request(`/api/requirements/${id}/close`, { method: "POST" }),
  deleteRequirement: (id) => request(`/api/requirements/${id}`, { method: "DELETE" }),
  applyToRequirement: (id, body) => request(`/api/requirements/${id}/apply`, { method: "POST", body }),
  requirementApplications: (id) => request(`/api/requirements/${id}/applications`),
  myApplications: () => request("/api/requirements/my/applications"),
  acceptApplication: (id) => request(`/api/requirements/applications/${id}/accept`, { method: "POST" }),
  rejectApplication: (id) => request(`/api/requirements/applications/${id}/reject`, { method: "POST" }),
};
