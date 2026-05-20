# 🚀 Deploying Teuly Connect Backend

This guide outlines how to deploy the Express backend (`portal/server`) to a production cloud service (like Render or Railway) and link it to the Netlify frontend (`tuely.netlify.app`).

---

## 📦 Step 1: Deploying the Backend (Render / Railway)

### Option A: Deploying on Render (Free)
1. Sign up/Log in at **[Render.com](https://render.com/)**.
2. Click **New** > **Web Service**.
3. Link your GitHub repository `Tuely_IT_Solutions`.
4. Configure the Web Service settings:
   - **Name:** `teuly-connect-backend`
   - **Region:** Choose one closest to your users (e.g., Singapore/Oregon)
   - **Branch:** `main`
   - **Root Directory:** `portal/server` *(CRITICAL: This ensures Render only deploys the backend subfolder)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`

5. Go to the **Environment** tab on Render and add these Environment Variables:
   | Key | Value | Notes |
   |-----|-------|-------|
   | `NODE_ENV` | `production` | Enables production mode optimizations |
   | `MONGO_URI` | `mongodb://Tuely:ItSolutions@...` | Your full Atlas replica connection string |
   | `JWT_SECRET` | `choose-a-strong-random-key-here` | Secret key used to sign session cookies |
   | `CLIENT_URL` | `https://tuely.netlify.app` | Netlify frontend URL to allow CORS requests |

6. Click **Deploy Web Service**. Once deployed, copy your Render web service URL (e.g., `https://teuly-connect-backend.onrender.com`).

---

### Option B: Deploying on Railway (Fastest)
1. Sign up/Log in at **[Railway.app](https://railway.app/)**.
2. Click **New Project** > **Deploy from GitHub repo**.
3. Choose your repository `Tuely_IT_Solutions`.
4. Click **Go to settings** and configure:
   - **Root Directory:** `portal/server`
5. Go to the **Variables** tab and add the Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGO_URI` = `mongodb://Tuely:ItSolutions@...` (Your Atlas URL)
   - `JWT_SECRET` = `a-strong-secret-key`
   - `CLIENT_URL` = `https://tuely.netlify.app`
6. Go to **Settings** > **Public Networking** and click **Generate Domain** (e.g., `https://teuly-connect-backend.up.railway.app`).

---

## 🔗 Step 2: Update Netlify Configuration

Once you have your live backend URL (e.g. `https://teuly-connect-backend.up.railway.app`), update the root `netlify.toml` in the project to redirect all API requests to the live backend server.

### Add this at the top of `netlify.toml`:
```toml
# Proxy API and file upload requests to the production backend
[[redirects]]
  from = "/api/*"
  to = "https://YOUR_BACKEND_URL/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/uploads/*"
  to = "https://YOUR_BACKEND_URL/uploads/:splat"
  status = 200
  force = true
```

*Replace `https://YOUR_BACKEND_URL` with your actual live Render or Railway URL.*

### Why is this needed?
The Vite React app is configured to call `/api/auth/login` relative to the current domain. By adding these redirects, Netlify acts as a secure reverse-proxy, sending those requests directly to your live backend server without exposing your backend URL directly inside the React code or facing CORS issues!
