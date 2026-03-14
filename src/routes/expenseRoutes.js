const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const {
  addExpense,
  getExpenses,
  getSummary,
  updateExpense,
  deleteExpense,
  chatWithAI,
} = require("../controllers/expenseController");

// All expense routes require authentication
router.use(authMiddleware);

// AI chat rate limiter — prevent abuse (30 requests per 15 min)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many AI requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Dashboard summary (lightweight aggregation)
router.get("/summary", getSummary);

// AI chat (rate-limited separately)
router.post("/chat", chatLimiter, chatWithAI);

// CRUD
router.post("/", addExpense);
router.get("/", getExpenses);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
