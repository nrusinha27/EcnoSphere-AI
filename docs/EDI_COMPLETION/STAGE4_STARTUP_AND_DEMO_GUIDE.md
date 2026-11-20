# EconoSphere AI — Stage 4: Local Startup & University Demonstration Guide

**Status:** `STAGE4_VERIFIED_WITH_WARNINGS`  
**Milestone:** EDI Demonstration Fast-Track — Stage 4  
**Date:** 2026-11-19  
**Deliverable Path:** `docs/EDI_COMPLETION/STAGE4_STARTUP_AND_DEMO_GUIDE.md`

---

## 1. Prerequisites & Environment

Before starting the demonstration, verify that the following dependencies are installed on the host machine:

| Component | Minimum Version | Verification Command | Status on Demo Host |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10/11 (PowerShell) | `[System.Environment]::OSVersion.Version` | Windows 11 Enterprise |
| **Python** | Python 3.11 – 3.14 | `python --version` | Python 3.14.6 |
| **Node.js** | Node.js v18+ | `node --version` | Node.js v20+ |
| **PostgreSQL** | PostgreSQL 15 or 16 | `pg_isready -p 5432` | Running on port 5432 |
| **Redis** | Redis 7+ (Docker or local) | `docker --version` | Docker Engine installed |

---

## 2. Configuration & Environment Variables

### 2.1 Backend Environment (`apps/api/.env`)
Verify that `apps/api/.env` exists and contains the required local service configurations. **Do not expose credentials in documentation — open the `.env` file directly to review values.**

The file should define these keys (values depend on your local setup):
```ini
APP_NAME="EconoSphere AI API"
ENV=development
PRODUCTION_SAFETY_MODE=false

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=econosphere
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<check your .env file>

REDIS_HOST=localhost
REDIS_PORT=6379

NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<check your .env file>
```

### 2.2 Frontend Environment (`apps/web/.env.local`)
The file `apps/web/.env.local` already contains the correct local backend URL — no changes are needed:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 3. Terminal-by-Terminal Startup Instructions

To run the complete platform locally, open **four separate PowerShell terminals** in the project root (`D:\Development\EconoSphere AI`):

### Terminal 1: Supporting Infrastructure (PostgreSQL & Redis)

**PostgreSQL** runs natively on port 5432 (not in Docker). Verify it is active:
```powershell
pg_isready -p 5432
# Expected output: localhost:5432 - accepting connections
# If not running: check Windows Services for your PostgreSQL installation (e.g. postgresql-x64-16)
```

**Redis** is started via Docker Compose (idempotent — safe to run even if already started):
```powershell
docker compose -f infrastructure/docker/docker-compose.yml up -d redis
# Verify:
docker compose -f infrastructure/docker/docker-compose.yml ps redis
# Expected: "running" state on port 6379
```

**Neo4j (OPTIONAL — Trade Network only):**
> [!NOTE]
> Neo4j is only required for the bilateral trade network page (`/dashboard/trade/network`). Stages 1, 2, and 3 (Crisis Simulation, GDP Forecasting, Country Comparison) work fully without it via the built-in offline fallback. Skip this step if the trade network is not part of the demonstration.

```powershell
# Only if demonstrating the Trade Network page:
docker compose -f infrastructure/docker/docker-compose.yml up -d neo4j
```

### Terminal 2: RQ Simulation Worker (Stage 1 Crisis Engine)
The simulation worker executes background simulation jobs from the Redis queue:
```powershell
cd "D:\Development\EconoSphere AI\apps\api"
.\.venv\Scripts\python workers\simulation_worker.py
# Expected output: Simulation Worker starting (SimpleWorker)...
```

### Terminal 3: FastAPI Backend Server (Stage 1, 2, 3 Endpoints)
Start the Uvicorn ASGI server with automatic reload:
```powershell
cd "D:\Development\EconoSphere AI\apps\api"
.\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Expected output: Application startup complete. Uvicorn running on http://0.0.0.0:8000
```

### Terminal 4: Next.js Frontend Dashboard (Web UI)
Launch the Next.js development server:
```powershell
cd "D:\Development\EconoSphere AI\apps\web"
npm run dev
# Expected output: Ready in ... ms on http://localhost:3000
```

---

## 4. Service Verification & Health Checks

Verify that all local endpoints are responsive before beginning the presentation:

| Target Service | Check Command / URL | Expected Response |
| :--- | :--- | :--- |
| **PostgreSQL** | `pg_isready -p 5432` | `localhost:5432 - accepting connections` |
| **Redis** | `docker compose -f infrastructure/docker/docker-compose.yml ps redis` | `running` |
| **API Health** | `curl http://localhost:8000/api/v1/health` | `{"status":"ok","services":{"postgres":"ok",...}}` |
| **Stage 3 Countries Catalog** | `curl http://localhost:8000/api/v1/countries/available-comparison-countries` | JSON array of 235 countries |
| **Stage 2 Model Info** | `curl http://localhost:8000/api/v1/forecasts/model-info` | `{"model_version":"ECONOSPHERE-PHASE11-PROD-2026-08-21"}` |
| **Frontend Web App** | Browser navigation to `http://localhost:3000` | EconoSphere AI Dashboard loads |
| **Interactive API Docs** | Browser navigation to `http://localhost:8000/docs` | Swagger UI with OpenAPI schemas |

> [!NOTE]
> The `/api/v1/health` endpoint returns a per-service status object. If Redis is not running, `services.redis` will show an error but the API will still start. If Neo4j is not started (optional), `services.neo4j` will show an error — this is expected and non-blocking for Stages 1, 2, and 3.

---

## 5. Recommended 5-Step University Demonstration Script

Follow this structured, 10-minute presentation sequence to highlight technical depth, scientific rigor, and UI responsiveness:

```
[Overview] ───► [Stage 3: Compare] ───► [Stage 2: Forecast] ───► [Stage 1: Simulate] ───► [Governance]
```

### Step 1: Introduction & Architecture Overview (1 Minute)
- **Concept:** Introduce EconoSphere AI as a comprehensive macroeconomic analysis and crisis simulation platform built for university-level research.
- **Key Architecture Points:** Highlight the three-tier data hierarchy:
  1. *Factual Historical Observations* (World Bank WDI panel, 2000–2025).
  2. *Supervised Machine Learning Inference* (Frozen Phase 11 HistGradientBoostingRegressor).
  3. *Dynamic Crisis Simulation* (Agent-based propagation across discrete shock horizons).

### Step 2: Stage 3 — Multi-Country Economic Comparison (3 Minutes)
- **Navigate to:** `http://localhost:3000/dashboard/compare`
- **Demonstrate Country Selection:**
  - Click the **Top 5 Economies** preset button (`USA, CHN, JPN, DEU, IND`).
  - Demonstrate adding/removing a country using the search bar (filtering across 235 countries).
- **Showcase Scientific Integrity in Visualizations:**
  - Point to the **Real GDP Growth Comparison** bar chart with individual observation year tooltips.
  - Show the **Historical Trajectory (2010–2025)** line chart: emphasize that unobserved years are left as discrete gaps (`connectNulls: false`) rather than being falsely connected.
  - Highlight that **CPI Inflation** and **Unemployment** are shown on separate, dedicated charts to strictly prevent unit confusion.
- **Matrix Table & CSV Export:**
  - Scroll to the 14-indicator matrix table. Point out the observation year badges and explicit **Data unavailable** pills for missing metrics (e.g. `govt_debt_pct_gdp`).
  - Click **Export CSV** to demonstrate downloading the authentic tabular dataset.
- **Factual Insights:**
  - Review the factual extremes (highest GDP growth, lowest unemployment) and emphasize the scientific disclaimer stating zero fabricated risk scores.

### Step 3: Stage 2 — Interactive GDP Forecasting (3 Minutes)
- **Transition:** Click the **ML Forecast** badge on the United States summary card (or navigate to `http://localhost:3000/dashboard/forecast?country=USA`).
- **Explain the Frozen Model:**
  - Note the model status: `ECONOSPHERE-PHASE11-PROD-2026-08-21` (HistGradientBoostingRegressor).
  - Emphasize that the model is locked and frozen (Test RMSE: 3.91 pp).
- **Run a What-If Scenario:**
  - Review the baseline 2026 forecast.
  - Adjust policy indicators: raise the Lending Interest Rate from baseline by +2.0%, or increase CPI Inflation.
  - Click **Generate Forecast**.
  - Show real-time model inference output:
    - **Point Estimate:** New predicted GDP growth rate.
    - **Empirical Prediction Interval:** Show the $\pm 11.45$ pp bounds ($Q_{90}$ calibration).
    - **Model Prediction Shift (Delta):** Emphasize the clear non-causal disclaimer: *"Relative to baseline model projection (non-causal)"*.
    - **Modification Breakdown Table:** Review the exact input perturbation table and explain that unperturbed background features use training-cohort median imputation.

### Step 4: Stage 1 — Systemic Crisis Simulation (2 Minutes)
- **Transition:** Click **Simulations** in the sidebar (or navigate to `http://localhost:3000/dashboard/simulation`).
- **Configure & Run Scenario:**
  - Select a crisis scenario (e.g. *Red Sea Shipping Route Disruption* or *Global Supply Chain Shock*).
  - Click **Start Simulation**.
  - Show the terminal where the RQ worker picks up the job in real time.
- **Inspect Results:**
  - Walk through the discrete shock horizons ($T+1, T+7, T+30, T+180, T+365, T+1095$ days).
  - Show GDP impact propagation, trade disruption, and the mean-reverting economic recovery path.

### Step 5: Summary & Governance Conclusion (1 Minute)
- Conclude by summarizing that every stage has been independently verified with zero data fabrication, frozen ML artifacts, and comprehensive end-to-end integration.

---

## 6. Troubleshooting Common Issues

| Issue / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **`Connection refused` on port 5432** | PostgreSQL service is stopped | Verify: `pg_isready -p 5432`. If not responding, check Windows Services for your PostgreSQL installation (e.g. `postgresql-x64-16`). |
| **Simulation stays in `PENDING`** | RQ worker is not running | Open Terminal 2 and start: `.venv\Scripts\python workers\simulation_worker.py`. Redis must also be running. |
| **`Connection refused` on port 6379** | Redis container is not running | Run: `docker compose -f infrastructure\docker\docker-compose.yml up -d redis`. |
| **Trade Network page shows cached/empty data** | Neo4j container is offline | Neo4j is optional. To enable: `docker compose -f infrastructure\docker\docker-compose.yml up -d neo4j`. All other features work without it. |
| **`Address already in use` on port 8000** | Previous Uvicorn instance still running | Find PID and terminate: `Get-NetTCPConnection -LocalPort 8000` then `Stop-Process -Id <PID>`. |
| **`ECONNREFUSED` on port 3000** | Next.js server not started | Open Terminal 4 and run: `npm run dev` in `apps/web`. |

---

## 7. Clean Shutdown Procedure

When the demonstration is finished, terminate services gracefully:

1. In Terminal 4 (Next.js): Press `Ctrl+C`.
2. In Terminal 3 (FastAPI): Press `Ctrl+C`.
3. In Terminal 2 (RQ Worker): Press `Ctrl+C`.
4. In Terminal 1 (Redis): Stop the container:
   ```powershell
   docker compose -f infrastructure/docker/docker-compose.yml stop redis
   ```
