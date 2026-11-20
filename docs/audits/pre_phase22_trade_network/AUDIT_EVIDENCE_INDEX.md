# Trade Network Audit Evidence Index

**Project:** EconoSphere AI  
**Scope:** Forensic Evidence Index for Pre-Phase 22 Trade Network Audit  
**Date:** October 15, 2026  

---

## 1. Codebase Artifacts & File Locations

### 1.1 Frontend Pages & Components
- **Dashboard Trade Redirect:** `apps/web/src/app/dashboard/trade/page.tsx`
  - *Evidence:* Lines 1–6 (307 redirect to `/dashboard/trade/network`).
- **Trade Network Dashboard:** `apps/web/src/app/dashboard/trade/network/page.tsx`
  - *Evidence Line 18:* Unused `timelineYear` state variable.
  - *Evidence Lines 47–48:* Hardcoded fallback strings `'$14.2T (Est)'` and `'28%'`.
  - *Evidence Lines 54–66:* Partner list traversal filtering edges by `selectedNode.id`.
  - *Evidence Lines 75–88:* `graph.nodes.find(n => n.id === c.node_id)` mismatch; static fallback array.
  - *Evidence Lines 121–129:* Phantom "Commodity" filter button.
  - *Evidence Line 261:* Currency unit string format bug (`${link.volume}B`).
  - *Evidence Line 309:* Broken click handler `graph.nodes.find(n => n.id === country.id)`.
  - *Evidence Lines 340–358:* Ornamental timeline slider (2015–2025).
- **Cytoscape Visualizer:** `apps/web/src/components/charts/TradeGraph.tsx`
  - *Evidence Line 47:* Inverted Boolean logic bug in edge dimming (`!hasActiveFilter || ...`).
  - *Evidence Line 113:* Static edge width hardcoded to `2`.
  - *Evidence Lines 143–147:* Dimmed edge selector forcing `opacity: 0.1`.
  - *Evidence Lines 173–179:* Cytoscape force-directed layout configuration (`cose`, `randomize: true`).
- **Data Fetching Hooks:** `apps/web/src/hooks/useGraph.ts`
  - *Evidence Lines 51–60:* `useGlobalNetwork` querying `/graph/network` with 5-minute cache.
  - *Evidence Lines 62–71:* `useCentrality` querying `/graph/centrality`.
- **Navigation Sidebar:** `apps/web/src/components/layout/Sidebar.tsx`
  - *Evidence Line 12:* Route link `{ name: 'Trade Network', href: '/dashboard/trade', icon: Network }`.
- **Country Profile Linking:** `apps/web/src/app/dashboard/countries/[iso3]/page.tsx`
  - *Evidence Line 188:* Static navigation card linking to `/dashboard/trade/network` without ISO3 query param.

---

### 1.2 Backend API & Database Services
- **Router Configuration:** `apps/api/app/api/v1/router.py`
  - *Evidence Line 7:* `api_router.include_router(graph.router, prefix="/graph", tags=["graph"])`.
- **API Endpoints:** `apps/api/app/api/v1/endpoints/graph.py`
  - *Evidence Lines 8–11:* `get_global_network()` handling `/network`.
  - *Evidence Lines 13–16:* `get_neighbors()` handling `/neighbors/{node_id}` (Disconnected).
  - *Evidence Lines 18–21:* `get_shortest_path()` handling `/path` (Disconnected).
  - *Evidence Lines 23–26:* `get_centrality()` handling `/centrality`.
- **Service Layer:** `apps/api/app/services/graph.py`
  - *Evidence Lines 5–23:* `GraphService` delegating all operations to `GraphRepository`.
- **Repository & Cypher Layer:** `apps/api/app/repositories/graph.py`
  - *Evidence Lines 15–27:* `session.execute_read` lacking error handling; maps `node.id = str(value.element_id)`.
  - *Evidence Lines 83–88:* `get_network()` with unparameterized `LIMIT 500`.
  - *Evidence Lines 90–99:* `get_neighbors()` with string-formatted depth traversal.
  - *Evidence Lines 101–107:* `get_shortest_path()` with unbounded `-[*]-` traversal.
  - *Evidence Lines 109–123:* `get_centrality()` returning `n.iso3 AS node_id` using out-degree count proxy.
- **Neo4j Session Manager:** `apps/api/app/neo4j/session.py`
  - *Evidence Lines 8–24:* Lazy driver initialization and index creation for `Country(iso3)`.
- **Database Models:** `apps/api/app/models/country.py`
  - *Evidence Lines 1–43:* PostgreSQL schema defining `Country`, `CountryMetadata`, and `HistoricalIndicator`. Zero trade tables exist.
- **Alembic Migration:** `apps/api/migrations/versions/b2c3d4e5f6a7_add_trade_indexes.py`
  - *Evidence Lines 24–35:* Only creates indexes on `scenarios`, `scenario_versions`, and `scenario_events`.

---

### 1.3 Downstream Simulation & AI Engines
- **Trade Shock Strategy:** `apps/api/app/engine/strategies/trade.py`
  - *Evidence Lines 52–66:* Shocks routed via `str(edge.get("target"))` which receives internal element IDs instead of ISO3 codes.
- **Dependency Resolver:** `apps/api/app/engine/resolver.py`
  - *Evidence Lines 26–34:* Acknowledges ID mismatch: `# In a full setup we match Neo4j internal IDs back to ISO3, but for this MVP structure we assume edge source/target corresponds to element IDs`.
- **Feature Engineering Extractor:** `apps/api/app/ai/feature_engineering/graph_metrics.py`
  - *Evidence Lines 26–33:* Hardcoded fallback graph features (`0.045`, `0.12`, `0.28`, `42.0`, `38.0`).
  - *Evidence Lines 44–58:* Queries `c.pagerank` and `c.betweenness` which do not exist on nodes, triggering silent fallbacks.

---

### 1.4 Data Scripts & Artifacts
- **Synthetic Neo4j Seeder:** `apps/api/scripts/seed_neo4j_trade.py`
  - *Evidence Lines 15–26:* Static list of 10 countries.
  - *Evidence Lines 28–34:* Static list of 5 commodities.
  - *Evidence Lines 53–63:* Random node health `[0.7..1.0]`, stability `[0.6..0.95]`, risk `[0.1..0.4]`.
  - *Evidence Lines 91–115:* Random trade routes with volume `[10k..500k]` and dependency `[0.1..0.8]`.
- **UN Comtrade Download Prototype:** `apps/api/ml/scripts/download/download_trade.py`
  - *Evidence Lines 20–22:* Endpoint `https://comtradeapi.un.org/public/v1/preview/C/A/HS`.
  - *Evidence Line 18:* Output path pointing to nonexistent directory `datasets/raw`.
- **Root Snapshot File:** `network.json`
  - *Evidence:* 127,736 bytes, UTF-16 LE, 13 nodes, 189 edges dumped from `seed_neo4j_trade.py`.
- **World Bank Macro Panel:** `data/raw/master_panel.csv`
  - *Evidence:* World Bank country-level indicators; 0 bilateral partner trade flows.

---

## 2. Test Execution & Diagnostic Command Log

### Command 1: Backend Unit Tests
```powershell
apps\api\.venv\Scripts\pytest apps/api/tests/test_graph_api.py apps/api/tests/test_simulation_strategy.py -v
```
- **Output:** 8 passed, 11 warnings in 4.33s.
- **Significance:** Demonstrates that existing backend tests pass only because 100% of dependencies are mocked out using `AsyncMock`.

### Command 2: Frontend Unit Tests
```bash
npm test # in apps/web
```
- **Output:** 2 passed files, 5 passed tests in 3.07s.
- **Significance:** Demonstrates that frontend tests pass because they evaluate only inline static arrays and empty state UI containers, completely ignoring Cytoscape canvas rendering and React Query hooks.

### Command 3: Unmocked FastAPI TestClient Execution
```powershell
apps\api\.venv\Scripts\python -c "
import sys; sys.path.append('apps/api')
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    response = client.get('/api/v1/graph/network')
"
```
- **Output:** Unhandled exception `neo4j.exceptions.ServiceUnavailable: Couldn't connect to localhost:7687` after 4 driver retries (0.89s, 1.80s, 3.22s, 7.71s, 13.30s).
- **Significance:** Confirms fatal error handling gap (Issue TN-02) when Neo4j is offline.

### Command 4: Cryptographic Hash Verification
```powershell
Get-FileHash -Algorithm MD5 'models/phase11/best_t1_gdp_growth_model.joblib', 'models/phase11/phase11_production_release_manifest.json', 'data/processed/master_panel_t1_missingness.csv'
Get-FileHash -Algorithm SHA256 'models/phase11/best_t1_gdp_growth_model.joblib', 'models/phase11/phase11_production_release_manifest.json', 'data/processed/master_panel_t1_missingness.csv'
```
- **Significance:** Cryptographically proves zero modifications to protected production artifacts before and after the audit.
