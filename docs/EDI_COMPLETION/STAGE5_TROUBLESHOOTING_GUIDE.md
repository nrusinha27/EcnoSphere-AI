# EconoSphere AI — Stage 5: Presentation Troubleshooting & Emergency Runbook

**Status:** `STAGE5_VERIFIED_WITH_WARNINGS`  
**Milestone:** EDI Demonstration Fast-Track — Stage 5  
**Date:** 2026-11-19  
**Target Audience:** Presenters, Demonstrators, Technical Operators  
**Deliverable Path:** `docs/EDI_COMPLETION/STAGE5_TROUBLESHOOTING_GUIDE.md`

---

## Quick Reference — Emergency 30-Second Fixes

| Symptom | Root Cause | 30-Second Fix |
| :--- | :--- | :--- |
| **Port 8000 already in use** | Stray Uvicorn instance from earlier test | `Get-NetTCPConnection -LocalPort 8000 \| % { Stop-Process -Id $_.OwningProcess -Force }` |
| **Port 3000 already in use** | Stray Next.js instance running | `Get-NetTCPConnection -LocalPort 3000 \| % { Stop-Process -Id $_.OwningProcess -Force }` |
| **Simulation says `Failed to enqueue`** | Redis container is offline | `docker compose -f infrastructure/docker/docker-compose.yml up -d redis` |
| **Simulation stays in `PENDING`** | RQ worker process not started | In API venv: `python workers/simulation_worker.py` |
| **PostgreSQL connection refused (5432)** | Windows Postgres service stopped | Check Windows Services: `Start-Service postgresql-x64-16` or run pg_isready |
| **Trade network map shows cached message** | Neo4j container is offline | Normal behavior; platform gracefully uses `cached_network.json`. To start Neo4j: `docker compose ... up -d neo4j` |
| **404 on forecast for Germany (`DEU`)** | Forecast model only covers 5 economies | Normal behavior; explain that Phase 11 is calibrated exclusively for `CHN, GBR, IND, JPN, USA` |

---

## Detailed Troubleshooting Scenarios

### 1. Port Collisions on Windows

#### Problem:
`OSError: [WinError 10048] Only one usage of each socket address (protocol/network address/port) is normally permitted`

#### Solution:
Identify and terminate the process holding the port:
```powershell
# For Port 8000 (FastAPI):
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000) { Stop-Process -Id $port8000.OwningProcess -Force; Write-Host "Port 8000 freed." }

# For Port 3000 (Next.js):
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force; Write-Host "Port 3000 freed." }
```

---

### 2. Redis Offline or Docker Daemon Not Running

#### Problem:
Clicking "Start Simulation" displays:
`500 Internal Server Error: Failed to enqueue simulation job: Error 10061 connecting to localhost:6379.`

#### Diagnosis:
1. Check if Docker Desktop is running:
   ```powershell
   docker info
   ```
2. If Docker displays `failed to connect to the docker API`:
   - Open **Docker Desktop** from the Windows Start menu and wait for the whale icon to turn green.
   - Run:
     ```powershell
     docker compose -f infrastructure/docker/docker-compose.yml up -d redis
     ```
3. If Docker cannot be started during the demo:
   - **Pivot to Stage 3 (Country Comparison) and Stage 2 (GDP Forecasting).**
    - Explain to the evaluators: *"Country Comparison and GDP Forecasting are separate application modules that operate synchronously in-process without Redis. Crisis Simulation depends on the Redis queue and a running simulation worker — if either is unavailable, simulation submission or background processing will fail. Only simulation enqueueing is affected; this dependency is by design for distributed background execution."*

---

### 3. Simulation Worker Event Loop / Asyncpg Collision

#### Problem:
Simulation worker crashes on Windows with:
`RuntimeError: Event loop is closed` or `Future <...> attached to a different loop`

#### Solution:
The worker in `apps/api/workers/simulation_worker.py` is configured with `ThreadPoolExecutor` and a `NullPool` SQLAlchemy engine specifically to prevent Windows event loop pollution.
Ensure you start the worker using the dedicated script:
```powershell
cd "D:\Development\EconoSphere AI\apps\api"
.\.venv\Scripts\python workers\simulation_worker.py
```
Do **not** import or run the worker inside an interactive Jupyter notebook or multi-threaded REPL on Windows.

---

### 4. Neo4j Offline — Trade Graph Fallback

#### Problem:
Navigating to `/dashboard/trade/network` displays cached nodes or backend logs show:
`neo4j_graph_unavailable_for_simulation_precheck error='Neo4j driver not initialized'`

#### Diagnosis & Resolution:
- **This is expected and non-blocking.** Neo4j is an optional service in EconoSphere AI.
- When Neo4j is offline, the backend's `TradeGraphRepository` automatically catches the exception and serves pre-computed centrality and dependency metrics from `data/processed/cached_network.json`.
- If live Cypher queries are explicitly requested by the evaluator, launch Neo4j:
  ```powershell
  docker compose -f infrastructure/docker/docker-compose.yml up -d neo4j
  ```
  Wait 15 seconds for indexes to initialize.

---

### 5. Missing Data Representation in Country Comparison

#### Question from Evaluator:
*"Why does Central Government Debt show 'Data unavailable' for Germany and Japan?"*

#### Recommended Academic Answer:
> "In the World Bank World Development Indicators (WDI) central registry, central government debt (`govt_debt_pct_gdp`) is reported for only ~90 out of 217 reporting entities—a global missingness rate exceeding 80%.
>
> Many macroeconomic tools mask this by imputing zeros or carrying forward decades-old figures. In EconoSphere AI, our scientific governance protocol strictly prohibits data fabrication: if an indicator was not reported by the national statistical agency for that observation period, we preserve the value as `null` and render an explicit **Data unavailable** badge. Furthermore, our historical trend lines enforce `connectNulls: false` to ensure missing years are visually distinguished as discrete gaps."

---

### 6. Forecast Scenario Delta vs. Causal Impact

#### Question from Evaluator:
*"Does this what-if scenario prove that raising interest rates causes a 0.4% decline in GDP growth?"*

#### Recommended Academic Answer:
> "No, and that distinction is central to our platform's governance. Our results panel explicitly labels this outcome as a **Model Prediction Shift (Delta)** with the subtitle: *'Relative to baseline model projection (non-causal)'*.
>
> The Phase 11 model is a supervised machine learning regressor (HistGradientBoosting) trained to predict conditional expectations based on historical joint distributions. It identifies statistical correlation patterns; establishing structural causal effects would require an instrumental variables framework, structural vector autoregression (SVAR), or a calibrated dynamic stochastic general equilibrium (DSGE) model."

---

### 7. Emergency Reset / Process Cleanup Script

If unexpected application state occurs during demo preparation, run this single PowerShell block to reset the host environment cleanly:

```powershell
# Terminate any stray API, Web, or Worker processes
Get-Process python, node, uvicorn -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*EconoSphere*" } | Stop-Process -Force

# Stop Docker infrastructure cleanly
docker compose -f "D:\Development\EconoSphere AI\infrastructure\docker\docker-compose.yml" stop redis neo4j 2>$null

Write-Host "EconoSphere AI environment reset complete. Ports 8000 and 3000 are clear." -ForegroundColor Green
```
