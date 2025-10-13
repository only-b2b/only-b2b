// frontend/src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}
function getUser() {
  const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true; // opaque token
    const payload = JSON.parse(atob(parts[1]));
    if (payload?.exp && Date.now() >= payload.exp * 1000) return false;
    return true;
  } catch {
    return true;
  }
}

export default function ProtectedRoute({ children, roles }) {
  if (!isTokenValid()) return <Navigate to="/login" replace />;

  if (roles?.length) {
    const user = getUser();
    if (!user?.role || !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
}
