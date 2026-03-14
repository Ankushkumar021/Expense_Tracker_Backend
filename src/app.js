const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const logger = require("./utils/logger");

const app = express();

// ── Security ──────────────────────────────────────────
app.use(helmet());

// ── Compression ───────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(normalizeOrigin).filter(Boolean)
  : [];

const isDevelopment = process.env.NODE_ENV !== "production";
const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      if (isDevelopment && localDevOriginPattern.test(normalizedOrigin)) {
        callback(null, true);
        return;
      } else {
        logger.warn("CORS blocked request", { origin });
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// NoSQL injection prevention is handled at the controller level
// via validators.js sanitizeString() and input whitelisting

// ── HTTP Request Logger ───────────────────────────────
if (process.env.NODE_ENV === "production") {
  // JSON format for log aggregation
  app.use(
    morgan(
      (tokens, req, res) =>
        JSON.stringify({
          method: tokens.method(req, res),
          url: tokens.url(req, res),
          status: tokens.status(req, res),
          responseTime: `${tokens["response-time"](req, res)}ms`,
          contentLength: tokens.res(req, res, "content-length") || 0,
          timestamp: new Date().toISOString(),
        }),
      { stream: { write: (msg) => logger.info(msg.trim()) } }
    )
  );
} else {
  // Dev-friendly colored output
  app.use(morgan("dev"));
}

// ── Rate Limiting ─────────────────────────────────────
// Global: 200 requests per 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Auth: stricter — 20 per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many auth attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});


// ── Health Check ──────────────────────────────────────
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  const healthy = dbState === 1;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus[dbState] || "unknown",
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
  });
});

// ── Routes ────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/expenses", expenseRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Expense Tracker API", version: "1.0.0" });
});

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Global Error Handler ──────────────────────────────
app.use((err, req, res, next) => {
  // Handle specific error types
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource ID format" });
  }
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }
  if (err.name === "MongoServerError" && err.code === 11000) {
    return res.status(409).json({ message: "Duplicate entry" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }

  const statusCode = err.statusCode || 500;
  const responseMessage =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  logger.error("Unhandled error", {
    error: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({ message: responseMessage });
});

module.exports = app;
