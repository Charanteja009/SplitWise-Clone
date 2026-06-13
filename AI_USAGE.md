# AI Collaboration & Hot-Fix Log

This log documents the details of our human-AI pair programming collaboration using the **Antigravity** coding assistant (developed by the **Google DeepMind** team working on Advanced Agentic Coding). Below are three concrete cases where the AI-generated code encountered bugs during development, how we diagnosed the failures, and the engineering hot-fixes applied to establish a stable live build.

---

## Case 1: Prisma Interactive Transaction Timeout (P2028) on Bulk Ingestion

### The AI-Generated Bug
In our initial CSV Ingestion API, the AI wrapped the database inserts inside a Prisma transaction block:
```javascript
await prisma.$transaction(async (tx) => {
  for (const op of operations) {
    await op(); // Ran using standard global prisma instance
  }
});
```
This had two issues:
1. Some internal operations were referencing the global `prisma` client rather than the transaction-scoped `tx` client.
2. It assumed the default 5-second timeout limit of Prisma interactive transactions was sufficient to parse, validate, and write dozens of CSV row splits.

* **The Failure**: When uploading the CSV, the process failed with:
  `CSV Ingestion Pipeline Error: Error [PrismaClientKnownRequestError]: Transaction API error: Transaction already closed: A commit cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 25276 ms passed since the start of the transaction.`

### How We Caught It
We caught this during ingestion pipeline testing when the database was cold. The frontend printed a `500 Internal Server Error` and the backend logged the Prisma `P2028` transaction timeout.

### The Hot-Fix Applied
We updated the batch mapping to route all DB calls inside the transactional loop strictly through the transaction context `tx` and bumped the interactive timeout configuration limit to 45 seconds:
```javascript
// 1. Pass the tx client to operations
await prisma.$transaction(
  async (tx) => {
    for (const op of operations) {
      await op(tx); // Pass the active transaction client
    }
  },
  {
    timeout: 45000 // 45 seconds timeout budget
  }
);
```

---

## Case 2: Double-Slash Endpoint Template Literal Failures on Fetch Calls

### The AI-Generated Bug
In the frontend context `AuthContext.jsx`, the AI defined the API call string interpolation using:
```javascript
const response = await fetch(`${API_BASE}/api/auth/me`, { ... })
```
When configured on Vercel, the user configured the environment variable `VITE_API_URL` to `https://splitwise-clone.onrender.com/` (retaining the trailing slash from browser URLs).
* **The Failure**: The resulting request URL resolved to:
  `https://splitwise-clone.onrender.com//api/auth/me`
* **The Result**: Render's routing middleware matches exact paths. The double-slash (`//`) disrupted path parsing, causing the server to return `404 Not Found` errors for all endpoints on mount.

### How We Caught It
We monitored the Chrome DevTools Network Tab during boot testing. The initial `/me` request was flagged as a `404 Redirection Error` and the console printed `GET https://...//api/auth/me 404 (Not Found)`.

### The Hot-Fix Applied
We sanitized the API base URL resolution to prevent double-slashes by trimming any trailing slash characters dynamically in code:
```javascript
const rawApiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Sanitize URL to strip trailing slash
export const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
```

---

## Case 3: SPA Deep Link Routing Drops on Refresh

### The AI-Generated Bug
The AI set up our Single Page Application (SPA) routing in React using `react-router-dom` on the client side, assuming client paths would resolve automatically on deployment hosts.
* **The Failure**: When navigating around the app, clicking buttons routed paths cleanly. However, if a user directly navigated to `https://split-wise-clone.vercel.app/dashboard` or refreshed the page while viewing `/groups/123`, the browser sent a GET request to Vercel's static servers looking for a physical `/dashboard` folder or `/dashboard/index.html` file.
* **The Result**: Vercel returned a static `404: NOT_FOUND` page.

### How We Caught It
We caught this during our E2E checklist test sequence. After logging in, reloading the page threw a Vercel 404 screen.

### The Hot-Fix Applied
We created a custom Vercel configuration file **[`client/vercel.json`](file:///C:/Users/chara/.gemini/antigravity/scratch/splitwise-separated/client/vercel.json)** instructing the cloud proxy router to rewrite all incoming URLs to the root `index.html` file, handing routing responsibility back to React Router:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
This resolved deep linking page refreshes across all client paths.
