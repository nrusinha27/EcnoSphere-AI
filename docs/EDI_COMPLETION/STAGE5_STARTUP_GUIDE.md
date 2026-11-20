# EconoSphere AI — Stage 5: Comprehensive Local Startup & Operations Guide

**Status:** `STAGE5_VERIFIED`  
**Milestone:** EDI Demonstration Fast-Track — Stage 5 (Demo Preparation & Presentation Readiness)  
**Date:** 2026-11-19  
**Target Environment:** Windows 10/11 (PowerShell)  
**Deliverable Path:** `docs/EDI_COMPLETION/STAGE5_STARTUP_GUIDE.md`

---

## 1. Architectural Overview & Service Dependencies

EconoSphere AI integrates three primary macroeconomic engines, each with distinct runtime dependencies:

| Service / Subsystem | Host / Port | Dependency Type | Purpose | Criticality |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | `localhost:5432` | Native Service | Core relational database (scenarios, simulation runs, logs, snapshots) | **MANDATORY** |
| **FastAPI Backend Gateway** | `localhost:8000` | Python 3.11+ / Uvicorn | REST API gateway, ML inference engine, comparison service | **MANDATORY** |
| **Next.js Web Frontend** | `localhost:3000` | Node.js / React 19 | Interactive UI, charts, comparative matrix, what-if panels | **MANDATORY** |
| **Redis Cache / Queue** | `localhost:6379` | Docker / Compose | Background task queue for RQ simulation jobs | **REQUIRED FOR SIMULATION** |
| **RQ Simulation Worker** | Host background process | Python / Redis | Executes multi-horizon shock propagation & recovery engine | **REQUIRED FOR SIMULATION** |
| **Neo4j Graph Database** | `localhost:7687` | Docker / Compose | Bilateral trade network dependency exploration | **OPTIONAL (Offline fallback supported)** |

> [!IMPORTANT]
> **Component Independence Notice:**
> - **Stage 3 (Multi-Country Comparison):** Completely independent of Redis and Neo4j. Operates entirely in memory using the deduplicated `master_panel.csv`.
> - **Stage 2 (Interactive GDP Forecasting):** Completely independent of Redis and Neo4j. Executes deterministic inference against the frozen Phase 11 model (`best_t1_gdp_growth_model.joblib`).
> - **Stage 1 (Crisis Simulation):** Requires PostgreSQL + Redis + RQ Worker. If Redis is unavailable, simulation submission returns an explanatory 500 error and records the run as `FAILED`.
> - **Trade Network Visualizer (`/dashboard/trade/network`):** If Neo4j is offline, automatically falls back to cached graph data (`data/processed/cached_network.json`) without crashing.

---

## 2. Pre-Flight Environment Checklist

Before running the application, verify your local system has the required tooling installed:

```powershell
# 1. Verify Python virtual environment
& "apps\api\.venv\Scripts\python.exe" --version
# Expected: Python 3.11 - 3.14

# 2. Verify Node.js and npm
node --version
npm --version
# Expected: Node v18+ and npm v9+

# 3. Verify PostgreSQL status on port 5432
Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet
# Expected: True (accepting connections)

# 4. Check Docker Desktop status (for Redis & Neo4j)
docker info
# If Docker is running: Proceed to start Redis via Compose
# If Docker is offline: Stages 2 & 3 will function fully; start Docker Desktop if demonstrating Stage 1
```

---

## 3. Terminal-by-Terminal Startup Instructions (Manual Mode)

To run the complete platform locally with clear operational visibility, open **four separate PowerShell windows** in the repository root (`D:\Development\EconoSphere AI`):

### Terminal 1: Infrastructure (Redis & Optional Neo4j)

Ensure PostgreSQL is already running natively on port 5432. Then launch containerized services via Docker Compose:

```powershell
# Start Redis (Required for Stage 1 Crisis Simulations)
docker compose -f infrastructure/docker/docker-compose.yml up -d redis

# (Optional) Start Neo4j (Only if exploring live Cypher trade network graphs)
docker compose -f infrastructure/docker/docker-compose.yml up -d neo4j

# Verify container health:
docker compose -f infrastructure/docker/docker-compose.yml ps
```

*Expected output:*
```
NAME                    IMAGE            COMMAND                  SERVICE   CREATED         STATUS                   PORTS
infrastructure-redis-1  redis:7-alpine   "docker-entrypoint.s…"   redis     Up 10 seconds   Up 10 seconds (healthy)  0.0.0.0:6379->6379/tcp
```

---

### Terminal 2: RQ Simulation Worker (Stage 1 Engine)

The simulation worker polls the Redis `simulation_queue` and executes macroeconomic shock calculations in the background:

```powershell
cd "D:\Development\EconoSphere AI\apps\api"
.\.venv\Scripts\python workers\simulation_worker.py
```

*Expected output:*
```
2026-11-19 16:xx:xx [info] Simulation Worker starting (SimpleWorker)...
2026-11-19 16:xx:xx [info] Listening on queues: simulation_queue
```

*Leave this window running during the demonstration.*

---

### Terminal 3: FastAPI Backend API Server (Port 8000)

Start the Uvicorn ASGI server with automatic reload:

```powershell
cd "D:\Development\EconoSphere AI\apps\api"
.\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*Expected output:*
```
[info] Starting EconoSphere AI API...
[info] Application startup complete.
Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### Terminal 4: Next.js Frontend Dashboard (Port 3000)

Start the Next.js development server:

```powershell
cd "D:\Development\EconoSphere AI\apps\web"
npm run dev
```

*Expected output:*
```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - Network:      http://0.0.0.0:3000

 ✓ Ready in 2.1s
```

---

## 4. One-Click Automated Scripts (Optional)

For faster demonstration setup, two automated PowerShell helper scripts are provided in the `scripts/` directory:

### One-Click Startup: `scripts/start_demo.ps1`
```powershell
# From project root:
.\scripts\start_demo.ps1
```
This script:
1. Verifies PostgreSQL on port 5432.
2. Checks Docker daemon and starts Redis via Compose (if Docker is running).
3. Spawns the FastAPI backend on `http://localhost:8000`.
4. Spawns the Next.js frontend on `http://localhost:3000`.
5. Spawns the simulation worker (if Redis is active).
6. Executes automated health check on `http://localhost:8000/api/v1/health`.

### One-Click Shutdown: `scripts/stop_demo.ps1`
```powershell
# From project root:
.\scripts\stop_demo.ps1
```
This script:
1. Gracefully terminates Uvicorn (port 8000).
2. Gracefully terminates Next.js (port 3000).
3. Gracefully terminates the RQ simulation worker process.
4. Stops Docker containers (`docker compose ... stop redis neo4j`).

---

## 5. Post-Startup Service Verification (Health Check)

Run these quick curl or browser checks before welcoming the presentation audience:

| Check | URL / Command | Expected Output | Meaning |
| :--- | :--- | :--- | :--- |
| **System Health** | `curl -s http://localhost:8000/api/v1/health` | `{"status":"...","services":{"postgres":"ok",...}}` | API and DB operational |
| **Country Catalog** | `curl -s http://localhost:8000/api/v1/countries/available-comparison-countries` | JSON array of 235 countries | Stage 3 ready |
| **Model Version** | `curl -s http://localhost:8000/api/v1/forecasts/model-info` | `{"model_version":"ECONOSPHERE-PHASE11-PROD-2026-08-21",...}` | Stage 2 model ready |
| **Web Dashboard** | Open `http://localhost:3000` | Global Macroeconomic Overview page | Web UI ready |
| **Comparison UI** | Open `http://localhost:3000/dashboard/compare` | Country selection badges & charts | Stage 3 UI ready |
| **Forecast UI** | Open `http://localhost:3000/dashboard/forecast` | What-if scenario form & predictions | Stage 2 UI ready |
| **Simulation UI** | Open `http://localhost:3000/dashboard/simulation` | Scenario cards & run launcher | Stage 1 UI ready |

---

## 6. Clean Shutdown Procedure

When your demonstration concludes, execute the following commands to free all ports and resources cleanly:

1. In Terminal 4 (Next.js): Press `Ctrl+C` (type `Y` to terminate batch job).
2. In Terminal 3 (FastAPI): Press `Ctrl+C`.
3. In Terminal 2 (RQ Worker): Press `Ctrl+C`.
4. In Terminal 1 (Docker Infrastructure): Stop Compose services:
   ```powershell
   docker compose -f infrastructure/docker/docker-compose.yml stop redis neo4j
   ```
5. Confirm ports are released:
   ```powershell
   Get-NetTCPConnection -LocalPort 8000, 3000, 6379 -ErrorAction SilentlyContinue
   # Expected output: (none)
   ```
