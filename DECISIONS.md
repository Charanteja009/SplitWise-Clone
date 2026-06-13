# Architectural Decision Log (ADL)

This document maps out the core architectural design decisions made during the development of the split Splitwise Clone, including the alternatives considered and the explicit engineering trade-offs.

---

## Decision 1: Split Vite-React SPA Frontend + Express Backend vs. Next.js App Router

### The Problem
We need to deploy a full-stack MVP containing independent front-end interfaces and backend APIs. This allows hosting the client statically on Vercel and the backend service on Render/Supabase.

### Alternatives Considered
1. **Option A (Unified Next.js Stack)**: A single Next.js project with Server Actions and API routes.
2. **Option B (Separate Client & Server directories - CHOSEN)**: A Vite-React SPA for frontend interfaces, and an Express.js Node API server for backend connections.

### Rationale for Choosing Option B (Separate Client & Server)
* **Standard Assignment Specifications**: Adheres to the requirement of having a separate client and backend API setup.
* **Separation of Concerns**: Decouples the presentation layer from database queries. Changes to frontend components will not trigger backend re-builds, and vice versa.
* **Hosting Options**: The static React SPA can be deployed on high-speed CDN hosting (Vercel/Netlify), while the backend API can be run on custom container servers (Render/Heroku/AWS).

---

## Decision 2: Cents-Based Integer Representation (`Int`) vs. Database Decimal Columns

### The Problem
How do we store monetary values securely in the PostgreSQL database to avoid floating-point rounding creep (e.g., `0.1 + 0.2 = 0.30000000000000004`)?

### Alternatives Considered
1. **Option A (Decimal type)**: Define all columns as `Decimal(12, 2)` inside PostgreSQL.
2. **Option B (Integer Cents - CHOSEN)**: Convert all dollar/rupee entries to integer cents (e.g., `$15.50` -> `1550` cents) at ingestion, and store them as `Int` in Prisma.

### Rationale for Choosing Option B (Integer Cents)
* **Performance**: Operations on integers (`Int`) are faster and take less storage in PostgreSQL than `Decimal` types.
* **Universal Language Compatibility**: Storing cents as native Javascript integers simplifies math logic and keeps JSON responses standard.

---

## Decision 3: Dynamic CORS Origin Checking (Vercel Subdomain Wildcards)

### The Problem
When the client is hosted on Vercel, it generates dynamic subdomains for previews (e.g. `splitwise-client-git-main-username.vercel.app`). The backend must support these origins dynamically without allowing global wildcards (`*`) which break HttpOnly cookie credentials sharing.

### Alternatives Considered
1. **Option A (Exact Array Matches)**: Maintain an environment list of allowed origins. Disadvantage: Breaks preview branch builds.
2. **Option B (Dynamic CORS Matcher with Suffix Check - CHOSEN)**: Program the Express CORS middleware to dynamically authorize any incoming requests matching the `*.vercel.app` suffix.

### Rationale for Choosing Option B
* **Prevents Deployment CORS Errors**: Ensures Vercel preview environments communicate with the backend smoothly, without exposing the backend to unauthorized external origins.

---

## Decision 4: Dev Server Proxying vs. Hardcoded API URLs in Local Dev

### The Problem
How does the local React development client query the backend without running into localhost CORS warnings or hardcoded URL problems?

### Alternatives Considered
1. **Option A (Hardcoded backend URL)**: Fetch directly to `http://localhost:5000/api/...` from the client. Disadvantage: Triggers CORS preflights locally and is hard to manage when changing environments.
2. **Option B (Vite Dev Server Proxy - CHOSEN)**: Configure Vite to proxy all `/api` requests to `http://localhost:5000` locally.

### Rationale for Choosing Option B
* **Uniform Codebase**: Fetch calls use relative paths (e.g. `fetch('/api/auth/me')`). In production, this maps to the production backend, and in development, Vite handles routing automatically without CORS headers.
