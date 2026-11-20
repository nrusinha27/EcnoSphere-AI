# Trade Data Dictionary: Schema and Graph Model

**Project:** EconoSphere AI — Global Economic Crisis Simulator & Decision Intelligence Platform  
**Document:** `TRADE_DATA_DICTIONARY.md`  
**Phase:** Phase 22 — Full Trade Network Integration  
**Status:** `PASS`  
**Date:** November 18, 2026  

---

## 1. Relational Schema: PostgreSQL `trade_flows` Table

The PostgreSQL relational storage model enforces strict decimal precision, ISO3 sovereign entity references, and non-synthetic data constraints.

### Table Definition: `trade_flows`

| Column Name | Data Type | Nullable | Default | Description / Business Rules |
|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Primary surrogate key. |
| `reporter_iso3` | `VARCHAR(3)` | No | None | ISO 3166-1 alpha-3 code of declaring economy. |
| `partner_iso3` | `VARCHAR(3)` | No | None | ISO 3166-1 alpha-3 code of bilateral counterparty. |
| `year` | `INTEGER` | No | None | Calendar observation year (e.g. `2022`). |
| `flow_direction` | `VARCHAR(10)` | No | None | Flow direction from reporter: `'EXPORT'` or `'IMPORT'`. |
| `trade_value_usd` | `NUMERIC(28, 2)` | Yes | `NULL` | Empirical customs value in USD. Null indicates unobserved; `0.00` indicates verified zero trade. |
| `volume_usd` | `NUMERIC(28, 2)` | Yes | `NULL` | Backward-compatibility alias for `trade_value_usd`. |
| `net_weight_kg` | `NUMERIC(28, 2)` | Yes | `NULL` | Physical mass in kilograms where declared. |
| `commodity_scope` | `VARCHAR(50)` | No | `'TOTAL'` | Commodity classification aggregation scope (`'TOTAL'` = All HS codes). |
| `source` | `VARCHAR(50)` | No | `'UN_COMTRADE'` | Provenance source identifier. |
| `reporter_perspective` | `VARCHAR(10)` | No | `'REPORTER'` | Declaring point of view (`'REPORTER'` direct, or `'PARTNER'` mirror). |
| `dependency_score` | `NUMERIC(6, 4)` | Yes | `NULL` | Calculated economic trade dependency index $\in [0.0000, 1.0000]$. |
| `created_at` | `TIMESTAMPTZ` | No | `NOW()` | Record creation timestamp (UTC). |
| `updated_at` | `TIMESTAMPTZ` | No | `NOW()` | Record update timestamp (UTC). |

### Table Constraints

1. **Primary Unique Constraint (`uq_trade_flows_observation_key`):**
   ```sql
   UNIQUE (reporter_iso3, partner_iso3, year, flow_direction, commodity_scope)
   ```
   Enforces idempotency and guarantees zero duplicate observations per bilateral corridor per year.
2. **Flow Direction Check (`ck_trade_flows_flow_direction`):**
   ```sql
   CHECK (flow_direction IN ('EXPORT', 'IMPORT'))
   ```
3. **Perspective Check (`ck_trade_flows_reporter_perspective`):**
   ```sql
   CHECK (reporter_perspective IN ('REPORTER', 'PARTNER'))
   ```
4. **Self-Trade Prevention (`ck_trade_flows_no_self_trade`):**
   ```sql
   CHECK (reporter_iso3 <> partner_iso3)
   ```
5. **Dependency Score Range (`ck_trade_flows_dependency_score`):**
   ```sql
   CHECK (dependency_score >= 0.0 AND dependency_score <= 1.0)
   ```

### Indexes

- `ix_trade_flows_reporter_year`: `(reporter_iso3, year)`
- `ix_trade_flows_partner_year`: `(partner_iso3, year)`
- `ix_trade_flows_pair_year`: `(reporter_iso3, partner_iso3, year)`

---

## 2. Neo4j Property Graph Model

### Node: `(:Country)`

| Property | Type | Description |
|---|---|---|
| `iso3` | `STRING` | Standardized ISO 3166-1 alpha-3 code (e.g. `'USA'`, `'CHN'`). Primary graph identifier. |
| `name` | `STRING` | Official standard name of the sovereign entity. |

- **Graph Index:** `CREATE INDEX IF NOT EXISTS FOR (c:Country) ON (c.iso3)`

### Relationship: `(:Country)-[:EXPORTS_TO]->(:Country)`

Every directed `EXPORTS_TO` edge connects the exporting origin to the importing destination:

| Property | Type | Description |
|---|---|---|
| `year` | `INTEGER` | Calendar year of trade flow. |
| `tradeVolume` | `FLOAT` | Primary volume in Billions USD (used for Cytoscape edge-width visualization). |
| `trade_value_usd` | `FLOAT` | Exact trade value in USD. |
| `export_value_usd` | `FLOAT` | Direct exporter FOB declaration in USD where available. |
| `import_value_usd` | `FLOAT` | Importer CIF counter-declaration in USD where available. |
| `perspective` | `STRING` | Point of view (`'REPORTER_EXPORT'` or `'PARTNER_IMPORT_INFERRED'`). |
| `source` | `STRING` | Data provenance (`'UN_COMTRADE'`). |
| `commodity_scope` | `STRING` | Commodity scope (`'TOTAL'`). |

---

## 3. REST API Data Contracts (FastAPI Schemas)

### `TradeMetricsResponse`
```json
{
  "country_code": "USA",
  "year": 2022,
  "total_exports_usd": 2064521482810.0,
  "total_imports_usd": 3375948281920.0,
  "sample_net_balance_usd": -1311426799110.0,
  "observed_partner_count": 236,
  "hhi_export_concentration": 0.0842,
  "top_export_partners": [
    {
      "partner_iso3": "CAN",
      "partner_name": "Canada",
      "flow_direction": "EXPORT",
      "trade_value_usd": 354901847120.0,
      "share_of_total": 0.1719
    }
  ],
  "data_provenance": "UN_COMTRADE",
  "is_complete_national_census": false
}
```

### `CorridorMetricsResponse`
```json
{
  "reporter_iso3": "USA",
  "partner_iso3": "CHN",
  "year": 2022,
  "exporter_declaration_fob": null,
  "importer_declaration_cif": 575694595291.0,
  "effective_volume_usd": 575694595291.0,
  "asymmetry_usd": null,
  "data_provenance": "UN_COMTRADE"
}
```

---

## 4. Dictionary Governance Status

**Status:** **PASS**
