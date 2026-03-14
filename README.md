# 💰 Expense Tracker — Backend API

A production-grade RESTful API for personal expense tracking with AI-powered financial insights, built with Node.js, Express, and MongoDB.

## ✨ Features

- **Authentication** — JWT-based register/login with bcrypt password hashing
- **Expense CRUD** — Create, read (paginated), update, and delete expenses
- **Dashboard Summary** — Aggregated stats (total, this month, last month, category breakdown)
- **AI Financial Advisor** — Groq-powered chat with smart local fallback
- **Production Security** — Helmet, CORS, rate limiting, input validation, XSS sanitization
- **Structured Logging** — JSON logs in production, human-readable in development
- **Health Monitoring** — `/health` endpoint with DB status, uptime, and memory metrics
- **Graceful Shutdown** — Clean SIGTERM/SIGINT handling with DB connection closure

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Database | MongoDB (Mongoose 9) |
| Auth | JWT + bcryptjs |
| AI | Groq API (Llama/Mixtral) |
| Security | Helmet, express-rate-limit, CORS |
| Logging | Morgan (HTTP) + custom structured logger |
| Dev Tools | Nodemon |

## 📁 Project Structure

```
├── server.js                  # Entry point — dotenv, DB connect, graceful shutdown
├── src/
│   ├── app.js                 # Express app — middleware, routes, error handler
│   ├── config/
│   │   ├── db.js              # MongoDB connection with event listeners
│   │   └── jwt.js             # JWT secret validation & config
│   ├── controllers/
│   │   ├── authController.js  # Register, login, getMe
│   │   └── expenseController.js # CRUD, summary, AI chat
│   ├── middlewares/
│   │   └── auth.js            # JWT verification middleware
│   ├── models/
│   │   ├── User.js            # User schema with password hashing
│   │   └── Expense.js         # Expense schema with compound indexes
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth/*
│   │   └── expenseRoutes.js   # /api/expenses/*
│   └── utils/
│       ├── logger.js          # Structured logger (JSON prod / readable dev)
│       └── validators.js      # Input sanitization & validation helpers
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20 or higher
- **MongoDB** — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- **Groq API Key** *(optional)* — from [Groq Console](https://console.groq.com/keys)

### Setup

```bash
# 1. Clone the repo
git clone <your-backend-repo-url>
cd Expense_Tracker_Backend

# 2. Install dependencies
npm install

# 3. Configure environment
# Create a .env file with your values (see Environment Variables below)

# 4. Start development server
npm run dev
```

The server starts at `http://localhost:5000`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` |
| `MONGO_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Random secret for signing tokens. Generate with: |
| | | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `7d`) |
| `ALLOWED_ORIGINS` | No | Comma-separated frontend URLs (default: `http://localhost:3000`) |
| `GROQ_API_KEY` | No | Groq API key for AI chat |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, or `debug` (default: `debug` in dev) |

## 📡 API Reference

### Authentication

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | `{ name, email, password }` | Create account |
| `POST` | `/api/auth/login` | `{ email, password }` | Login, returns JWT |
| `GET` | `/api/auth/me` | — | Get current user profile |

### Expenses *(all require `Authorization: Bearer <token>`)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/expenses` | Paginated list (`?page=1&limit=50&category=Food&startDate=YYYY-MM-DD`) |
| `GET` | `/api/expenses/summary` | Dashboard stats (total, this month, categories, recent) |
| `POST` | `/api/expenses` | Add expense (`{ amount, category, description?, date? }`) |
| `PUT` | `/api/expenses/:id` | Update expense |
| `DELETE` | `/api/expenses/:id` | Delete expense |
| `POST` | `/api/expenses/chat` | AI chat (`{ message }`) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status, DB state, memory usage |

### Valid Categories

`Food` · `Travel` · `Rent` · `Utilities` · `Entertainment` · `Shopping` · `Other`

## 🔒 Security Features

- **Helmet** — sets security HTTP headers (CSP, X-Frame-Options, HSTS, etc.)
- **Rate Limiting** — global (200/15min), auth (20/15min), AI chat (30/15min)
- **CORS** — explicit origin allowlist, no wildcard
- **Input Validation** — email format, ObjectId format, amount bounds, string length limits
- **XSS Protection** — HTML tag stripping on all string inputs
- **Regex Injection Prevention** — special characters escaped in search queries
- **Request Size Limit** — 10kb max body size
- **Password Security** — bcrypt hashing with salt rounds of 10
- **JWT** — no fallback secret in production, configurable expiry
- **Error Handling** — generic messages in production, never leaks stack traces



## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start for production |

## 📄 License

ISC
