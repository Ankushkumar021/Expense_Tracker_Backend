const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.includes("change-this")) {
    if (process.env.NODE_ENV === "production") {
        console.error("FATAL: JWT_SECRET is not configured for production.");
        process.exit(1);
    }
    console.warn("⚠️  Using default JWT_SECRET. Set a strong secret in .env for production.");
}

module.exports = {
    JWT_SECRET: JWT_SECRET || "dev-fallback-secret-do-not-use-in-production",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
};
