const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const { isValidObjectId, sanitizeString, isValidDate } = require("../utils/validators");
const logger = require("../utils/logger");

const VALID_CATEGORIES = ["Food", "Travel", "Rent", "Utilities", "Entertainment", "Shopping", "Other"];
const MAX_AMOUNT = 10_000_000; // ₹1 crore cap
const isClientExpenseError = (error) => error?.name === "ValidationError" || error?.name === "CastError";

// ➕ Add Expense
exports.addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;

    // ── Validate ──
    if (amount === undefined || !category) {
      return res.status(400).json({ message: "Amount and category are required" });
    }
    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (amount > MAX_AMOUNT) {
      return res.status(400).json({ message: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString()}` });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }
    if (date && !isValidDate(date)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const cleanDesc = sanitizeString(description || "", 500);

    const expense = await Expense.create({
      userId: req.userId,
      amount: Math.round(amount * 100) / 100, // round to 2 decimal places
      category,
      description: cleanDesc,
      date: date ? new Date(date) : new Date(),
    });

    logger.info("Expense added", { userId: req.userId, amount, category });

    res.status(201).json(expense);
  } catch (error) {
    logger.error("Add expense error", { error: error.message });
    const statusCode = isClientExpenseError(error) ? 400 : 500;
    res.status(statusCode).json({
      message: statusCode === 400 ? "Invalid expense data" : "Failed to add expense",
    });
  }
};

// 📊 Get Summary
exports.getSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [allTime, thisMonth, lastMonth, categories, recent] = await Promise.all([
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, avg: { $avg: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Expense.find({ userId: req.userId }).sort({ date: -1 }).limit(5),
    ]);

    res.json({
      allTime: allTime[0] || { total: 0, count: 0, avg: 0 },
      thisMonth: thisMonth[0] || { total: 0, count: 0 },
      lastMonth: lastMonth[0] || { total: 0, count: 0 },
      categories,
      recentExpenses: recent,
    });
  } catch (error) {
    logger.error("Get summary error", { error: error.message });
    res.status(500).json({ message: "Failed to fetch summary" });
  }
};

// 📄 Get Expenses (paginated)
exports.getExpenses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.userId };

    // Category filter — only allow valid categories
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }

    // Search — sanitize and limit length to prevent ReDoS
    if (req.query.search) {
      const cleanSearch = sanitizeString(req.query.search, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex special chars
      if (cleanSearch.length > 0) {
        filter.description = { $regex: cleanSearch, $options: "i" };
      }
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate && isValidDate(req.query.startDate)) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate && isValidDate(req.query.endDate)) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter.date.$lte = endDate;
      }
      if (Object.keys(filter.date).length === 0) {
        delete filter.date; // cleanup if dates were invalid
      }
    }

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);

    res.json({
      expenses,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    logger.error("Get expenses error", { error: error.message });
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
};

// ✏️ Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    // ── Validate ObjectId ──
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid expense ID" });
    }

    const { amount, category, description, date } = req.body;

    const updateData = {};

    if (amount !== undefined) {
      if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }
      if (amount > MAX_AMOUNT) {
        return res.status(400).json({ message: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString()}` });
      }
      updateData.amount = Math.round(amount * 100) / 100;
    }
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      updateData.category = category;
    }
    if (description !== undefined) {
      updateData.description = sanitizeString(description, 500);
    }
    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      updateData.date = new Date(date);
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    logger.info("Expense updated", { userId: req.userId, expenseId: id });

    res.json(expense);
  } catch (error) {
    logger.error("Update expense error", { error: error.message });
    const statusCode = isClientExpenseError(error) ? 400 : 500;
    res.status(statusCode).json({
      message: statusCode === 400 ? "Invalid expense data" : "Failed to update expense",
    });
  }
};

// 🗑️ Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid expense ID" });
    }

    const expense = await Expense.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    logger.info("Expense deleted", { userId: req.userId, expenseId: id });

    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    logger.error("Delete expense error", { error: error.message });
    res.status(500).json({ message: "Failed to delete expense" });
  }
};

// 💬 AI Chat
exports.chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Message is required" });
    }

    const cleanMessage = sanitizeString(message, 500);
    if (cleanMessage.length === 0) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const userId = new mongoose.Types.ObjectId(req.userId);

    // Lightweight aggregation instead of fetching all expenses
    const [stats, catBreakdown] = await Promise.all([
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, avg: { $avg: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const summary = stats[0] || { total: 0, count: 0, avg: 0 };
    const topCategory = catBreakdown[0] || null;

    // Try Groq API
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "paste_your_groq_api_key_here") {
      try {
        const prompt = `You are a concise financial advisor. User's data:
Total spent: ₹${summary.total.toFixed(2)}, ${summary.count} expenses, avg ₹${summary.avg.toFixed(2)}
Top category: ${topCategory ? `${topCategory._id} (₹${topCategory.total.toFixed(2)})` : "none"}
Categories: ${catBreakdown.map((c) => `${c._id}: ₹${c.total.toFixed(2)}`).join(", ")}

User asks: ${cleanMessage}

Give short, practical advice (max 150 words). Use emojis sparingly.`;

        const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
        const apiKey = process.env.GROQ_API_KEY;

        for (const model of models) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(
              "https://api.groq.com/openai/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: "You are a concise, helpful financial advisor. Give short, practical advice." },
                    { role: "user", content: prompt },
                  ],
                  temperature: 0.7,
                  max_tokens: 200,
                }),
                signal: controller.signal,
              }
            );

            clearTimeout(timeout);

            if (response.ok) {
              const data = await response.json();
              const aiText = data.choices?.[0]?.message?.content;
              if (aiText) {
                logger.debug("Groq responded", { model });
                return res.json({ response: aiText });
              }
            } else {
              const errData = await response.json().catch(() => ({}));
              logger.warn(`Groq ${model} failed`, {
                status: response.status,
                error: errData.error?.message,
              });
            }
          } catch (err) {
            if (err.name === "AbortError") {
              logger.warn(`Groq ${model} timed out`);
            } else {
              logger.warn(`Groq ${model} error`, { error: err.message });
            }
          }
        }
      } catch (err) {
        logger.error("Groq API block error", { error: err.message });
      }
    }

    // Local fallback
    const lower = cleanMessage.toLowerCase();
    const isGreeting = /\b(hi|hello|hey)\b/.test(lower);
    let fallback;

    if (lower.includes("analyz") || lower.includes("analyse")) {
      fallback = summary.count === 0
        ? "📊 No expenses tracked yet. Start adding expenses to get insights!"
        : `📊 You've spent ₹${summary.total.toFixed(2)} across ${summary.count} transactions. ${topCategory ? `Top category: ${topCategory._id} (₹${topCategory.total.toFixed(2)}).` : ""} ${topCategory && topCategory.total > summary.total * 0.4 ? `⚠️ Consider reducing ${topCategory._id.toLowerCase()} spending.` : "✅ Spending is balanced."}`;
    } else if (lower.includes("save") || lower.includes("saving")) {
      fallback = `💰 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings. You've spent ₹${summary.total.toFixed(2)} so far. Build a 6-month emergency fund first!`;
    } else if (lower.includes("budget")) {
      fallback = `📊 Budget tip: Set category limits. Your avg expense is ₹${summary.avg.toFixed(2)}. Track daily and review weekly.`;
    } else if (lower.includes("reduce") || lower.includes("cut")) {
      fallback = topCategory
        ? `💡 Focus on ${topCategory._id} (₹${topCategory.total.toFixed(2)}). Set weekly limits, compare prices, and track daily.`
        : "💡 Track every expense, set daily limits, cook at home, and review subscriptions monthly.";
    } else if (isGreeting) {
      fallback = `👋 Hello! You've tracked ₹${summary.total.toFixed(2)} in ${summary.count} expenses. Ask me to analyze your spending or give tips!`;
    } else {
      fallback = `💬 I can help with:\n• Expense analysis\n• Budget planning\n• Saving tips\n• Spending reduction\n\nWhat would you like to know about your ${summary.count} tracked expenses?`;
    }

    res.json({ response: fallback });
  } catch (error) {
    logger.error("AI chat error", { error: error.message });
    res.status(500).json({ message: "AI chat failed. Please try again." });
  }
};
