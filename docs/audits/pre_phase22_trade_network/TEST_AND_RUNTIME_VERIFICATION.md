# Test Coverage and Runtime Verification Audit Report

**Audit Target:** Automated Test Suites & Runtime System State  
**Audit Scope:** Pytest Suite, Vitest Suite, Runtime Execution Diagnostics, and Failure Reproduction  
**Date:** October 15, 2026  

---

## 1. Automated Test Execution & Results

### 1.1 Backend Pytest Execution
- **Command:** `apps\api\.venv\Scripts\pytest apps/api/tests/test_graph_api.py apps/api/tests/test_simulation_strategy.py -v`
- **Execution Timestamp:** 2026-10-15 13:58:15 UTC+5:30
- **Duration:** 4.33s
- **Outcome:** **8 PASSED, 11 WARNINGS, 0 FAILED**

#### Test Breakdown:
1. `apps/api/tests/test_graph_api.py::test_get_global_network` -> **PASSED**
2. `apps/api/tests/test_graph_api.py::test_get_neighbors` -> **PASSED**
3. `apps/api/tests/test_graph_api.py::test_get_shortest_path` -> **PASSED**
4. `apps/api/tests/test_graph_api.py::test_get_centrality` -> **PASSED**
5. `apps/api/tests/test_simulation_strategy.py::test_fallback_global_propagation` -> **PASSED**
6. `apps/api/tests/test_simulation_strategy.py::test_deterministic_order_and_magnitude_routing` -> **PASSED**
7. `apps/api/tests/test_simulation_strategy.py::test_cycle_and_loop_protection` -> **PASSED**
8. `apps/api/tests/test_simulation_strategy.py::test_multiple_simultaneous_shocks_aggregation` -> **PASSED**

---

### 1.2 Frontend Vitest Execution
- **Command:** `npm test` (invoking `vitest run`) in `apps/web`
- **Execution Timestamp:** 2026-10-15 13:58:36 UTC+5:30
- **Duration:** 3.07s
- **Outcome:** **2 TEST FILES PASSED, 5 TESTS PASSED, 0 FAILED**

#### Test Breakdown:
1. `src/__tests__/network.test.tsx`
   - `renders EmptyState component with correct title, description, and action` -> **PASSED**
   - `renders ErrorState component with error details and retry functionality` -> **PASSED**
2. `src/__tests__/useGraph.test.tsx`
   - `accurately calculates global trade volume and KPI aggregates` -> **PASSED**
   - `correctly filters network links by minimum volume threshold` -> **PASSED**
   - `correctly filters nodes and connected edges by regional domain` -> **PASSED**

---

## 2. Test Quality & Coverage Gap Analysis

### 2.1 The "100% Mock Illusion"
While both test suites report 100% pass rates, a forensic review reveals that **not a single test verifies real system functionality**:

1. **Backend Tests:**
   - In `apps/api/tests/test_graph_api.py`, every test mocks out `graph_service` using `unittest.mock.patch` with artificial dictionary literals:
     ```python
     with patch("app.services.graph.graph_service.get_network", new_callable=AsyncMock) as mock_get:
         mock_get.return_value = {
             "nodes": [{"id": "USA", "label": "United States", "properties": {"region": "Americas"}}],
             "edges": [{"id": "e1", "source": "USA", "target": "CAN", "type": "TRADE", "properties": {"weight": 500.0}}]
         }
     ```
   - Zero tests exercise `GraphRepository`.
   - Zero tests execute Cypher queries.
   - Zero tests verify Neo4j data parsing or error handling.
   - Zero tests verify the UN Comtrade download script (`download_trade.py`).

2. **Frontend Tests:**
   - `network.test.tsx` tests only generic `EmptyState` and `ErrorState` UI widgets. It never renders `<TradeGraph>` or `<TradeNetworkPage>`.
   - `useGraph.test.tsx` does not test the `useGlobalNetwork` or `useCentrality` React hooks. It defines an inline array of 4 mock objects and performs simple JavaScript `.reduce()` and `.filter()` operations on them.
   - Zero tests verify Cytoscape canvas initialization.
   - Zero tests verify search input or category button filtering.
   - Zero tests verify edge dimming behavior or the timeline slider.

---

## 3. Runtime Verification & Live Failure Reproduction

### 3.1 Listening Port & Infrastructure Audit
To verify system state safely without starting uncontrolled containers, active TCP listening ports were inspected:
- **Port 5432 (PostgreSQL):** LISTENING (PID 7844)
- **Port 7687 (Neo4j):** **NOT LISTENING (OFFLINE)**
- **Port 8000 (FastAPI):** **NOT LISTENING (OFFLINE)**
- **Port 3000 (Next.js):** **NOT LISTENING (OFFLINE)**
- **Port 6379 (Redis):** **NOT LISTENING (OFFLINE)**
- **Docker Containers:** None active (`docker ps` returned 0 containers).

---

### 3.2 Unmocked API Runtime Test (Failure Reproduction)
A non-destructive test was executed using FastAPI's `TestClient` without mocks against `apps/api/app/main.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as client:
    response = client.get('/api/v1/graph/network')
```

#### Observed Runtime Behavior:
1. FastAPI started in-memory and entered lifespan.
2. Lifespan invoked `await neo4j_conn.connect()`, which acquired driver configuration lazily.
3. The request entered `get_global_network()`, invoking `graph_service.get_network()` -> `GraphRepository.get_network()`.
4. `session.execute_read` attempted to connect to `localhost:7687`.
5. The Neo4j driver initiated retry loops:
   - `Transaction failed and will be retried in 0.89s (Couldn't connect to localhost:7687: Connect call failed [Errno 10061])`
   - Retried at 1.80s, 3.22s, 7.71s, 13.30s.
6. After backoff exhaustion, the driver threw an unhandled exception:
   ```text
   neo4j.exceptions.ServiceUnavailable: Couldn't connect to localhost:7687 (resolved to ('[::1]:7687', '127.0.0.1:7687')):
   Failed to establish connection to ResolvedIPv6Address(('::1', 7687, 0, 0)) (reason [Errno 10061] Connect call failed)
   ```
7. **Conclusion:** In production, this causes an uncaught 500 Internal Server Error, confirming Issue TN-02.

---

## 4. Blocked Checks Matrix

| Verification Item | Status | Exact Blocker |
|---|---|---|
| End-to-end browser graph rendering with live data | **BLOCKED** | Neo4j service is offline; no live real data exists in any database. |
| Verification of Cytoscape responsiveness on large graphs | **BLOCKED** | No large dataset exists in the repository. |
| Production deployment verification in Docker | **BLOCKED** | Strictly prohibited by audit governance rules (read-only audit). |
