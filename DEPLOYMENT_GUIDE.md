# Railway Deployment Guide

WhisperLink is designed to deploy seamlessly to [Railway.app](https://railway.app), leveraging its monorepo support, automatic health checks, and managed Redis infrastructure.

## Step 1: Push to GitHub

Railway deploys automatically directly from your GitHub repository.
1. Commit all your code.
2. Push your repository to GitHub.

## Step 2: Provision Railway Redis

1. Go to your Railway Dashboard.
2. Click **New Project** -> **Provision PostgreSQL, Redis, etc.** -> **Redis**.
3. Railway will provision a highly-available Redis instance.

*Note: Since WhisperLink data is ephemeral, you do not need to configure any persistent volumes for Redis. Railway's default configuration works perfectly.*

## Step 3: Deploy the Backend (Go) on Railway

1. In your Railway Project, click **New** -> **GitHub Repo**.
2. Select your WhisperLink repository.
3. Railway will analyze the root, but we need to tell it to look at the backend folder.
4. Go to the new service's **Settings** -> **Build**:
   - Set **Root Directory** to `/backend`
   - Set **Builder** to `Dockerfile` (it should auto-detect this via `backend/railway.json`).
5. Go to the service's **Variables**:
   - Add a new variable: `REDIS_URL`. Railway makes this extremely easy: just click "Add Reference" and select the `REDIS_URL` from your Redis service.
   - Add `ENV=production`.
   - Add `ROOM_TTL_SECS=3600` (Optional: adjust self-destruct timer).
6. Go to **Settings** -> **Networking**:
   - Make note of the Public Domain Railway generates for you (e.g., `https://whisperlink-backend.up.railway.app`). You will need this for Vercel.

## Step 4: Deploy the Frontend (React) on Vercel

Vercel provides the fastest edge-delivery network for our static assets.

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
2. Import your WhisperLink GitHub repository.
3. Vercel will automatically detect `Vite` as the framework.
4. **CRITICAL CONFIGURATION**:
   - Change the **Root Directory** to `frontend`.
   - Open **Environment Variables** and add:
     - Name: `VITE_API_URL`
     - Value: `https://whisperlink-backend.up.railway.app` *(Replace with your exact Railway backend public URL)*
5. Click **Deploy**.

## Step 5: Verification & Zero-Knowledge Architecture

Because we included `vercel.json` in the `frontend/` directory, Vercel will automatically:
1. Enforce strict HTTP Security Headers (preventing XSS, Clickjacking).
2. Configure SPA fallback routing (`/index.html`).
3. Aggressively cache static assets (CSS, JS) on its Global Edge Network.

The React frontend running on Vercel will now securely communicate directly with the Go backend running on Railway via cross-origin WebSockets and API calls!
