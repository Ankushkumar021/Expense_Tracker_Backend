// Structured logger with levels and timestamps
// Production-grade: no colors in production, JSON format for log aggregation

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = () => {
    const env = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "warn" : "debug");
    return LOG_LEVELS[env] ?? LOG_LEVELS.info;
};

const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";

    if (process.env.NODE_ENV === "production") {
        // JSON format for log aggregation tools (DataDog, CloudWatch, etc.)
        return JSON.stringify({ timestamp, level, message, ...meta });
    }

    // Human-readable for development
    const icons = { error: "❌", warn: "⚠️", info: "ℹ️", debug: "🔍" };
    return `${icons[level] || ""} [${timestamp.slice(11, 19)}] ${level.toUpperCase()}: ${message}${metaStr}`;
};

const log = (level, message, meta) => {
    if (LOG_LEVELS[level] > currentLevel()) return;
    const formatted = formatMessage(level, message, meta);
    if (level === "error") console.error(formatted);
    else if (level === "warn") console.warn(formatted);
    else console.log(formatted);
};

const logger = {
    error: (message, meta) => log("error", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    info: (message, meta) => log("info", message, meta),
    debug: (message, meta) => log("debug", message, meta),
};

module.exports = logger;
