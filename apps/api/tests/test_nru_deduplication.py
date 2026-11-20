"""
EconoSphere AI — Nauru (NRU) Deduplication Regression Test
===========================================================
Verifies that the in-memory deduplication applied by production
ComparisonService._get_master_df() correctly handles the Nauru/Naoero split in master_panel.csv:

  - master_panel.csv contains 52 rows for NRU (26 from 'Naoero', 26 from 'Nauru').
  - The REAL production ComparisonService._get_master_df() is invoked and tested directly.
  - After deduplication: exactly 1 row per (country_code, year) for NRU.
  - GDP growth and nominal GDP values (from 'Nauru' rows) are preserved.
  - Trade/tax/exports/imports values (from 'Naoero' rows) are preserved.
  - Exactly 235 unique country codes in the deduplicated frame.
  - Exactly 6,110 (country_code, year) rows after deduplication.
  - Zero genuine conflicts (no column has two different non-null values in the same year).
  - country_name for NRU is set to 'Nauru' after deduplication.
  - End-to-end production methods (get_available_countries, get_multi_country_comparison)
    correctly expose the deduplicated, conflict-free data.

Protection rules:
  - master_panel.csv is NOT modified.
  - No database migrations.
  - No model modifications.
"""

import math
from pathlib import Path
import pytest
import pandas as pd
from app.services.comparison_service import comparison_service, ComparisonService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MASTER_PANEL_PATH = Path(__file__).resolve().parents[3] / "data" / "raw" / "master_panel.csv"

INDICATOR_COLS = [
    "gdp_growth_pct", "gdp_current_usd", "inflation_cpi_pct", "unemployment_pct",
    "govt_debt_pct_gdp", "tax_revenue_pct_gdp", "current_account_pct_gdp",
    "reserves_usd", "interest_rate_pct", "fdi_net_inflow_usd",
    "exports_pct_gdp", "imports_pct_gdp",
    "exchange_rate_lcu_usd", "tariff_rate_pct", "remittances_usd", "population_total",
]


def _load_raw() -> pd.DataFrame:
    assert MASTER_PANEL_PATH.exists(), f"master_panel.csv not found at {MASTER_PANEL_PATH}"
    return pd.read_csv(str(MASTER_PANEL_PATH))


def _get_production_df() -> pd.DataFrame:
    """Invokes the REAL production comparison service master dataframe."""
    return comparison_service._get_master_df()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRawPanel:
    """Read-only assertions about master_panel.csv structure."""

    def test_raw_row_count(self):
        """Raw CSV must contain exactly 6,136 rows."""
        df = _load_raw()
        assert len(df) == 6136, f"Expected 6136 raw rows, got {len(df)}"

    def test_nru_raw_row_count(self):
        """NRU must have exactly 52 raw rows (2 × 26 years)."""
        df = _load_raw()
        nru = df[df["country_code"] == "NRU"]
        assert len(nru) == 52, f"Expected 52 NRU rows, got {len(nru)}"

    def test_nru_two_name_variants(self):
        """NRU rows must use exactly two distinct country_name values: 'Naoero' and 'Nauru'."""
        df = _load_raw()
        nru_names = set(df[df["country_code"] == "NRU"]["country_name"].unique())
        assert nru_names == {"Naoero", "Nauru"}, f"Unexpected NRU names: {nru_names}"

    def test_no_other_duplicate_country_years(self):
        """Only NRU should have duplicate (country_code, year) pairs in the raw CSV."""
        df = _load_raw()
        dup_mask = df.duplicated(subset=["country_code", "year"], keep=False)
        dup_codes = set(df[dup_mask]["country_code"].unique())
        assert dup_codes == {"NRU"}, f"Unexpected duplicate country codes: {dup_codes}"


class TestDeduplication:
    """Verify correctness of the in-memory deduplication applied by production ComparisonService."""

    def test_dedup_row_count(self):
        """After deduplication: exactly 6,110 rows (235 countries × 26 years)."""
        df = _get_production_df()
        assert len(df) == 6110, f"Expected 6110 deduplicated rows, got {len(df)}"

    def test_dedup_unique_country_codes(self):
        """After deduplication: exactly 235 unique country codes."""
        df = _get_production_df()
        n = df["country_code"].nunique()
        assert n == 235, f"Expected 235 unique country codes, got {n}"

    def test_dedup_no_duplicate_country_years(self):
        """After deduplication: zero duplicate (country_code, year) pairs."""
        df = _get_production_df()
        n_dups = df.duplicated(subset=["country_code", "year"]).sum()
        assert n_dups == 0, f"Found {n_dups} duplicate (country_code, year) pairs after dedup"

    def test_nru_exactly_26_rows_after_dedup(self):
        """NRU must have exactly 26 rows after deduplication (one per year 2000-2025)."""
        df = _get_production_df()
        nru = df[df["country_code"] == "NRU"]
        assert len(nru) == 26, f"Expected 26 NRU rows after dedup, got {len(nru)}"

    def test_nru_name_unified_to_nauru(self):
        """country_name for NRU must be 'Nauru' in every deduplicated row."""
        df = _get_production_df()
        nru_names = df[df["country_code"] == "NRU"]["country_name"].unique()
        assert list(nru_names) == ["Nauru"], f"NRU country_name not unified: {nru_names}"

    def test_nru_gdp_values_preserved(self):
        """GDP growth and nominal GDP values (from 'Nauru' extract) must not be lost."""
        df_raw = _load_raw()
        df = _get_production_df()
        # Sample check: year 2020
        nru_2020 = df[(df["country_code"] == "NRU") & (df["year"] == 2020)]
        assert len(nru_2020) == 1

        raw_nauru_2020 = df_raw[
            (df_raw["country_code"] == "NRU") &
            (df_raw["country_name"] == "Nauru") &
            (df_raw["year"] == 2020)
        ]
        assert len(raw_nauru_2020) == 1
        raw_row = raw_nauru_2020.iloc[0]

        # GDP growth (only in Nauru extract) must be preserved
        if not pd.isna(raw_row.get("gdp_growth_pct")):
            assert abs(nru_2020.iloc[0]["gdp_growth_pct"] - raw_row["gdp_growth_pct"]) < 1e-6, \
                "gdp_growth_pct was lost during NRU deduplication"

        # Nominal GDP (only in Nauru extract) must be preserved
        if not pd.isna(raw_row.get("gdp_current_usd")):
            assert abs(nru_2020.iloc[0]["gdp_current_usd"] - raw_row["gdp_current_usd"]) < 1e-6, \
                "gdp_current_usd was lost during NRU deduplication"

    def test_nru_trade_values_preserved(self):
        """Trade/tax/exports/imports values (from 'Naoero' extract) must not be lost."""
        df_raw = _load_raw()
        df = _get_production_df()
        nru_2020 = df[(df["country_code"] == "NRU") & (df["year"] == 2020)]
        assert len(nru_2020) == 1

        raw_naoero_2020 = df_raw[
            (df_raw["country_code"] == "NRU") &
            (df_raw["country_name"] == "Naoero") &
            (df_raw["year"] == 2020)
        ]
        assert len(raw_naoero_2020) == 1
        raw_row = raw_naoero_2020.iloc[0]

        for col in ["exports_pct_gdp", "imports_pct_gdp", "tax_revenue_pct_gdp"]:
            if not pd.isna(raw_row.get(col)):
                assert abs(nru_2020.iloc[0][col] - raw_row[col]) < 1e-6, \
                    f"{col} was lost during NRU deduplication"

    def test_nru_no_genuine_conflicts_across_all_years(self):
        """
        Verify zero genuine conflicts: no column has two different non-null values
        for the same NRU year across the two extracts.
        A conflict would mean groupby().first() silently overwrites valid data.
        """
        df_raw = _load_raw()
        nru = df_raw[df_raw["country_code"] == "NRU"]
        naoero = nru[nru["country_name"] == "Naoero"].set_index("year")
        nauru = nru[nru["country_name"] == "Nauru"].set_index("year")

        conflicts = []
        value_cols = [c for c in df_raw.columns if c not in ["country_code", "country_name", "year"]]
        for col in value_cols:
            if col not in naoero.columns or col not in nauru.columns:
                continue
            for yr in naoero.index:
                if yr not in nauru.index:
                    continue
                v1 = naoero.loc[yr, col]
                v2 = nauru.loc[yr, col]
                if pd.isna(v1) or pd.isna(v2):
                    continue
                try:
                    if abs(float(v1) - float(v2)) > 1e-6:
                        conflicts.append((col, yr, v1, v2))
                except (TypeError, ValueError):
                    if v1 != v2:
                        conflicts.append((col, yr, v1, v2))

        assert len(conflicts) == 0, (
            f"Found {len(conflicts)} genuine conflicts in NRU data "
            f"(groupby().first() will silently drop valid values):\n"
            + "\n".join(f"  col={c[0]} year={c[1]} Naoero={c[2]} Nauru={c[3]}" for c in conflicts[:10])
        )

    def test_all_years_present_for_all_countries(self):
        """Every country must have exactly 26 observation years (2000-2025)."""
        df = _get_production_df()
        expected_years = set(range(2000, 2026))
        bad = []
        for code, grp in df.groupby("country_code"):
            years = set(grp["year"].tolist())
            if years != expected_years:
                bad.append((code, len(years), sorted(years - expected_years), sorted(expected_years - years)))
        assert len(bad) == 0, (
            f"{len(bad)} countries do not have exactly 26 years.\n"
            + "\n".join(f"  {b[0]}: {b[1]} years; extra={b[2]}; missing={b[3]}" for b in bad[:5])
        )

    def test_production_available_countries_has_nauru(self):
        """Production get_available_countries() must return exactly 235 countries, including Nauru."""
        options = comparison_service.get_available_countries()
        assert len(options) == 235, f"Expected 235 available country options, got {len(options)}"
        nru_opt = next((o for o in options if o.country_code == "NRU"), None)
        assert nru_opt is not None, "NRU not found in available countries"
        assert nru_opt.country_name == "Nauru", f"NRU name not unified: {nru_opt.country_name}"

    def test_production_multi_country_comparison_with_nru(self):
        """Production get_multi_country_comparison() must succeed with NRU and preserve complementary fields."""
        res = comparison_service.get_multi_country_comparison(["NRU", "USA"])
        assert res.compared_count == 2
        nru_prof = next((c for c in res.countries if c.country_code == "NRU"), None)
        assert nru_prof is not None, "NRU profile not found"
        assert nru_prof.country_name == "Nauru"

        # Check that GDP growth (from Nauru extract) is available
        gdp_growth = nru_prof.latest_indicators.get("gdp_growth_pct")
        assert gdp_growth is not None and gdp_growth.status == "available"
        assert gdp_growth.value is not None

        # Check that exports (from Naoero extract) is available
        exports = nru_prof.latest_indicators.get("exports_pct_gdp")
        assert exports is not None and exports.status == "available"
        assert exports.value is not None

        # Check derived trade balance
        tb = nru_prof.latest_indicators.get("trade_balance_pct_gdp")
        assert tb is not None and tb.status == "available"
