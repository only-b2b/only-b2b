// frontend/src/api/apiClient.js
import axios from "axios";

const raw = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const base = /\/api$/.test(raw) ? raw : `${raw}/api`;
const api = axios.create({ baseURL: base });

api.interceptors.request.use((config) => {
  // 👇 prefer sessionStorage token
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Audit code remains session-based
  const auditCode = sessionStorage.getItem("AUDIT_CODE");
  if (auditCode) config.headers["X-Audit-Code"] = auditCode;

  return config;
});

// Only force logout on /auth/* 401s
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const isAuth = url.includes("/auth/");
    if (status === 401 && isAuth) {
      localStorage.removeItem("token"); localStorage.removeItem("user");
      sessionStorage.removeItem("token"); sessionStorage.removeItem("user");
      if (location.pathname !== "/login") window.location.href = "/login";
      return;
    }
    return Promise.reject(err);
  }
);

export default api;
