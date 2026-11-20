# Phase 22 Governance Decision Record

**Project:** EconoSphere AI — Global Economic Crisis Simulator & Decision Intelligence Platform  
**Document:** `PHASE22_GOVERNANCE_DECISION.md`  
**Phase:** Phase 22 — Full Trade Network Integration  
**Decision Record Status:** `AWAITING_PRODUCTION_AUTHORIZATION`  
**Date:** November 18, 2026  
**Author:** Principal Software Architect & Data Governance Lead  

---

## 1. Purpose

This document is the formal governance decision record for Phase 22. It records all decisions taken during this phase, the rationale behind each, and the outstanding authorization gate that must be cleared before any production database change is executed.

---

## 2. Decisions Taken During Phase 22

### Decision 1: Use UN Comtrade Public Preview as Primary Data Source

**Decision:** The EconoSphere AI trade network will be populated exclusively from empirical UN Comtrade bilateral trade observations downloaded via the public preview API endpoint.

**Rationale:** The public preview endpoint provides authentic, government-reported bilateral merchandise trade flows for calendar year 2022, with no fabrication or interpolation. Data limitations imposed by the endpoint (500-record ceiling, preview tier exclusions) are documented explicitly and surfaced to users through interface disclosures.

**Alternatives Considered:**
- **Synthetic data generation:** Rejected. Fabricated data produces misleading economic signals and violates scientific integrity standards.
- **World Bank API:** Considered as supplementary source. Deferred to Phase 23 to avoid mixing valuation methodologies without explicit harmonization documentation.

**Status:** **ENACTED**

---

### Decision 2: Isolate All Development and Testing from Production Database

**Decision:** The active production database `econosphere` will not receive any schema migrations or data inserts during Phase 22 development. All work is performed exclusively against the isolated database `econosphere_migration_test`.

**Rationale:** The active database serves ongoing model inference pipelines. Any accidental schema change or data contamination would disrupt production operations. The fail-closed guard in `ingest_trade_flows_db.py` prevents accidental execution against `econosphere`.

**Status:** **ENACTED AND VERIFIED** — Active DB confirmed at revision `89c84394de95`, 10 tables, `trade_flows` absent (live check: November 18, 2026).

---

### Decision 3: Preserve Valuation Asymmetry Without Mirror Harmonization

**Decision:** FOB (exporter) and CIF (importer) bilateral declarations are preserved as independent empirical observations. No artificial averaging, mirror harmonization, or weighting factor is applied to reconcile asymmetries.

**Rationale:** The difference between a country's reported exports to a partner (FOB) and that partner's reported imports from the first country (CIF) reflects real economic variables: shipping costs, insurance, timing differences, and re-exports. Artificial harmonization would suppress this information and introduce pseudo-data.

**Example:** USA reported imports from CHN at \$575.69B (CIF); CHN reported exports to USA at \$582.76B (FOB). The \$7.07B asymmetry is preserved as a valid observable.

**Status:** **ENACTED**

---

### Decision 4: Preserve Missing Data as NULL, Never Convert to Zero

**Decision:** Bilateral trade corridors for which no observation exists in the UN Comtrade preview dataset are stored as `NULL` in the relational schema and absent from the Neo4j graph. They are never fabricated as zero.

**Rationale:** A "zero trade" observation (\$0.00) is empirically meaningful (declared absence of trade). An unobserved corridor (`NULL`) means "we do not know." Conflating these two distinct states would introduce systematic positive bias in trade concentration metrics.

**Status:** **ENACTED AND TESTED** (automated distinction test: `test_zero_vs_missing_trade_flow_distinction`)

---

### Decision 5: Label All Metrics as Sample Observations

**Decision:** Every consumer-facing metric (API response, dashboard KPI card, corridor inspector) must carry explicit metadata declaring: (a) data source, (b) reporting year, and (c) `is_complete_national_census: false`.

**Rationale:** The UN Comtrade public preview dataset covers 15 reporting economies and is capped at 500 records per reporter. It is statistically and legally inaccurate to present derived metrics as exhaustive national trade accounts.

**Status:** **ENACTED**

---

## 3. The Production Authorization Gate

**THIS IS AN ACTIVE STOP CONDITION.**

Phase 22 development and testing are complete. The following production operations are **pending explicit human authorization** and must NOT be executed autonomously:

### Pending Action 1: Production Schema Migration
```bash
# REQUIRES EXPLICIT AUTHORIZATION BEFORE EXECUTION
alembic -c apps/api/alembic.ini upgrade head  # on 'econosphere' database
```
- **Effect:** Creates `trade_flows` table in active `econosphere` database.
- **Reversibility:** Fully reversible via `alembic downgrade -1` (migration has verified downgrade path).

### Pending Action 2: Production Data Ingestion
```bash
# REQUIRES EXPLICIT AUTHORIZATION BEFORE EXECUTION
python apps/api/scripts/ingest_trade_flows_db.py --db-name econosphere
```
- **Effect:** Inserts 6,576 verified UN Comtrade records into production `trade_flows` table.
- **Reversibility:** Idempotent (can be re-run); reversible by truncating `trade_flows`.

### Pending Action 3: Production Neo4j Seeding
```bash
# REQUIRES EXPLICIT AUTHORIZATION BEFORE EXECUTION
python apps/api/scripts/seed_neo4j_trade.py  # against production Neo4j instance
```
- **Effect:** Seeds 239 Country nodes and 5,543 EXPORTS_TO edges into the production Neo4j graph.
- **Reversibility:** Fully reversible by dropping `:Country` nodes and `:EXPORTS_TO` relationships.

---

## 4. Authorization Requirements

To authorize production deployment, the responsible party must explicitly confirm:
1. Active database `econosphere` migration is authorized.
2. Data ingestion from `staged_trade_observations_2022.csv` is authorized.
3. Neo4j seeding against production graph is authorized.
4. The partial coverage nature of the dataset (preview sample, not complete census) is acknowledged.

**Current Authorization Status:** **PENDING — Awaiting Explicit Human Authorization**

---

## 5. Governance Classification

| Criterion | Assessment |
|---|---|
| Data authenticity | Verified empirical (UN Comtrade 2022) |
| Synthetic data present | None |
| Protected artifacts modified | None |
| Production database touched | No |
| All 85 tests passing | Yes (100%) |
| All 16 governance reports complete | Yes |
| Production deployment authorized | **NO — Pending** |

**Decision Record Status:** `AWAITING_PRODUCTION_AUTHORIZATION`
