import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Upload, LayoutDashboard, IdCard, Shield, Mail, User, Hash, ChevronRight } from "lucide-react";
import Dashboard from "../components/Dashboard";
import UploadCSV from "../components/UploadCSV";
import "../style/Home.css";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Redirect to login if there's no session
  useEffect(() => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (!token) navigate("/login", { replace: true });
  }, [navigate]);

  // Load user object
  useEffect(() => {
    const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
    if (!raw) return;
    try { setUser(JSON.parse(raw)); } catch {}
  }, []);


  const displayName = useMemo(() => {
    if (!user) return "";
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return full || user.name || user.username || user.email || "User";
  }, [user]);

  const role = user?.role || user?.userRole || "Member";
  const username = user?.username || user?.userName || "—";
  const email = user?.email || user?.mail || "—";
  const id = user?._id || user?.id || "—";

  const onLogout = () => {
    // clear both, just in case
    localStorage.removeItem("token"); localStorage.removeItem("user");
    sessionStorage.removeItem("token"); sessionStorage.removeItem("user");
    sessionStorage.removeItem("AUDIT_CODE");
    navigate("/login", { replace: true });
  };

  return (
    <div className="home-root">
      {/* Top header */}
      <header className="home-header">
        <div className="brand">
          <div className="brand-logo">OB</div>
          <div className="brand-text">
            <div className="brand-title">Only B2B</div>
            <div className="brand-sub">People Platform</div>
          </div>
        </div>
        <button className="btn-out" onClick={onLogout} aria-label="Log out">
          <LogOut size={16}/> <span>Log out</span>
        </button>
      </header>

      {/* Welcome & profile */}
      <section className="hero">
        {/* <div className="hero-copy">
          <h1 className="h1">Welcome back{displayName ? ", " : ""}{displayName} 👋</h1>
          <p className="lead">Upload contact lists, explore the dashboard, and export the exact columns you need.</p>
          <div className="hero-cta">
            <a className="btn-primary" href="#upload"><Upload size={18}/> <span>Upload CSV</span></a>
            <a className="btn-secondary" href="#dashboard"><LayoutDashboard size={18}/> <span>Open Dashboard</span></a>
          </div>
        </div> */}

        

        {/* User card with credentials & role */}
        <div className="user-card" role="region" aria-label="Your account">
          <div className="user-card-head">
            <div className="avatar-xl" aria-hidden>{getInitials(displayName)}</div>
            <div className="user-card-name">{displayName}</div>
            <span className="role-pill"><Shield size={14}/> {role}</span>
          </div>
          <div className="user-grid">
            <div className="user-row"><User size={16}/> <span className="lbl">Username</span><span className="val">{username}</span></div>
            <div className="user-row"><Mail size={16}/> <span className="lbl">Email</span><span className="val">{email}</span></div>
            <div className="user-row"><IdCard size={16}/> <span className="lbl">Name</span><span className="val">{displayName || "—"}</span></div>
            <div className="user-row"><Hash size={16}/> <span className="lbl">User ID</span><span className="val monospace">{id}</span></div>
          </div>
        </div>

        {/* Upload CSV – visible only for admin and auditor */}
        {/* Upload CSV – only for admin and auditor */}
          {(role === "admin" || role === "auditor") ? (
            <section className="user-card" role="region" aria-label="Upload CSV" id="upload">
              <div className="panel-head">
                <h2 className="h2">Upload CSV</h2>
                <a className="link" href="#" onClick={(e)=>e.preventDefault()}>
                  Formatting guide <ChevronRight size={14}/>
                </a>
              </div>
              <UploadCSV />
            </section>
          ) : (
            <section className="user-card" role="region" aria-label="Upload CSV" id="upload">
              <div className="panel-head">
                <h2 className="h2">Upload CSV</h2>
              </div>
              <div className="info-box">
                <p>🚫 You don’t have permission to upload CSV files.  
                Please contact your administrator if you need access.</p>
              </div>
            </section>
          )}


      </section>

 
      {/* Upload */}
      

      {/* Dashboard */}
      <section className="panel" id="dashboard">
        
        <Dashboard />
      </section>

      {/* Footer */}
      <footer className="foot">
        <div className="foot-left">© {new Date().getFullYear()} Only B2B</div>
        <nav className="foot-nav">
          <a href="#" onClick={(e)=>e.preventDefault()}>Privacy</a>
          <a href="#" onClick={(e)=>e.preventDefault()}>Terms</a>
          <a href="#" onClick={(e)=>e.preventDefault()}>Support</a>
        </nav>
      </footer>
    </div>
  );
}

function Step({ icon, title, sub }){
  return (
    <div className="step">
      <div className="step-ico" aria-hidden>{icon}</div>
      <div className="step-title">{title}</div>
      <div className="step-sub">{sub}</div>
    </div>
  );
}