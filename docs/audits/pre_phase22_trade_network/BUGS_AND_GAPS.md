# Trade Network Bugs, Architectural Gaps, and Defect Register

**Audit Target:** Full-Stack Codebase (`apps/web`, `apps/api`, `data`, `scripts`)  
**Audit Scope:** Prioritized Defect Register (P0 through P3)  
**Date:** October 15, 2026  

---

## 1. Defect Classification Scheme

- **P0 — Critical:** Data integrity violations, deceptive fabricated data presented as real, destructive behavior, service crashes, unhandled fatal exceptions.
- **P1 — High:** Main trade-network functionality broken, essential APIs disconnected, graph unavailable, materially incorrect calculations, broken user interactions.
- **P2 — Medium:** Incomplete filtering, limited interactions, missing error handling, performance concerns, unparameterized endpoints.
- **P3 — Low:** Styling, cosmetic labels, minor usability improvements, documentation inaccuracies.

---

## 2. Prioritized Defect Register

### Issue TN-01: Fabricated Synthetic Bilateral Trade Data Presented as Real World Metrics
- **Severity:** **P0 — Critical**
- **Evidence:** `apps/api/scripts/seed_neo4j_trade.py` (lines 53–115); `apps/web/src/app/dashboard/trade/network/page.tsx` (lines 47–48)
- **User-Visible Impact:** Users and policymakers are presented with trade statistics (`$14.2T (Est)`, `Avg Supply Risk: 28%`, sovereign export routes) that are 100% fabricated by random number generators (`random.uniform`).
- **Root Cause:** Bilateral trade ingestion from UN Comtrade or World Bank was never completed or executed. `seed_neo4j_trade.py` was used as a development mock but left as the sole data provider.
- **Recommended Fix:** Implement an automated, credential-free ETL pipeline harvesting real-world bilateral trade data (e.g. UN Comtrade public API or World Bank WITS / CEPII BACI datasets).
- **Dependencies:** None.
- **Estimated Effort:** **L (Large)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-02: Unhandled Fatal Exception on Neo4j Outage Crashing Graph APIs
- **Severity:** **P0 — Critical**
- **Evidence:** `apps/api/app/repositories/graph.py` (lines 15–16); `apps/api/app/main.py` (lines 70–83)
- **User-Visible Impact:** When Neo4j is offline, entering the Trade Network dashboard triggers an HTTP 500 error and locks the user out with an error banner.
- **Root Cause:** `GraphRepository.run_query()` does not catch `neo4j.exceptions.ServiceUnavailable` or connection errors; exceptions bubble to FastAPI global handler.
- **Recommended Fix:** Implement a try/except block in `GraphRepository` with an automated fallback to a cached JSON artifact or PostgreSQL trade table.
- **Dependencies:** PostgreSQL trade table implementation (TN-05).
- **Estimated Effort:** **M (Medium)**
- **Confidence Level:** **100% Confirmed (Observed in Runtime Execution)**

---

### Issue TN-03: Identifier Disconnect (Neo4j Element ID vs Sovereign ISO3) Breaking Node Selection
- **Severity:** **P1 — High**
- **Evidence:** `apps/api/app/repositories/graph.py` (line 21); `apps/api/app/repositories/graph.py` (line 114); `apps/web/src/app/dashboard/trade/network/page.tsx` (lines 75, 309)
- **User-Visible Impact:** Clicking on any country in the "Top Network Influencers" sidebar fails completely; the node is never selected or inspected.
- **Root Cause:** `GraphRepository.get_network()` maps `node.id = str(value.element_id)` (e.g. `"4:624f21a6-..."`), while `get_centrality()` returns `node_id = n.iso3` (`"USA"`). The frontend matches `n.id === country.id`, which always evaluates to `false`.
- **Recommended Fix:** Change `GraphRepository` to set `node.id = value.get("iso3", str(value.element_id))` so sovereign ISO3 codes serve as the primary graph node ID.
- **Dependencies:** None.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-04: Inverted Boolean Edge Dimming Logic Rendering All Edges Nearly Invisible
- **Severity:** **P1 — High**
- **Evidence:** `apps/web/src/components/charts/TradeGraph.tsx` (line 47, lines 143–147)
- **User-Visible Impact:** When the dashboard loads, all trade routes in the network are rendered at `opacity: 0.1` (faint and nearly invisible) rather than normal brightness.
- **Root Cause:** Line 47 defines: `const edgeDimmed = !hasActiveFilter || (!visibleNodeIds.has(...) ...);`. When no filter is active, `!hasActiveFilter` is `true`, forcing all edges into the dimmed state.
- **Recommended Fix:** Change to:
  ```typescript
  const edgeDimmed = hasActiveFilter && (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target));
  ```
- **Dependencies:** None.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-05: Total Absence of Trade Tables in PostgreSQL Database
- **Severity:** **P1 — High**
- **Evidence:** `apps/api/app/models/country.py`; `apps/api/migrations/versions/b2c3d4e5f6a7_add_trade_indexes.py`
- **User-Visible Impact:** If Neo4j data is lost or corrupted, all trade history is permanently lost. Relational queries joining GDP with bilateral trade are impossible.
- **Root Cause:** Migration `b2c3d4e5f6a7` only added indexes for scenarios; no `trade_flows` table was created.
- **Recommended Fix:** Create an Alembic migration and SQLAlchemy model `TradeFlow` (`source_iso3`, `target_iso3`, `year`, `commodity_code`, `trade_value_usd`, `tariff_rate`).
- **Dependencies:** None.
- **Estimated Effort:** **M (Medium)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-06: Non-Functional Cosmetic Historical Timeline Replay Slider
- **Severity:** **P1 — High**
- **Evidence:** `apps/web/src/app/dashboard/trade/network/page.tsx` (lines 18, 340–358)
- **User-Visible Impact:** Moving the historical simulation slider (2015–2025) changes the displayed year number, but the graph does not update at all.
- **Root Cause:** `timelineYear` state is purely cosmetic and never passed to `useGlobalNetwork()` or `<TradeGraph>`.
- **Recommended Fix:** Pass `year` to `useGlobalNetwork(timelineYear)` and update the backend Cypher query to filter `WHERE r.year = $year`.
- **Dependencies:** Real time-series trade dataset.
- **Estimated Effort:** **M (Medium)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-07: Hardcoded Edge Thickness Disregarding Trade Volume
- **Severity:** **P2 — Medium**
- **Evidence:** `apps/web/src/components/charts/TradeGraph.tsx` (lines 111–126)
- **User-Visible Impact:** A minor $10M trade flow looks identical in visual weight to a $500B bilateral flow.
- **Root Cause:** Cytoscape edge stylesheet hardcodes `'width': 2`.
- **Recommended Fix:** Implement Cytoscape dynamic styling:
  ```typescript
  'width': 'mapData(tradeVolume, 10000, 500000, 1.5, 8.0)'
  ```
- **Dependencies:** None.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-08: Disconnected Backend Graph Endpoints (`/neighbors`, `/path`)
- **Severity:** **P2 — Medium**
- **Evidence:** `apps/api/app/api/v1/endpoints/graph.py` (lines 13–21); `apps/web/src/hooks/useGraph.ts`
- **User-Visible Impact:** Advanced network features (depth traversal, supply chain shortest path finding) are inaccessible to users.
- **Root Cause:** Frontend engineers never implemented React Query hooks or UI controls to invoke these endpoints.
- **Recommended Fix:** Add `useGraphNeighbors(nodeId, depth)` and `useShortestPath(source, target)` in `useGraph.ts`, and add an interactive Pathfinding modal to the dashboard.
- **Dependencies:** Node ID alignment (TN-03).
- **Estimated Effort:** **M (Medium)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-09: Cytoscape Main-Thread Layout Recalculation & Instability
- **Severity:** **P2 — Medium**
- **Evidence:** `apps/web/src/components/charts/TradeGraph.tsx` (lines 173–179)
- **User-Visible Impact:** The entire network layout reshuffles randomly whenever the user filters or searches, causing visual disorientation and potential frame drops.
- **Root Cause:** Setting `randomize: true` on the `cose` layout algorithm forces a fresh random simulation on every element array re-creation.
- **Recommended Fix:** Cache calculated node positions (`x, y`) or use a deterministic circular/concentric layout, switching layout to `preset` once initial layout completes.
- **Dependencies:** None.
- **Estimated Effort:** **M (Medium)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-10: Phantom "Commodity" Filter Button with Zero Commodity Nodes
- **Severity:** **P2 — Medium**
- **Evidence:** `apps/web/src/app/dashboard/trade/network/page.tsx` (lines 121–129)
- **User-Visible Impact:** Clicking "Commodity" empties the entire graph canvas.
- **Root Cause:** The database only seeds `Country` and `EconomicBloc` nodes. Zero `Commodity` nodes exist in the graph.
- **Recommended Fix:** Either seed distinct `Commodity` nodes in the knowledge graph, or redesign the button to filter edge commodity tags (e.g. Energy, Agriculture, Technology).
- **Dependencies:** Dataset design.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-11: Arbitrary Currency and Unit String Concatenation
- **Severity:** **P3 — Low**
- **Evidence:** `apps/web/src/app/dashboard/trade/network/page.tsx` (line 261)
- **User-Visible Impact:** Partner trade volume renders as `$427037.17718389636B` in the sidebar partner list.
- **Root Cause:** Code directly concatenates `$`, unrounded float, and `B` without checking order of magnitude.
- **Recommended Fix:** Use standard currency formatter: `formatTradeCurrency(link.volume)`.
- **Dependencies:** None.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**

---

### Issue TN-12: Missing Trade Balance Indicators (Surplus / Deficit)
- **Severity:** **P3 — Low**
- **Evidence:** `apps/web/src/app/dashboard/trade/network/page.tsx`
- **User-Visible Impact:** Users cannot see whether a country is running a net trade surplus or deficit.
- **Root Cause:** Feature was planned in requirements but never implemented in UI or backend.
- **Recommended Fix:** Add bilateral and total Net Trade Balance metric card: `Net Balance = Exports - Imports`.
- **Dependencies:** Bilateral dataset.
- **Estimated Effort:** **S (Small)**
- **Confidence Level:** **100% Confirmed**
