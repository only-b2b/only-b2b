// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

// routes
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const activityRoutes = require("./routes/activityRoutes");
const exportRoutes = require("./routes/exportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadReportRoutes = require("./routes/uploadReportRoutes");
const duplicateRoutes = require("./routes/duplicateRoutes");

const { activityLogger } = require("./middleware/activityLogger");

const app = express();

/** ---------- CORS (Render + Dev) ---------- */
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const ALLOWLIST = new Set([...FRONTEND_ORIGIN, ...DEV_ORIGINS]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWLIST.has(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Audit-Code"],
  exposedHeaders: ["Content-Disposition", "X-Total-Count"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Behind a proxy on Render
app.set("trust proxy", 1);

// Connect DB
connectDB();

/** ---------- Routes ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/users", activityLogger("USERS_API"), userRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/upload-reports", uploadReportRoutes);
app.use("/api/duplicates", duplicateRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (_req, res) => {
  res.type("text/plain").send("OnlyB2B API is running. Try GET /health");
});

app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

/** ---------- Socket.IO + Server ---------- */
const server = http.createServer(app);

// ✅ CRITICAL: Increase timeouts for large exports
server.timeout = 0; // No timeout (let it run as long as needed)
server.keepAliveTimeout = 900000; // 15 minutes
server.headersTimeout = 910000; // 15 minutes + 10 seconds

const io = new Server(server, {
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWLIST.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS (socket.io)"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "X-Audit-Code"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/** ---------- Start Server ---------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed origins: ${Array.from(ALLOWLIST).join(', ')}`);
  console.log(`⏱️ Server timeout: disabled (streaming enabled)`);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});