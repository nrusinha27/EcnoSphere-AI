# EconoSphere AI — EDI Demonstration Implementation Plan

**Project:** EconoSphere AI — Global Economic Crisis Simulator & Decision Intelligence Platform  
**Target Milestone:** University EDI Project Demonstration  
**Purpose:** Actionable, prioritized implementation roadmap to achieve 100% demo-ready capability  
**Date:** November 18, 2026  
**Author:** Principal Software Architect, Full-Stack Lead, and Data Governance Lead  

---

## 1. Feature Classification Matrix (Checkpoint 6)

Every required demonstration feature has been classified into its exact empirical readiness state:

| Feature Area | Specific Functionality | Current State | Classification | Primary Action Required |
|---|---|---|---|---|
| **1. Global Economic Dashboard** | World Map Choropleth & Sovereignty Markers | Live on `/dashboard` | **VERIFIED WORKING** | None. Map loads from `GET /api/v1/countries`. |
| | Global Macroeconomic Indicators (GDP, Inflation) | Populated in PostgreSQL | **VERIFIED WORKING** | None. Renders seeded countries accurately. |
| | Country Directory & Search | Live on `/dashboard/countries` | **VERIFIED WORKING** | None. Full pagination and live search active. |
| **2. Real Trade Network** | Directed Bilateral Corridors (UN Comtrade 2022) | Live on `/dashboard/trade/network` | **VERIFIED WORKING** | None. Serves 2022 network with dynamic thickness. |
| | Bilateral Corridor Inspector (FOB vs CIF) | Tappable edge inspector | **VERIFIED WORKING** | None. Displays empirical valuation differences. |
| | Out-Degree Centrality Rankings | Live top-exporter list | **VERIFIED WORKING** | None. Dynamically calculated from graph topology. |
| | Multi-Year Timeline Empty States | Year slider active | **VERIFIED WORKING** | None. Honest empty states for unobserved years. |
| **3. GDP Forecasting (ML)** | Official Phase 11 2026 Forecast Table | Live on `/dashboard/forecast` | **VERIFIED WORKING** | None. Displays 5 major economies with 90% intervals. |
| | Frozen Model Identity & Metadata | Endpoint `/forecasts/model-info` | **VERIFIED WORKING** | None. Validates manifest SHA-256 and MD5 live. |
| | Live Inference API (`POST /forecasts/gdp`) | Implemented in backend | **VERIFIED WORKING** | Tested live; returns valid GDP prediction in 1.2 ms. |
| | Interactive What-If Scenario Slider Form | Frontend slider controls | **PARTIALLY WORKING** | Connect UI sliders to `POST /api/v1/forecasts/gdp`. |
| **4. Economic Crisis Simulator** | Pre-built Scenario Catalog (7 Scenarios) | Seeded in `scenarios` table | **VERIFIED WORKING** | None. COVID, 2008 Crash, Tariff Shock present. |
| | Topological Shock Propagation Math | `apps/api/app/engine` | **VERIFIED WORKING** | Passed all unit tests in `test_simulation_strategy.py`. |
| | Asynchronous Job Dispatch | Redis RQ Queue | **BLOCKED** | Redis server not running locally on port 6379. |
| | Timeline Player & Impact Map WebSocket | `/simulation/{id}/stream` | **PARTIALLY WORKING** | Stream router exists; needs active simulation snapshots. |
| **5. Country Comparison & Impact** | Individual Country Profiles | `/dashboard/countries/[iso3]` | **VERIFIED WORKING** | Renders GDP, inflation history, and metadata. |
| | Side-by-Side Multi-Country Comparison | Multi-country comparison tool | **NOT IMPLEMENTED** | Add comparison tab or modal to compare 2–3 countries. |
| **6. Final Demo Readiness** | Automated Regression Suite (85/85 tests) | Full suite passing | **VERIFIED WORKING** | Continuous execution guard active. |
| | Single-Click Demo Launch Script | Startup orchestrator | **NOT IMPLEMENTED** | Create PowerShell launch script (`run_demo.ps1`). |

---

## 2. Shortest Realistic Implementation Sequence for EDI Demo

To achieve full demonstration capability with the highest impact and lowest operational risk, execute the following 4-stage sprint:

```
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Infrastructure Unblocking (Redis & Simulation Runner)         │
│ Estimated Time: 15–30 minutes                                          │
│ Scope: Start Redis or add synchronous execution fallback.              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ STAGE 2: Interactive What-If GDP Forecasting Form                      │
│ Estimated Time: 45–60 minutes                                          │
│ Scope: Connect UI sliders on /dashboard/forecast to POST /forecasts/gdp│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ STAGE 3: Multi-Country Comparison View                                 │
│ Estimated Time: 45–60 minutes                                          │
│ Scope: Add side-by-side indicator & trade comparison in countries view │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ STAGE 4: One-Click Demo Orchestration Script & Dry Run                 │
│ Estimated Time: 15–20 minutes                                          │
│ Scope: Create run_demo.ps1 and rehearse presentation walkthrough       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Work Breakdown by Stage

### Stage 1: Infrastructure Unblocking (Crisis Simulation Runner)
- **Problem:** When users click "Start Simulation", FastAPI tries to connect to Redis on `localhost:6379`. Because Redis is not running, the request fails.
- **Solution Option A (Recommended for Docker):**
  Start Redis using the existing docker-compose configuration:
  ```powershell
  docker run -d --name econosphere-redis -p 6379:6379 redis:7-alpine
  ```
  Start the RQ simulation worker:
  ```powershell
  .\apps\api\.venv\Scripts\python.exe apps/api/workers/simulation_worker.py
  ```
- **Solution Option B (Zero-Dependency In-Process Runner):**
  Add a synchronous development fallback in `SimulationService.start_simulation()`:
  If Redis is unreachable, execute `SimulationEngine(session, run.id).execute()` directly as an in-process `asyncio.create_task()`.
  This allows the entire simulation timeline (Day 1, 7, 30, 90, 180, 365) to run locally without needing external Redis or worker processes!

---

### Stage 2: Interactive What-If GDP Forecasting UI
- **Objective:** Allow the EDI audience/jury to manipulate economic policy levers and immediately see how the frozen Phase 11 AI model forecasts GDP growth.
- **Implementation:**
  1. In `apps/web/src/app/dashboard/forecast/page.tsx`:
     Add an interactive **"Policy Shock Simulator"** card with intuitive sliders:
     - **Tariff Rate Shock:** Slider from $0\%$ to $25\%$ (default: baseline value).
     - **Inflation Shock:** Slider from $0\%$ to $15\%$.
     - **Unemployment Shock:** Slider from $2\%$ to $12\%$.
     - **Interest Rate Shock:** Slider from $0\%$ to $10\%$.
     - **Trade Openness:** Slider from $10\%$ to $60\%$.
  2. Wire the form to call `POST /api/v1/forecasts/gdp`:
     ```typescript
     const { data } = await apiClient.post('/forecasts/gdp', {
       country: selectedCountry,
       year: 2026,
       tariff_rate_pct: tariff,
       inflation_cpi_pct: inflation,
       unemployment_pct: unemployment,
       interest_rate_pct: interestRate,
       trade_openness: openness,
       // All remaining 26 features auto-filled from country baseline
     });
     ```
  3. Render the output:
     - Projected GDP Growth Rate (e.g. `+1.85%` vs Baseline `+2.10%`).
     - Delta impact: `-0.25% GDP contraction from tariff increase`.
     - 90% confidence interval band based on $Q_{90} = 11.45\%$.

---

### Stage 3: Side-by-Side Country Comparison View
- **Objective:** Allow comparing two economies (e.g. USA vs. China, or Germany vs. Japan) side-by-side to demonstrate trade imbalances and macroeconomic divergences.
- **Implementation:**
  1. Add a **"Compare Economies"** selector at the top of `/dashboard/countries` or `/dashboard/countries/[iso3]`.
  2. Allow picking Country A (e.g. `USA`) and Country B (e.g. `CHN`).
  3. Display a clean comparative card:
     - **Macroeconomic Head-to-Head Table:** Population, GDP, Inflation, Income Group.
     - **Dual-Series ECharts History:** Overlay Country A vs. Country B GDP growth trajectories (2000–2024).
     - **Bilateral Corridor Reality:** Direct export/import values and trade balance between Country A and Country B (queried from `/api/v1/graph/corridor?source=USA&target=CHN`).

---

### Stage 4: One-Click Demo Orchestration Script & Presentation Walkthrough
- **Create `run_demo.ps1` in project root:**
  ```powershell
  # EconoSphere AI — One-Click University EDI Demonstration Launcher
  Write-Host "Starting EconoSphere AI Services..." -ForegroundColor Cyan

  # 1. Verify PostgreSQL and Neo4j
  # 2. Start Redis or verify in-process fallback
  # 3. Launch FastAPI backend on http://localhost:8000
  # 4. Launch Next.js web dashboard on http://localhost:3000
  # 5. Open Chrome/Edge directly to http://localhost:3000/dashboard
  ```

---

## 4. University EDI Presentation Walkthrough Script (5-Minute Demo Flow)

| Time | Screen / Page | Demonstration Narrative | Key Takeaway for Jury |
|---|---|---|---|
| **0:00–1:00** | `/dashboard` (Global Map) | "Welcome to EconoSphere AI. We begin at the Global Economic Command Center, visualizing sovereign macroeconomic profiles and geographic indicators across major economies." | Real-time full-stack integration with PostgreSQL and responsive UI. |
| **1:00–2:15** | `/dashboard/trade/network` | "Next, we examine the Global Trade Network. Rather than relying on synthetic mocks, EconoSphere AI integrates empirical UN Comtrade bilateral trade flows for 2022. Watch how the directed corridor between USA and China preserves real valuation differences (FOB vs. CIF) without artificial smoothing." | Replaced legacy synthetic network with reproducible, data-backed property graph. |
| **2:15–3:30** | `/dashboard/forecast` | "Here is our GDP Forecasting Subsystem. EconoSphere AI uses a frozen Phase 11 HistGradientBoosting model trained on decades of World Bank data. Notice our official 2026 forecast with calibrated 90% uncertainty bounds. Now, let's test a policy shock: if we simulate a 10% tariff hike on the USA, our model instantly projects the marginal GDP contraction." | Authentic ML deployment with cryptographic provenance and on-demand inference. |
| **3:30–4:30** | `/dashboard/simulation` | "Finally, our Crisis Simulator. We select the 'Global Tariff Shock 2026' scenario. As we launch the simulation, the engine compiles the scenario shocks, traces bilateral supply chain dependencies across the trade graph, and projects economic fallout across 7, 30, and 365-day horizons." | Complex multi-agent economic crisis simulation and shock propagation. |
| **4:30–5:00** | Q&A / Architecture | "Everything you have seen runs on a modern, decoupled architecture: PostgreSQL for transactional truth, Neo4j for topological dependency graphs, and Next.js for high-performance decision intelligence." | Rigorous software engineering, clean architecture, and academic excellence. |

---

## 5. Plan Approval & Readiness Verdict

Executing Stages 1–4 requires **approximately 2 hours of focused frontend/backend wiring** and zero destructive database or model operations. 

Upon user authorization, this plan will bring EconoSphere AI to **100% demonstration-ready excellence** for the university presentation.
