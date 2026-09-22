# CocoCraft — Sustainable Coconut-Shell Marketplace

> **A portfolio-grade e-commerce application showcasing handcrafted coconut-shell products by Kerala master artisans.**

CocoCraft is engineered with a strict **API Facade** architecture where content management is cleanly decoupled from transactional business logic.

---

## 🏛️ System Architecture

```text
React + TypeScript (Client)
         ↓  [HTTP / REST]
    Express.js (API Facade & Business Layer)
    /                   \
   /                     \
Strapi CMS            SQLite Business Database
(Headless Content)     (server/data/cococraft.db)
   |
SQLite CMS Database
(cms/.tmp/data.db)
```

### 🎙️ Architecture Rationale (Recruiter Brief)
> *"I separated content management from transactional business logic. Strapi manages catalogue and editorial content, while Express owns application logic and a separate SQLite database for transactional features. React only communicates through Express, so the frontend has a single controlled API boundary."*

---

## 🗄️ Two Distinct SQLite Databases

| Database | Location | Engine | Purpose |
| :--- | :--- | :--- | :--- |
| **Express Business DB** | `server/data/cococraft.db` | `better-sqlite3` (WAL mode) | Transactional workflows: shopping carts, checkout, customer accounts, orders, custom gift-box configurations. |
| **Strapi CMS DB** | `cms/.tmp/data.db` | SQLite | Content models: products, categories, collections, artisan biographies, sustainability stories, banner media. |

These two databases serve fundamentally different architectural concerns and are kept strictly isolated.

---

## 📐 Express Backend Architecture

The Express server strictly enforces a **Route → Controller → Service → Repository → SQLite** pattern:

```text
server/
├── src/
│   ├── config/          # Environment configuration (env.ts)
│   ├── controllers/     # HTTP request handling and response mapping
│   ├── routes/          # API route definitions
│   ├── services/        # Domain business logic
│   ├── repositories/    # Data access abstraction over SQLite
│   ├── middleware/      # Global error handling and security
│   ├── database/        # better-sqlite3 singleton & connection lifecycle
│   ├── utils/           # Standardized API response formatters
│   ├── types/           # Strongly-typed TypeScript interfaces
│   ├── app.ts           # Express application configuration & middleware
│   └── server.ts        # Server entrypoint and lifecycle handlers
│
└── data/
    └── cococraft.db     # Local SQLite Business DB
```

*Note: The `/api/health` endpoint routes cleanly through `Route → Controller → Service` without unnecessary database overhead, while repositories are structured for upcoming transactional domains.*

---

## 🎨 Design Foundation: Luxury Kerala Artisan Boutique

Rather than generic green sustainability themes, CocoCraft is designed as a **luxury Kerala artisan boutique**:

- **Color Palette**:
  - `Coconut Husk Brown`: `#432C22`
  - `Roasted Coconut`: `#6B4736`
  - `Shell Ivory`: `#F8F2E8`
  - `Warm Cream`: `#FFFDF8`
  - `Coir Tan`: `#C79A6B`
  - `Palm Green`: `#365A3D`
  - `Sage`: `#82917A`
  - `Antique Brass`: `#B89555`
  - `Charcoal`: `#292522`
- **Typography**:
  - Headings: `Cormorant Garamond` (Google Serif font)
  - Body: `Manrope` / `Inter`
- **Motifs**: River-sanded coconut curves, natural coir fiber weaves, antique brass trims, and organic backwater textures.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20+ or v22+ (`node -v`)
- **npm**: v10+ or v11+ (`npm -v`)

---

### 1. Express Backend Setup (`server/`)

```bash
cd server

# Install dependencies (better-sqlite3, express, typescript, etc.)
npm install

# Setup environment variables
cp .env.example .env

# Run TypeScript type check
npm run typecheck

# Start in development mode (hot reload with tsx)
npm run dev
# OR build and run production bundle:
# npm run build && npm start
```

*Express server runs on `http://localhost:4000`.*
*Health endpoint: `http://localhost:4000/api/health`*

---

### 2. React Client Setup (`client/`)

```bash
cd client

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run TypeScript checks and production build
npm run build

# Start Vite development server
npm run dev
```

*Client runs on `http://localhost:5173`.*  
*During development, the header automatically pings the Express API at `http://localhost:4000/api/health` and displays live connectivity status.*

---

### 3. Strapi CMS Setup (`cms/`)

```bash
cd cms

# Start Strapi in development mode
npm run develop
```

*Strapi Admin runs on `http://localhost:1337/admin`.*

---

## 🔍 Verification & Health Check

### Test Express API Health Directly
```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "success": true,
  "service": "CocoCraft API"
}
```

### Test Frontend Integration
1. Ensure the Express server is running on port 4000.
2. Open `http://localhost:5173` in your browser.
3. Observe the development status badge in the header: **"Express API 4000: OK"** with a green pulse indicator.
