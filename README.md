# WhisperLink

[![CI Pipeline](https://github.com/SJagadeesh1117/whisperlink/actions/workflows/ci.yml/badge.svg)](https://github.com/SJagadeesh1117/whisperlink/actions/workflows/ci.yml)
[![CD Pipeline](https://github.com/SJagadeesh1117/whisperlink/actions/workflows/cd.yml/badge.svg)](https://github.com/SJagadeesh1117/whisperlink/actions/workflows/cd.yml)


The most secure, ephemeral, and anonymous chat platform. No sign-ups. No footprints. 
Mathematically guaranteed end-to-end encryption.

## Features
- **Absolute Anonymity**: No emails, passwords, or cookies.
- **End-to-End Encryption**: ECDH + AES-256-GCM (Browser-to-Browser). Server only sees indistinguishable bytes.
- **Ephemeral**: Chats self-destruct after 60 minutes or immediately upon manual destruction.
- **Zero-Knowledge Architecture**: Encryption keys are exchanged securely out-of-band via URL fragments (`#`).

---

## Local Development (Docker)

WhisperLink is fully containerized for a seamless setup experience. 

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Running the Application

1. Open a terminal in the root directory.
2. Run the following command to build and launch all services (Frontend, Backend, Redis):

```bash
docker compose up --build
```

3. Once all health checks pass:
   - **Frontend UI**: Open `http://localhost:5173` in your browser.
   - **Backend API**: Running on `http://localhost:8080`.
   - **Redis**: Running on `localhost:6379`.

*Note: You can run `docker compose up -d` to run it in detached (background) mode.*

### Stopping the Application

To shut down the cluster and instantly wipe all ephemeral data residing in Redis memory:

```bash
docker compose down
```

## Production Deployment

Ready to take WhisperLink live to the internet? The infrastructure is primed for deployment:
- **Backend (Go + Redis)**: Fully configured for zero-downtime deployment on **Railway**.
- **Frontend (React)**: Architected for edge-caching and global deployment on **Vercel** (or Nginx).

Please see the [Deployment Guide](./DEPLOYMENT_GUIDE.md) for step-by-step instructions.

---

## Architecture Details

- **Frontend**: React + Vite + Tailwind CSS. Served efficiently via Nginx (Alpine).
- **Backend**: Go (Gin + Gorilla WebSockets). Highly optimized concurrent room manager utilizing `sync.Map`.
- **Database**: Redis (Strictly Ephemeral, No Volumes, 256MB Hard Cap).
