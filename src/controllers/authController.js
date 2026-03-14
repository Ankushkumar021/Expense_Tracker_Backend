const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/jwt");
const { isValidEmail, sanitizeString } = require("../utils/validators");
const logger = require("../utils/logger");

const createToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ── Validate all inputs ──
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const cleanName = sanitizeString(name, 100);
    if (cleanName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: "Password is too long" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name: cleanName,
      email: email.toLowerCase().trim(),
      password,
    });

    const token = createToken(user._id);

    logger.info("User registered", { userId: user._id });

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    logger.error("Registration error", { error: error.message });
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (typeof password !== "string" || password.length > 128) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      // Same generic message for both missing user and wrong password (security)
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = createToken(user._id);

    logger.info("User logged in", { userId: user._id });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    logger.error("Login error", { error: error.message });
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    logger.error("GetMe error", { error: error.message });
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};
