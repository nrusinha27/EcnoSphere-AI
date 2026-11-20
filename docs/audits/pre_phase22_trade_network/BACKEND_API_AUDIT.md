# Backend & API Trade Network Audit Report

**Audit Target:** FastAPI Backend (`apps/api`)  
**Audit Scope:** Graph Endpoints, Services, Repositories, Cypher Queries, and Downstream Simulation Hooks  
**Date:** October 15, 2026  

---

## 1. Backend Endpoint Inventory & Specifications

The FastAPI application mounts the graph router in `apps/api/app/api/v1/router.py`:
```python
from app.api.v1.endpoints import graph
api_router.include_router(graph.router, prefix="/graph", tags=["graph"])
```

### 1.1 Endpoint Audit Detail

#### Endpoint 1: `GET /api/v1/graph/network`
- **Source File:** `apps/api/app/api/v1/endpoints/graph.py` (lines 8–11)
- **Handler:** `get_global_network()`
- **Service Delegation:** `graph_service.get_network()` -> `GraphRepository.get_network()`
- **Cypher Query (`apps/api/app/repositories/graph.py`, lines 82–88):**
  ```cypher
  MATCH (n)-[r]->(m)
  RETURN n, r, m
  LIMIT 500
  ```
- **Request Parameters:** None.
- **Response Model:** `GraphResponse` (`{ nodes: List[GraphNode], edges: List[GraphEdge] }`).
- **Data Source:** Neo4j database graph instance.
- **Frontend Caller:** `apps/web/src/hooks/useGraph.ts` -> `useGlobalNetwork()`.
- **Audit Findings:**
  1. **Arbitrary Truncation:** Hardcoded `LIMIT 500` with no `ORDER BY` clause. This results in non-deterministic subgraphs where crucial sovereign relationships are randomly dropped.
  2. **Lack of Filtering Parameters:** Does not accept `year`, `commodity_id`, `min_volume`, or `region` query parameters.
  3. **Element ID Leakage:** `node.id` is populated with Neo4j internal `str(value.element_id)` rather than sovereign `iso3`.
  4. **Fatal Error on DB Outage:** If Neo4j is offline, `session.execute_read` raises `neo4j.exceptions.ServiceUnavailable`, crashing the request with HTTP 500.

---

#### Endpoint 2: `GET /api/v1/graph/neighbors/{node_id}`
- **Source File:** `apps/api/app/api/v1/endpoints/graph.py` (lines 13–16)
- **Handler:** `get_neighbors(node_id: str, depth: int = Query(1, ge=1, le=3))`
- **Service Delegation:** `graph_service.get_neighbors(node_id, depth)` -> `GraphRepository.get_neighbors(node_id, depth)`
- **Cypher Query (`apps/api/app/repositories/graph.py`, lines 90–99):**
  ```cypher
  MATCH p=(n)-[*1..{depth}]-(m)
  WHERE n.iso3 = $node_id OR n.id = $node_id
  RETURN p
  LIMIT 200
  ```
- **Response Model:** `GraphResponse`.
- **Frontend Caller:** **NONE (DEAD / DISCONNECTED ENDPOINT)**.
- **Audit Findings:**
  1. Fully implemented and functional on the backend, but completely orphaned from the frontend web UI.
  2. Cypher query uses unparameterized string formatting for `{depth}` (`[*1..{depth}]`). While validated with `ge=1, le=3`, dynamic query generation should be handled cleanly.

---

#### Endpoint 3: `GET /api/v1/graph/path`
- **Source File:** `apps/api/app/api/v1/endpoints/graph.py` (lines 18–21)
- **Handler:** `get_shortest_path(source: str = Query(...), target: str = Query(...))`
- **Service Delegation:** `graph_service.get_shortest_path(source, target)` -> `GraphRepository.get_shortest_path(source_id, target_id)`
- **Cypher Query (`apps/api/app/repositories/graph.py`, lines 101–107):**
  ```cypher
  MATCH p=shortestPath((n)-[*]-(m))
  WHERE (n.iso3 = $source_id OR n.id = $source_id) AND (m.iso3 = $target_id OR m.id = $target_id)
  RETURN p
  ```
- **Response Model:** `GraphResponse`.
- **Frontend Caller:** **NONE (DEAD / DISCONNECTED ENDPOINT)**.
- **Audit Findings:**
  1. The shortest path endpoint functions in isolation but is never wired up to the frontend UI.
  2. Unbounded traversal `-[*]-` in shortestPath without max-hop limit risks severe performance degradation on large, dense graphs.

---

#### Endpoint 4: `GET /api/v1/graph/centrality`
- **Source File:** `apps/api/app/api/v1/endpoints/graph.py` (lines 23–26)
- **Handler:** `get_centrality()`
- **Service Delegation:** `graph_service.get_centrality()` -> `GraphRepository.get_centrality()`
- **Cypher Query (`apps/api/app/repositories/graph.py`, lines 109–123):**
  ```cypher
  MATCH (n)
  OPTIONAL MATCH (n)-[r]->()
  RETURN n.iso3 AS node_id, count(r) AS score
  ORDER BY score DESC
  LIMIT 10
  ```
- **Response Model:** `List[CentralityResponse]` (`[{ node_id: str, score: float }]`).
- **Frontend Caller:** `apps/web/src/hooks/useGraph.ts` -> `useCentrality()`.
- **Audit Findings:**
  1. **Schema Inconsistency Bug:** Returns `node_id = n.iso3` (e.g., `"USA"`), whereas `/network` returns `id = str(value.element_id)`. This directly breaks frontend node resolution.
  2. **Economic Misrepresentation:** Comment acknowledges: `# Returns out-degree as a centrality proxy (avoids requiring GDS plugin)`. Degree count is not economic centrality (such as PageRank, eigenvector, or betweenness). A country with 5 small export routes will rank equally with a country exporting $500B over 5 routes.

---

## 2. Downstream Simulation Engine & AI Integrations

### 2.1 Trade Shock Strategy (`apps/api/app/engine/strategies/trade.py`)
- Implements `SimulationStrategy.apply_shock()`:
  ```python
  secondary_shock = abs(primary_shock) * edge_weight * (1.0 - decay)
  ```
- **Critical Architectural Disconnect:**
  In `apps/api/app/engine/resolver.py` (lines 26–34):
  ```python
  # In a full setup we match Neo4j internal IDs back to ISO3,
  # but for this MVP structure we assume edge source/target 
  # corresponds to element IDs and we can map them back.
  country_dependencies.append({
      "source": edge.source,
      "target": edge.target,
      "type": edge.type,
      "properties": edge.properties
  })
  ```
  And in `trade.py` (line 55):
  ```python
  target_iso = str(edge.get("target"))
  new_shocks[target_iso]["inflation_increase"] = ...
  ```
  **Result:** When simulation shock propagation runs, `target_iso` is assigned the internal Neo4j element ID (`"4:624f21a6-..."`), NOT the country ISO3 code! Consequently, downstream state updates fail to match sovereign ISO3 keys in `GlobalState`, breaking the entire multi-hop simulation cascade.

---

### 2.2 Feature Engineering Graph Extractor (`apps/api/app/ai/feature_engineering/graph_metrics.py`)
- Purpose: Extracts topological features from Neo4j for ML models.
- Cypher Query in lines 40–48:
  ```cypher
  MATCH (c:Country {iso3: $iso3})
  OPTIONAL MATCH (c)-[e:EXPORTS_TO]->(p1:Country)
  OPTIONAL MATCH (p2:Country)-[i:EXPORTS_TO]->(c)
  RETURN 
      c.pagerank AS pagerank, 
      c.betweenness AS betweenness,
      count(DISTINCT p2) AS in_degree,
      count(DISTINCT p1) AS out_degree
  ```
- **Audit Finding:**
  Nodes in `seed_neo4j_trade.py` do NOT have `pagerank` or `betweenness` properties. `record.get("pagerank")` is always `None`, so the code silently defaults to hardcoded fallback numbers:
  - `graph_pagerank_influence = 0.045`
  - `graph_betweenness_centrality = 0.12`
  - `graph_import_hhi_concentration = 0.28`
  - `graph_systemic_vulnerability_ratio = 0.35`
  No real graph topology is fed into the ML models.

---

## 3. Database Layer & Storage Architecture

### 3.1 PostgreSQL Analysis
- Models in `apps/api/app/models/`:
  - `country.py`: Defines `Country`, `CountryMetadata`, and `HistoricalIndicator`.
  - `scenario.py`: Defines scenarios, versions, and events.
  - `simulation.py`: Defines runs, logs, and snapshots.
  - `ai.py`: Defines AI logs, policy recommendations, and models.
- **Finding:** **ZERO trade tables exist in PostgreSQL.**
- Migration `b2c3d4e5f6a7_add_trade_indexes.py` claiming to add "trade network query access patterns" only created indexes on `scenarios`, `scenario_versions`, and `scenario_events`.

### 3.2 Neo4j Analysis
- Session manager in `apps/api/app/neo4j/session.py`.
- Driver initialization does not establish a persistent connection; connections are acquired lazily on `session()`.
- Index initialized:
  ```cypher
  CREATE INDEX country_iso3_idx IF NOT EXISTS FOR (c:Country) ON (c.iso3)
  ```
- **Finding:**
  Indexes on `EXPORTS_TO(year)` and `EXPORTS_TO(commodity_id)` are **MISSING**, which will cause full graph scans once time-series trade flows are loaded.
