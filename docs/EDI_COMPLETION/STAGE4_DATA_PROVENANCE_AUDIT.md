# EconoSphere AI — Stage 4: Data Provenance & Macroeconomic Series Audit

**Status:** `STAGE4_AUDIT_COMPLETED_WITH_WARNINGS`  
**Milestone:** EDI Demonstration Fast-Track — Stage 4 (Reconciled Evidence Pass)  
**Date:** 2026-11-19  
**Audited Dataset:** `data/raw/master_panel.csv` (File size: 1,235,325 bytes; SHA-256: verified immutable)  
**Referenced Scripts & Audits:**
- `apps/api/ml/scripts/download/download_worldbank.py`
- `apps/api/ml/data_audit.py`
- `docs/phase11/dataset_quality_audit.md`
- `docs/audits/pre_phase22_trade_network/DATA_PROVENANCE_AND_MOCK_AUDIT.md`

---

## 1. Executive Summary & Audit Scope

This document provides a strict, evidence-based data provenance audit of `data/raw/master_panel.csv`, the central macroeconomic dataset used by:
1. **Stage 3 Multi-Country Comparison Dashboard** (`/dashboard/compare`) for 14 cross-country benchmarking metrics (2000–2025).
2. **Stage 2 Interactive GDP Forecasting** (`/dashboard/forecast`) for 2025 baseline feature defaults.

### Summary of Reconciled Findings
- **Raw Observations Not Retained:** Although download scripts exist (`download_worldbank.py`), original JSON response payloads with HTTP timestamp headers for all 235 countries are not preserved in the repository. The dataset was committed on August 3, 2026 as a pre-curated CSV artifact. Therefore, raw observation indicators cannot be classified as `VERIFIED`; they are conservatively classified as `PARTIALLY VERIFIED` where official WDI series mappings exist, or `UNVERIFIED` where definitions are ambiguous.
- **Panel Anomaly (Nauru / Naoero Duplicate Pairs):** The panel contains **6,136 rows**, but is **not strictly balanced on `country_code`**. Exactly 52 rows (26 pairs) represent duplicate `(country_code, year)` combinations exclusively for ISO-3 code `NRU` (26 rows under `Naoero` and 26 rows under `Nauru`). All other 234 country codes have exactly 26 annual observations (2000–2025).
- **Interest Rate Ambiguity:** `interest_rate_pct` is classified as `UNVERIFIED`. Legacy project audits documented it as `"Real interest rate or lending rate (%)"`, merging two economically distinct concepts (`FR.INR.LEND` vs `FR.INR.RINR`) without documented transformation code. In `comparison_service.py`, its display metadata has been updated to reflect unverified provenance.
- **Derived Trade Metrics Integrity:** Both `exports_pct_gdp` and `imports_pct_gdp` are measured in `% of GDP` on the exact same country-year row. Their derived combinations ($\text{Trade Balance} = X - M$ and $\text{Trade Openness} = X + M$) are mathematically valid, compatible, and preserve missing values as `null` without zero substitution.

---

## 2. Forensic Panel Structure & Duplicate Investigation

Direct programmatic audit of `data/raw/master_panel.csv` reveals the following exact metrics:

| Metric | Measured Value | Evidence / Finding |
| :--- | :--- | :--- |
| **Total Rows** | 6,136 | Exact row count of CSV excluding header. |
| **Total Columns** | 19 | 3 identifier columns (`country_code`, `country_name`, `year`) + 16 numeric features. |
| **Unique Country Codes** | 235 | 235 distinct ISO-3 alpha-3 identifiers. |
| **Unique Country Names** | 236 | Discrepancy: exactly 1 code maps to 2 distinct country names (`NRU`). |
| **Temporal Span** | 2000 – 2025 | Continuous 26-year range. |
| **Rows per Year** | 236 every year | Constant across all 26 years ($236 \times 26 = 6,136$). |
| **Duplicate `(country_code, year)` Pairs** | **52 rows (26 pairs)** | **All 52 duplicate rows belong to `country_code == 'NRU'`.** |
| **Duplicate `(country_name, year)` Pairs** | **0** | No duplicates exist when identifying by `country_name`. |

### 2.1 The Nauru / Naoero Partition Investigation
Investigation of `country_code == 'NRU'` shows why 52 rows exist for 26 years:
- **`country_name == 'Naoero'` (26 rows, 2000–2025):** Contains non-null observations for `tariff_rate_pct` (6 obs), `remittances_usd` (17 obs), `fdi_net_inflow_usd` (7 obs), `imports_pct_gdp` (18 obs), `tax_revenue_pct_gdp` (11 obs), `exports_pct_gdp` (18 obs), `population_total` (26 obs), and `current_account_pct_gdp` (17 obs). However, `gdp_growth_pct` and `gdp_current_usd` are completely missing (`NaN`).
- **`country_name == 'Nauru'` (26 rows, 2000–2025):** Contains non-null observations for `exchange_rate_lcu_usd` (26 obs), `gdp_growth_pct` (26 obs), `inflation_cpi_pct` (2 obs), and `gdp_current_usd` (26 obs). However, trade and fiscal metrics are completely missing (`NaN`).

**Root Cause:** When `master_panel.csv` was originally assembled, two independent data extracts using different country naming conventions ("Naoero", the indigenous Nauruan name, versus "Nauru", the standard English name) were concatenated instead of joined on `(country_code, year)`.

### 2.2 Balance Assessment & Safe Read-Only Handling
- **Assessment:** The raw CSV is **not balanced on country code** (234 countries have 26 observations, while NRU has 52).
- **Safe Read-Only Handling:** To preserve the raw immutable dataset while preventing duplicated or overwritten queries in the application, `apps/api/app/services/comparison_service.py` performs in-memory deduplication during load:
  ```python
  df_sorted = df.sort_values(["country_code", "year", "country_name"])
  df_unified = df_sorted.groupby(["country_code", "year"], as_index=False).first()
  df_unified.loc[df_unified["country_code"] == "NRU", "country_name"] = "Nauru"
  ```
  This unifies `Naoero`'s trade/tax columns and `Nauru`'s GDP/exchange rate columns without overwriting, yielding exactly **235 unique countries**, exactly **6,110 clean rows** ($235 \times 26$), and exactly 1 observation per country per year in memory.

---

## 3. Reconciled 14-Indicator Provenance Matrix

In accordance with strict evidence standards, provenance statuses are classified as follows:
- `VERIFIED`: Supported by retained, reproducible raw source evidence and download logs.
- `PARTIALLY VERIFIED`: Documented WDI indicator mapping is consistent with official definitions, but original raw API download payloads are not retained in the repository.
- `UNVERIFIED`: Source cannot be established or underlying definitions are ambiguous.
- `DERIVED`: Mathematically computed from compatible source variables on the same row.

| # | Indicator Name | Source Column | Official WDI Series Code | Definition & Source Description | Units | Reconciled Provenance Status | Missing Rows (%) | Missing-Data Treatment | Issues & Governance Notes |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :-: | :--- | :--- |
| **1** | Real GDP Growth Rate | `gdp_growth_pct` | `NY.GDP.MKTP.KD.ZG` | Annual percentage growth rate of GDP at market prices based on constant local currency. | `%` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 340 (5.5%) | Emitted as `null`; UI displays "Data unavailable". Never zeroed. | Core target variable for Phase 11 model. Highly complete across core economies. |
| **2** | Nominal GDP Level | `gdp_current_usd` | `NY.GDP.MKTP.CD` | Gross Domestic Product at purchaser's prices in current U.S. dollars. | `USD` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 266 (4.3%) | Emitted as `null`; UI displays "Data unavailable". | Formatted in UI as Trillions/Billions for readability. Direct WDI series. |
| **3** | CPI Inflation Rate | `inflation_cpi_pct` | `FP.CPI.TOTL.ZG` | Inflation as measured by consumer price index reflects annual % change in cost to average consumer. | `%` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 1,011 (16.5%) | Emitted as `null`; UI displays "Data unavailable". | Referenced in `download_worldbank.py`. Kept on dedicated chart to prevent unit confusion. |
| **4** | Unemployment Rate | `unemployment_pct` | `SL.UEM.TOTL.ZS` | Unemployment as share of total labor force (modeled ILO estimate). | `%` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 846 (13.8%) | Emitted as `null`; UI displays "Data unavailable". | Modeled ILO estimate from World Bank. Kept on independent chart to prevent unit confusion. |
| **5** | Central Government Debt | `govt_debt_pct_gdp` | `GC.DOD.TOTL.GD.ZS` | Central government gross debt as a percentage of GDP. | `% of GDP` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 4,907 (80.0%) | Emitted as `null`; UI displays "Data unavailable". | Severe missingness in WDI (only ~90 countries report). USA has 2024 data (115.77%), IND has 2018 (46.52%), CHN/DEU/JPN missing in WDI. UI correctly highlights "Data unavailable" instead of 0. |
| **6** | Tax Revenue | `tax_revenue_pct_gdp` | `GC.TAX.TOTL.GD.ZS` | Compulsory transfers to central government for public purposes (% of GDP). | `% of GDP` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 2,923 (47.6%) | Emitted as `null`; UI displays "Data unavailable". | 47.6% missingness globally. Observation year tracked individually per country. |
| **7** | Current Account Balance | `current_account_pct_gdp` | `BN.CAB.XOKA.GD.ZS` | Current account balance as a percentage of GDP. | `% of GDP` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 1,624 (26.5%) | Emitted as `null`; UI displays "Data unavailable". | Standard IMF/World Bank balance of payments metric. |
| **8** | Total Reserves | `reserves_usd` | `FI.RES.TOTL.CD` | Total reserves comprising foreign exchange, SDRs, and gold at year-end in current USD. | `USD` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 1,694 (27.6%) | Emitted as `null`; UI displays "Data unavailable". | Large values formatted with currency unit abbreviation. |
| **9** | Interest Rate | `interest_rate_pct` | *Ambiguous* | Legacy audit reports: `"Real interest rate or lending rate (%)"`. | `%` | **UNVERIFIED** (Source cannot be independently established from repository evidence) | 2,916 (47.5%) | Emitted as `null`; UI displays "Data unavailable". | Ambiguous series definition (`FR.INR.LEND` vs `FR.INR.RINR`). Missing for USA, IND, GBR. Labeled in UI as "Interest Rate" with unverified provenance note. |
| **10** | Foreign Direct Investment | `fdi_net_inflow_usd` | `BX.KLT.DINV.CD.WD` | Net inflows of investment to acquire lasting management interest in an enterprise. | `USD` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 720 (11.7%) | Emitted as `null`; UI displays "Data unavailable". | Can be negative when disinvestment exceeds inflows. |
| **11** | Exports of Goods & Services | `exports_pct_gdp` | `NE.EXP.GNFS.ZS` | Value of all goods and market services provided to rest of world (% of GDP). | `% of GDP` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 1,138 (18.5%) | Emitted as `null`; UI displays "Data unavailable". | Base component for derived trade balance and openness. |
| **12** | Imports of Goods & Services | `imports_pct_gdp` | `NE.IMP.GNFS.ZS` | Value of all goods and market services received from rest of world (% of GDP). | `% of GDP` | **PARTIALLY VERIFIED** (Source recorded in project metadata; raw ingestion payload not independently retained) | 1,135 (18.5%) | Emitted as `null`; UI displays "Data unavailable". | Base component for derived trade balance and openness. |
| **13** | Net Trade Balance | `trade_balance_pct_gdp` | *Derived* | Net trade: $\text{Exports (\% GDP)} - \text{Imports (\% GDP)}$. | `% of GDP` | **DERIVED** | 1,138 (18.5%) | Computed only when both exports and imports are present; otherwise `null`. | Mathematically valid difference of identical units (% of GDP) on identical row. |
| **14** | Trade Openness Index | `trade_openness_pct_gdp` | *Derived* | Trade exposure: $\text{Exports (\% GDP)} + \text{Imports (\% GDP)}$. | `% of GDP` | **DERIVED** | 1,138 (18.5%) | Computed only when both exports and imports are present; otherwise `null`. | Mathematically valid sum of identical units (% of GDP). Exceeding 100% is legitimate for transshipment hubs. |

---

## 4. Derived Trade Metrics Mathematical Verification

### 4.1 Underlying Variables Compatibility
- **`exports_pct_gdp`**: Defined as $\frac{\text{Exports of Goods \& Services}}{\text{Nominal GDP}} \times 100$.
- **`imports_pct_gdp`**: Defined as $\frac{\text{Imports of Goods \& Services}}{\text{Nominal GDP}} \times 100$.
- Both indicators share identical units (`% of GDP`), identical denominators (GDP in current LCU/USD), and identical temporal frequency (annual).

### 4.2 Mathematical Formulas & Null Propagation
1. **Trade Balance (% of GDP):**
   $$\text{Trade Balance} = \text{exports\_pct\_gdp}_{c, t} - \text{imports\_pct\_gdp}_{c, t}$$
   - When $\text{Exports} > \text{Imports}$, positive trade surplus (e.g. Germany: $+2.35\%$ of GDP in 2025).
   - When $\text{Exports} < \text{Imports}$, trade deficit (e.g. United States: $-3.07\%$ of GDP in 2024).
2. **Trade Openness Index (% of GDP):**
   $$\text{Trade Openness} = \text{exports\_pct\_gdp}_{c, t} + \text{imports\_pct\_gdp}_{c, t}$$
   - Measures total trade exposure relative to economic size. Values $>100\%$ are economically authentic for small open economies (e.g. Singapore, Hong Kong, Luxembourg).
3. **Null Propagation:** If either `exports_pct_gdp` or `imports_pct_gdp` is `NaN`, the derived metric evaluates to `NaN` (null) and renders as **Data unavailable** in the UI. Missing observations are never filled with zero.

---

## 5. Audit Conclusions & Summary

1. The data in `master_panel.csv` provides realistic macroeconomic distributions consistent with historical World Bank records.
2. However, because original raw JSON download artifacts are not retained, raw observation indicators are formally classified as **PARTIALLY VERIFIED**, and `interest_rate_pct` is classified as **UNVERIFIED**.
3. Duplicate rows for `NRU` are managed via safe, in-memory deduplication in `comparison_service.py` without modifying the underlying raw file.
4. Final audit classification: **`STAGE4_AUDIT_COMPLETED_WITH_WARNINGS`**.
