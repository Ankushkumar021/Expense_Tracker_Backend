require("dotenv").config(); // MUST be first — before any other require

const app = require("./src/app");
const connectDB = require("./src/config/db");
const mongoose = require("mongoose");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

connectDB();

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { env: process.env.NODE_ENV || "development" });
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
    } catch (err) {
      logger.error("Error closing MongoDB", { error: err.message });
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled rejection", { error: err?.message, stack: err?.stack });
  shutdown("UNHANDLED_REJECTION");
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  shutdown("UNCAUGHT_EXCEPTION");
});
