# Trade Network Feature Completion Matrix

**Project:** EconoSphere AI  
**Audit Phase:** Pre-Phase 22  
**Audit Date:** October 15, 2026  

---

## 1. Frontend Trade Network Feature Matrix (Features A through Q)

| ID | Feature | Implementation Status | Data Source Type | Codebase Evidence | Problems Discovered | Required Action for Phase 22 |
|---|---|---|---|---|---|---|
| **A** | **Trade network graph rendering** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `apps/web/src/components/charts/TradeGraph.tsx` (lines 16-202) | Graph renders via `react-cytoscapejs`, but physics layout (`cose`) re-randomizes on every state change; canvas does not persist position; edges default to 0.1 opacity. | Fix inverted edge dimming logic; stabilize layout with deterministic node positions; add layout caching. |
| **B** | **Country nodes** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `apps/api/scripts/seed_neo4j_trade.py` (lines 15-26); `TradeGraph.tsx` (lines 84-89) | Only 10 sovereign nations exist in synthetic seed data; node IDs use Neo4j internal element IDs rather than ISO3 codes. | Expand to all recognized sovereign economies; standardize primary node ID to ISO3. |
| **C** | **Country-to-country trade edges** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `apps/api/scripts/seed_neo4j_trade.py` (lines 91-115); `TradeGraph.tsx` (lines 127-133) | 178 synthetic `EXPORTS_TO` edges randomly sampled with uniform random volumes; no empirical basis. | Replace synthetic edges with real observed bilateral trade flows. |
| **D** | **Imports & exports representation** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `apps/web/src/app/dashboard/trade/network/page.tsx` (lines 61-63); `seed_neo4j_trade.py` (lines 105-111) | Only `EXPORTS_TO` directional edges are created in Neo4j; `IMPORTS_FROM` is inferred solely as reverse traversal in UI sidebar without distinct styling or edge filtering. | Provide explicit toggle for Imports vs. Exports; render directed edge arrows indicating flow direction. |
| **E** | **Edge thickness / weight by volume** | NOT IMPLEMENTED (BROKEN) | HARDCODED STATIC DATA | `TradeGraph.tsx` (lines 111-126) | All edges are styled with hardcoded static `'width': 2`; trade volume property is completely ignored in edge CSS stylesheet. | Implement dynamic edge width interpolation based on normalized log(tradeVolume). |
| **F** | **Country selection** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `TradeGraph.tsx` (lines 185-191); `TradeNetworkPage.tsx` (lines 52-67, 207-268) | Tapping node on Cytoscape canvas works, but clicking an influencer country in the right sidebar (`Top Network Influencers`) fails completely due to ID mismatch (`n.id === country.id`). | Fix node ID mapping so sidebar influencer click selects and focuses corresponding graph node. |
| **G** | **Country search** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `TradeNetworkPage.tsx` (lines 100-117); `TradeGraph.tsx` (lines 27-29) | Text input filters node labels by substring, dimming non-matching nodes, but re-renders entire graph layout on each keystroke and lacks dropdown autocomplete. | Debounce search input; add dropdown search autocomplete; zoom camera to matched node instead of re-running layout. |
| **H** | **Filters (Country, Region, Year, Trade Type)** | BROKEN / PLACEHOLDER | SYNTHETIC / MOCK / HARDCODED | `TradeNetworkPage.tsx` (lines 120-158, 345-358) | "Commodity" button filters for non-existent nodes (0 commodity nodes exist); Region filter is completely missing; Trade Type filter is missing; Timeline slider is purely visual cosmetic state. | Implement real Year filter that queries historical edges; add Region multi-select; add Trade Direction filter; fix Category filter. |
| **I** | **Zoom, pan, hover, graph interactions** | IMPLEMENTED BUT UNVERIFIED IN BROWSER | NOT APPLICABLE | `TradeGraph.tsx` (lines 169-200) | Cytoscape built-in zoom/pan enabled via `wheelSensitivity: 0.2`; however, hover tooltips for edges and nodes are missing; layout runs synchronously on UI thread. | Add hover tooltips showing bilateral volume, commodity, and trade share; add Zoom To Fit and Reset View buttons. |
| **J** | **Trade dependency indicators** | BROKEN / FALLBACK | FALLBACK DATA / SYNTHETIC | `TradeNetworkPage.tsx` (lines 48, 237-241) | UI averages random `risk` property or falls back to static `'28%'` / `'Low'`; edge `dependencyScore` is present in synthetic graph but ignored in partner list UI. | Calculate true empirical bilateral trade dependency (Bilateral Trade / Sovereign GDP); display Herfindahl-Hirschman Index (HHI). |
| **K** | **Top trading partners** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `TradeNetworkPage.tsx` (lines 51-67, 252-265) | Lists connected partners on selected node, but volume is displayed as `$427037B` due to arbitrary unit concatenation; partners are unranked and unsorted. | Sort partners by descending trade volume; format currency dynamically ($B / $M); compute trade share percentage. |
| **L** | **Trade balance indicators** | MISSING | NOT APPLICABLE | None (absent from codebase) | Zero UI components, calculations, or models exist for net trade balance (Exports minus Imports). | Add bilateral and aggregate Trade Balance KPI card and indicator badge (Surplus / Deficit). |
| **M** | **Graph legends and labels** | IMPLEMENTED | HARDCODED STATIC DATA | `TradeGraph.tsx` (lines 153-167) | Static legend card displays Country (Green), Commodity (Yellow), Economic Bloc (Purple); edge labels display type. | Ensure legend dynamically reflects only categories present in the active dataset; add edge legend. |
| **N** | **Loading, empty, and error states** | FULLY IMPLEMENTED | NOT APPLICABLE | `TradeNetworkPage.tsx` (lines 166-191); `network.test.tsx` (lines 8-47) | Spinner overlay during fetch, `ErrorState` with retry button on network failure, `EmptyState` when nodes array is empty. Verified in Vitest. | Reusable as-is; add offline cached state notice. |
| **O** | **Responsive layout** | FULLY IMPLEMENTED | NOT APPLICABLE | `TradeNetworkPage.tsx` (lines 96-361) | Flexbox column with header, resizable canvas, fixed sidebar, and footer slider. | Reusable as-is; ensure mobile collapsible drawer for sidebar. |
| **P** | **Connection to backend APIs** | PARTIALLY IMPLEMENTED | SYNTHETIC / MOCK | `apps/web/src/hooks/useGraph.ts` (lines 51-71) | Connects to `/api/v1/graph/network` and `/api/v1/graph/centrality`. Disconnected from `/api/v1/graph/neighbors` and `/api/v1/graph/path`. | Wire up neighbor and pathfinding APIs into interactive UI panels. |
| **Q** | **Handling large graphs without freezing** | BROKEN / UNTESTED | NOT APPLICABLE | `apps/api/app/repositories/graph.py` (line 86); `TradeGraph.tsx` (lines 173-179) | Backend hardcodes `LIMIT 500` cutting off arbitrary edges; frontend runs CPU-heavy `cose` layout synchronously on main thread, risking UI freeze on >100 nodes. | Move layout computation to Web Worker or precompute coordinates; implement server-side graph thresholding. |

---

## 2. Backend Trade Network API Matrix

| Route | HTTP Method | Implementation Status | Handler & Service | Data Source | Database Dependency | Frontend Integration | Issues |
|---|---|---|---|---|---|---|---|
| `/api/v1/graph/network` | GET | PARTIALLY IMPLEMENTED | `graph.py` -> `GraphService.get_network` -> `GraphRepository.get_network` | Neo4j Cypher `MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 500` | Neo4j (Offline = HTTP 500) | YES (`useGlobalNetwork`) | No error recovery; returns internal database element IDs instead of ISO3; hardcoded limit 500. |
| `/api/v1/graph/centrality` | GET | PARTIALLY IMPLEMENTED | `graph.py` -> `GraphService.get_centrality` -> `GraphRepository.get_centrality` | Neo4j Cypher `MATCH (n) OPTIONAL MATCH (n)-[r]->() RETURN n.iso3, count(r)` | Neo4j (Offline = HTTP 500) | YES (`useCentrality`) | Returns ISO3 while `/network` returns element IDs, breaking frontend entity resolution. Uses out-degree proxy rather than eigenvector or PageRank centrality. |
| `/api/v1/graph/neighbors/{node_id}` | GET | IMPLEMENTED BUT UNCONNECTED | `graph.py` -> `GraphService.get_neighbors` -> `GraphRepository.get_neighbors` | Neo4j Cypher `MATCH p=(n)-[*1..{depth}]-(m) WHERE n.iso3=$node_id OR n.id=$node_id` | Neo4j (Offline = HTTP 500) | NO (Disconnected) | Not exposed in `useGraph.ts`; frontend never calls this endpoint. |
| `/api/v1/graph/path` | GET | IMPLEMENTED BUT UNCONNECTED | `graph.py` -> `GraphService.get_shortest_path` -> `GraphRepository.get_shortest_path` | Neo4j Cypher `MATCH p=shortestPath((n)-[*]-(m))` | Neo4j (Offline = HTTP 500) | NO (Disconnected) | Not exposed in `useGraph.ts`; frontend never calls this endpoint. |

---

## 3. Data Pipeline & Storage Matrix

| Pipeline Component | Status | Source Location | Target Location | Data Integrity | Problems Discovered |
|---|---|---|---|---|---|
| **UN Comtrade Downloader** | PROTOTYPE ONLY | `https://comtradeapi.un.org/public/v1/preview/C/A/HS` | `apps/api/ml/scripts/download/download_trade.py` | UNVERIFIED | Never executed into automated pipeline; output directory `datasets/raw` does not exist; no files downloaded in `data/raw`. |
| **Neo4j Trade Seeder** | SYNTHETIC ONLY | Hardcoded Python lists + `random.uniform` | `apps/api/scripts/seed_neo4j_trade.py` | 100% FABRICATED | Seeds only 10 countries with random volumes and random risks; not executed in automated CI/CD. |
| **PostgreSQL Trade Storage** | MISSING | N/A | PostgreSQL tables | MISSING | Migration `b2c3d4e5f6a7` added indexes only for scenarios. No trade flow table exists in relational database. |
| **World Bank Master Panel** | REAL MACRO DATA | World Bank API | `data/raw/master_panel.csv` | VERIFIED REAL (Country Macro) | Contains aggregate `exports_pct_gdp` and `imports_pct_gdp`, but ZERO bilateral partner flows. |
