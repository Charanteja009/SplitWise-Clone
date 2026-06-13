# Splitwise Clone — Roommate Shared Expenses & Ledgers

This project contains a split-architecture roommate Shared Expenses Clone, divided into a Vite-React frontend (`client/`) and a Node/Express backend (`server/`). 

---

## 🛠️ Setup Instructions

Follow these steps to run both projects locally.

### 1. Database & Backend Setup (`server/`)

1. Open your terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables. Create a `.env` file in the `server/` directory:
   ```env
   DATABASE_URL="postgresql://neondb_owner:npg_uw1KlFYV2IaP@ep-young-river-ao8nm47a-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   JWT_SECRET="your-super-secret-jwt-token-key-change-this-in-production"
   PORT=5000
   FRONTEND_URL="http://localhost:5173"
   ```
4. Push database tables and seed test accounts (Aisha, Rohan, Priya, Meera, Sam, Dev):
   ```bash
   # Push tables
   npx prisma db push

   # Seed initial database rows
   npm run seed
   ```
5. Launch the backend API server:
   ```bash
   npm run dev
   ```
   The backend API will run on [http://localhost:5000](http://localhost:5000).

---

### 2. Frontend Setup (`client/`)

1. Open a new terminal window and navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the React development server:
   ```bash
   npm run dev
   ```
   The frontend UI will run on [http://localhost:5173](http://localhost:5173). Open it in your browser to inspect.

---

## 🤖 AI Collaboration Details

* **AI Coding Assistant**: **Antigravity** (designed by the **Google DeepMind** team working on Advanced Agentic Coding).
* **Role**: Acted as a pair programming assistant, splitting full-stack Next.js logic back into Express APIs and React hooks, configuring dynamic CORS subdomain matches, and organizing mathematical cents precision schemas.
