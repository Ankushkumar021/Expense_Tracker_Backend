// Shared validation helpers

const mongoose = require("mongoose");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    return typeof email === "string" && EMAIL_REGEX.test(email) && email.length <= 254;
};

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Sanitize a string: trim, remove HTML/script tags, limit length
 */
const sanitizeString = (str, maxLength = 500) => {
    if (typeof str !== "string") return "";
    return str
        .trim()
        .replace(/<[^>]*>/g, "") // strip HTML tags
        .replace(/[<>]/g, "") // strip remaining angle brackets
        .substring(0, maxLength);
};

/**
 * Validate and sanitize date input
 */
const isValidDate = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d instanceof Date && !isNaN(d.getTime());
};

module.exports = {
    isValidEmail,
    isValidObjectId,
    sanitizeString,
    isValidDate,
};
