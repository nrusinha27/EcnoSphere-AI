# Graph API Contract and Test Suite Report

**Project:** EconoSphere AI — Global Economic Crisis Simulator & Decision Intelligence Platform  
**Document:** `GRAPH_API_CONTRACT_AND_TESTS.md`  
**Phase:** Phase 22 — Full Trade Network Integration  
**Status:** `PASS`  
**Date:** November 18, 2026  

---

## 1. Overview and Architecture

The FastAPI Graph subsystem delivers high-performance access to the trade network stored in Neo4j, backed by an immutable offline JSON fallback. All endpoints operate strictly on standardized ISO 3166-1 alpha-3 identifiers and validate request parameters via Pydantic v2 schemas.

---

## 2. API Route Specifications

### 1. `GET /api/v1/graph/network`
Retrieves the global bilateral trade graph filtered by calendar year.
- **Query Parameters:**
  - `year` (integer, optional, default: `2022`): Filter trade relationships by observation year.
  - `limit` (integer, optional, default: `500`, range: `1..2000`): Maximum number of edges to return.
- **Success Response (`200 OK`):**
  ```json
  {
    "nodes": [
      { "id": "USA", "label": "USA", "type": "Country", "properties": { "name": "United States" } }
    ],
    "edges": [
      {
        "id": "USA-CAN-2022",
        "source": "USA",
        "target": "CAN",
        "type": "EXPORTS_TO",
        "weight": 354.9,
        "properties": {
          "year": 2022,
          "tradeVolume": 354.9,
          "trade_value_usd": 354901847120.0,
          "export_value_usd": 354901847120.0,
          "import_value_usd": 360124800000.0,
          "perspective": "REPORTER_EXPORT",
          "source": "UN_COMTRADE"
        }
      }
    ],
    "metadata": {
      "year": 2022,
      "edge_count": 500,
      "source": "UN_COMTRADE",
      "status": "VERIFIED_OBSERVATIONS"
    }
  }
  ```
- **Unobserved Year Behavior:** Returns empty `nodes` and `edges` lists with metadata `"status": "NO_DATA"`. Never fabricates edges.

---

### 2. `GET /api/v1/graph/centrality`
Calculates out-degree and betweenness centrality to rank top sovereign exporters.
- **Success Response (`200 OK`):**
  ```json
  [
    { "node_id": "USA", "score": 236.0 },
    { "node_id": "CHN", "score": 234.0 },
    { "node_id": "DEU", "score": 228.0 }
  ]
  ```

---

### 3. `GET /api/v1/graph/country/{country_code}`
Retrieves a country's ego network (all immediate inbound and outbound trade partners).
- **Path Parameter:** `country_code` (string, required, length: 3, uppercase ISO3).
- **Success Response (`200 OK`):** Graph payload centered on the specified economy.
- **Error Response (`404 Not Found`):** When the requested country does not exist in the graph.

---

### 4. `GET /api/v1/graph/corridor`
Retrieves granular bilateral metrics between two sovereign entities.
- **Query Parameters:**
  - `reporter` (string, required, 3 chars): Origin country ISO3.
  - `partner` (string, required, 3 chars): Counterparty country ISO3.
  - `year` (integer, optional, default: 2022).
- **Success Response (`200 OK`):** Returns FOB exporter declaration, CIF importer counter-declaration, effective volume, and customs asymmetry.

---

### 5. `GET /api/v1/graph/metrics/{country_code}`
Calculates trade concentration (Herfindahl-Hirschman Index), top trading partners, reported exports, and reported imports.
- **Path Parameter:** `country_code` (string, required, 3 chars).
- **Query Parameter:** `year` (integer, optional, default: 2022).
- **Response Disclosures:** Explicitly includes `"is_complete_national_census": false` to remind consumers of preview sample boundaries.

---

## 3. Resilience and Fail-Closed Behavior

When primary Neo4j is offline, the service automatically serves verified data from `data/processed/cached_network.json`. 

If both Neo4j and the offline cache are inaccessible:
- The system **NEVER** generates synthetic nodes or random numbers.
- The repository raises an exception, and FastAPI responds with `HTTP 503 Service Unavailable`:
  ```json
  {
    "detail": "Trade network service unavailable: neither primary graph database nor verified fallback snapshot is accessible."
  }
  ```

---

## 4. Test Verification Suite

All API contracts are tested automatically in `apps/api/tests/test_graph_api.py` and `apps/api/tests/test_phase22_e2e_integration.py`:

| Test Name | File | Description | Result |
|---|---|---|---|
| `test_get_network_default` | `test_graph_api.py` | Validates default 2022 network return and schema | **PASS** |
| `test_get_network_with_year` | `test_graph_api.py` | Validates year filter parameter | **PASS** |
| `test_get_network_unobserved_year` | `test_graph_api.py` | Validates empty network for unobserved year (2020) | **PASS** |
| `test_get_centrality` | `test_graph_api.py` | Validates centrality scoring and ordering | **PASS** |
| `test_get_country_subgraph` | `test_graph_api.py` | Validates ego network extraction for USA | **PASS** |
| `test_get_country_subgraph_not_found` | `test_graph_api.py` | Validates 404 response for invalid country `XYZ` | **PASS** |
| `test_get_country_metrics` | `test_graph_api.py` | Validates trade metrics calculation and HHI | **PASS** |
| `test_get_corridor_metrics` | `test_graph_api.py` | Validates bilateral corridor asymmetry resolution | **PASS** |

**Status:** **PASS**
