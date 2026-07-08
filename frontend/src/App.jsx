import { useEffect, useState } from "react";
import { Routes, Route, Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Home from "./pages/Home.jsx";
import Samples from "./pages/Samples.jsx";
import Subscribe from "./pages/Subscribe.jsx";
import Editor from "./pages/Editor.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Result from "./pages/Result.jsx";
import Admin from "./pages/Admin.jsx";
import Hire from "./pages/Hire.jsx";
import HireDetail from "./pages/HireDetail.jsx";

function Nav() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // Subtle elevation once the page scrolls, so the glass header reads as "lifted".
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`navbar navbar-expand-lg navbar-light pub-nav sticky-top ${scrolled ? "pub-nav-scrolled" : ""}`}>
      <div className="container">
        <Link to="/" className="navbar-brand d-flex align-items-center gap-2">
          <span className="nav-logo">✨</span>Website<span>Lelo</span>
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
            <li className="nav-item"><NavLink to="/" end className="nav-link">Home</NavLink></li>
            <li className="nav-item"><NavLink to="/samples" className="nav-link">Portfolio Samples</NavLink></li>
            <li className="nav-item"><NavLink to="/hire" className="nav-link">Hiring Board</NavLink></li>
            {user ? (
              <>
                {user.is_admin ? (
                  <li className="nav-item"><NavLink to="/admin" className="nav-link"><i className="fas fa-user-shield me-1"></i>Admin</NavLink></li>
                ) : (
                  <li className="nav-item"><NavLink to="/editor" className="nav-link">My Portfolio</NavLink></li>
                )}
                <li className="nav-item"><a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a></li>
              </>
            ) : (
              <>
                <li className="nav-item"><NavLink to="/login" className="nav-link">Login</NavLink></li>
                <li className="nav-item ms-lg-2"><Link to="/register" className="btn btn-primary btn-sm rounded-pill px-3 glow-btn">Get started</Link></li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="text-center py-5">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-5">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return children;
}


export default function App() {
  const location = useLocation();
  // The editor is a full-screen, immersive page (its own toolbar), so we hide
  // the site nav and footer there.
  const immersive = location.pathname === "/editor";

  return (
    <>
      {!immersive && <Nav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/samples" element={<Samples />} />
        <Route path="/hire" element={<Hire />} />
        <Route path="/hire/:id" element={<HireDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/subscribe" element={<RequireAuth><Subscribe /></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="/result" element={<RequireAuth><Result /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<div className="text-center py-5">Page not found. <Link to="/">Go home</Link></div>} />
      </Routes>
      {!immersive && (
        <footer className="text-center text-muted py-4 border-top mt-4">
          <div className="container">© {new Date().getFullYear()} Website Lelo — built with FastAPI + React</div>
        </footer>
      )}
    </>
  );
}
