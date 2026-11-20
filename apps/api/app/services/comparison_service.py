"""
EconoSphere AI — Stage 3 Multi-Country Economic Comparison Service
==================================================================
Provides read-only multi-country comparative macroeconomic indicators
sourced directly from authentic World Bank datasets (master_panel.csv).

Strict Governance:
- Zero data fabrication.
- Missing values are explicitly represented as null, never converted to 0.
- Observation years are individually tracked per country and indicator.
- Core 10 economies and Phase 11 forecast support scopes are explicitly distinguished.
- Descriptive observations are strictly data-derived with no synthetic risk rankings.
"""

import math
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
from app.schemas.country import (
    IndicatorDataPoint,
    TimeSeriesPoint,
    CountryComparisonProfile,
    FactualObservation,
    MultiCountryComparisonResponse,
    AvailableCountryOption,
)

CORE_ECONOMIES = {"USA", "CHN", "DEU", "JPN", "IND", "GBR", "BRA", "FRA", "CAN", "AUS"}
FORECAST_SUPPORTED_COUNTRIES = {"CHN", "GBR", "IND", "JPN", "USA"}

INDICATOR_SPECS = [
    {
        "key": "gdp_growth_pct",
        "name": "GDP Growth Rate",
        "category": "Economic Growth",
        "unit": "%",
        "source": "World Bank WDI",
    },
    {
        "key": "gdp_current_usd",
        "name": "GDP Level (Current USD)",
        "category": "Economic Growth",
        "unit": "USD",
        "source": "World Bank WDI",
    },
    {
        "key": "inflation_cpi_pct",
        "name": "CPI Inflation Rate",
        "category": "Inflation & Labor",
        "unit": "%",
        "source": "World Bank WDI",
    },
    {
        "key": "unemployment_pct",
        "name": "Unemployment Rate",
        "category": "Inflation & Labor",
        "unit": "%",
        "source": "World Bank WDI",
    },
    {
        "key": "govt_debt_pct_gdp",
        "name": "Central Government Debt",
        "category": "Fiscal & Financial",
        "unit": "% of GDP",
        "source": "World Bank WDI",
    },
    {
        "key": "tax_revenue_pct_gdp",
        "name": "Tax Revenue",
        "category": "Fiscal & Financial",
        "unit": "% of GDP",
        "source": "World Bank WDI",
    },
    {
        "key": "current_account_pct_gdp",
        "name": "Current Account Balance",
        "category": "Fiscal & Financial",
        "unit": "% of GDP",
        "source": "World Bank WDI",
    },
    {
        "key": "reserves_usd",
        "name": "Total Reserves (inc. gold)",
        "category": "Fiscal & Financial",
        "unit": "USD",
        "source": "World Bank WDI",
    },
    {
        "key": "interest_rate_pct",
        "name": "Interest Rate",
        "category": "Fiscal & Financial",
        "unit": "%",
        "source": "World Bank (Provenance Unverified)",
    },
    {
        "key": "fdi_net_inflow_usd",
        "name": "Net FDI Inflows",
        "category": "Fiscal & Financial",
        "unit": "USD",
        "source": "World Bank WDI",
    },
    {
        "key": "exports_pct_gdp",
        "name": "Exports of Goods & Services",
        "category": "International Trade",
        "unit": "% of GDP",
        "source": "World Bank WDI",
    },
    {
        "key": "imports_pct_gdp",
        "name": "Imports of Goods & Services",
        "category": "International Trade",
        "unit": "% of GDP",
        "source": "World Bank WDI",
    },
    {
        "key": "trade_balance_pct_gdp",
        "name": "Trade Balance (Exports - Imports)",
        "category": "International Trade",
        "unit": "% of GDP",
        "source": "World Bank WDI (Derived)",
    },
    {
        "key": "trade_openness_pct_gdp",
        "name": "Trade-to-GDP Ratio (Openness)",
        "category": "International Trade",
        "unit": "% of GDP",
        "source": "World Bank WDI (Derived)",
    },
]

class ComparisonService:
    def __init__(self):
        self._df: Optional[pd.DataFrame] = None
        self._available_countries: Optional[List[AvailableCountryOption]] = None

    def _get_master_df(self) -> pd.DataFrame:
        if self._df is None:
            base_path = Path(__file__).resolve().parents[5]
            csv_path = base_path / "data" / "raw" / "master_panel.csv"
            if not csv_path.exists():
                csv_path = Path("../../data/raw/master_panel.csv")
            df = pd.read_csv(str(csv_path))

            # Read-only deduplication for (country_code, year) duplicate pairs (specifically NRU / Naoero-Nauru split)
            # Combine non-null values so both Naoero's trade/tax data and Nauru's GDP data are unified
            df_sorted = df.sort_values(["country_code", "year", "country_name"])
            df_unified = df_sorted.groupby(["country_code", "year"], as_index=False).first()
            # Ensure country_name for NRU is unified as 'Nauru'
            df_unified.loc[df_unified["country_code"] == "NRU", "country_name"] = "Nauru"
            
            # Pre-compute derived indicators where both components exist
            df_unified["trade_balance_pct_gdp"] = df_unified["exports_pct_gdp"] - df_unified["imports_pct_gdp"]
            df_unified["trade_openness_pct_gdp"] = df_unified["exports_pct_gdp"] + df_unified["imports_pct_gdp"]
            self._df = df_unified
        return self._df

    def get_available_countries(self) -> List[AvailableCountryOption]:
        """Return list of all available countries in the master panel dataset."""
        if self._available_countries is None:
            df = self._get_master_df()
            grouped = df.groupby(["country_code", "country_name"])["year"].max().reset_index()
            options = []
            for _, row in grouped.iterrows():
                code = str(row["country_code"]).strip().upper()
                name = str(row["country_name"]).strip()
                max_year = int(row["year"])
                options.append(
                    AvailableCountryOption(
                        country_code=code,
                        country_name=name,
                        is_core_economy=code in CORE_ECONOMIES,
                        is_forecast_supported=code in FORECAST_SUPPORTED_COUNTRIES,
                        has_recent_data=max_year >= 2020,
                    )
                )
            # Sort: core economies first, then alphabetically by country name
            options.sort(key=lambda c: (0 if c.is_core_economy else 1, c.country_name))
            self._available_countries = options
        return self._available_countries

    def get_multi_country_comparison(self, country_codes: List[str]) -> MultiCountryComparisonResponse:
        """
        Build full comparative profiles for 2 to 5 countries.
        Extracts latest observations, historical time series, and factual comparative observations.
        """
        cleaned_codes = [c.strip().upper() for c in country_codes]
        # Remove duplicates while preserving order
        unique_codes: List[str] = []
        for c in cleaned_codes:
            if c not in unique_codes:
                unique_codes.append(c)

        if len(unique_codes) < 2:
            raise ValueError("Comparison requires at least 2 distinct countries.")
        if len(unique_codes) > 5:
            raise ValueError("A maximum of 5 countries can be compared simultaneously.")

        df = self._get_master_df()
        available_set = set(df["country_code"].str.upper().unique())
        invalid_codes = [c for c in unique_codes if c not in available_set]
        if invalid_codes:
            raise ValueError(f"Country code(s) not found in dataset: {', '.join(invalid_codes)}")

        profiles: List[CountryComparisonProfile] = []
        # Filter for the relevant years (e.g. 2010 to 2025 for time-series)
        HIST_START_YEAR = 2010
        HIST_END_YEAR = 2025
        common_years = list(range(HIST_START_YEAR, HIST_END_YEAR + 1))

        for code in unique_codes:
            sub = df[df["country_code"].str.upper() == code].sort_values("year")
            country_name = sub["country_name"].iloc[0] if not sub.empty else code

            # 1. Latest indicators
            latest_indicators: Dict[str, IndicatorDataPoint] = {}
            for spec in INDICATOR_SPECS:
                key = spec["key"]
                val = None
                obs_year = None
                status = "unavailable"

                if key in sub.columns:
                    valid_rows = sub.dropna(subset=[key])
                    if not valid_rows.empty:
                        last_row = valid_rows.iloc[-1]
                        raw_v = last_row[key]
                        if not (isinstance(raw_v, float) and math.isnan(raw_v)):
                            val = round(float(raw_v), 4)
                            obs_year = int(last_row["year"])
                            status = "available"

                latest_indicators[key] = IndicatorDataPoint(
                    indicator_key=key,
                    indicator_name=spec["name"],
                    category=spec["category"],
                    value=val,
                    unit=spec["unit"],
                    year=obs_year,
                    source=spec["source"],
                    status=status,
                )

            # 2. Historical time series (2010–2025)
            # Map year -> value
            sub_hist = sub[(sub["year"] >= HIST_START_YEAR) & (sub["year"] <= HIST_END_YEAR)]
            year_map = {int(r["year"]): r for _, r in sub_hist.iterrows()}

            def make_ts(col_name: str) -> List[TimeSeriesPoint]:
                pts = []
                for yr in common_years:
                    v = None
                    if yr in year_map:
                        raw = year_map[yr].get(col_name, None)
                        if raw is not None and not (isinstance(raw, float) and math.isnan(raw)):
                            v = round(float(raw), 4)
                    pts.append(TimeSeriesPoint(year=yr, value=v))
                return pts

            profiles.append(
                CountryComparisonProfile(
                    country_code=code,
                    country_name=country_name,
                    is_forecast_supported=code in FORECAST_SUPPORTED_COUNTRIES,
                    is_core_economy=code in CORE_ECONOMIES,
                    latest_indicators=latest_indicators,
                    historical_gdp_growth=make_ts("gdp_growth_pct"),
                    historical_inflation=make_ts("inflation_cpi_pct"),
                    historical_unemployment=make_ts("unemployment_pct"),
                    historical_trade_to_gdp=make_ts("trade_openness_pct_gdp"),
                )
            )

        # 3. Compute factual comparative observations
        observations = self._generate_factual_observations(profiles)

        return MultiCountryComparisonResponse(
            countries=profiles,
            compared_count=len(profiles),
            observations=observations,
            common_years=common_years,
            data_disclaimer=(
                "All comparative figures reflect actual observed World Bank World Development Indicators (WDI). "
                "Different indicators may report on different observation years; individual observation years "
                "are explicitly disclosed. No values are interpolated or artificially imputed. Missing data "
                "is displayed as unavailable rather than zero."
            ),
        )

    def _generate_factual_observations(
        self, profiles: List[CountryComparisonProfile]
    ) -> List[FactualObservation]:
        """Compute strictly factual, data-grounded observations across the compared countries."""
        obs: List[FactualObservation] = []

        # A. Highest / Lowest GDP Growth Rate
        gdp_points = [
            (p.country_code, p.country_name, p.latest_indicators["gdp_growth_pct"])
            for p in profiles
            if p.latest_indicators["gdp_growth_pct"].status == "available"
        ]
        if gdp_points:
            gdp_points.sort(key=lambda x: x[2].value, reverse=True)
            highest_gdp = gdp_points[0]
            lowest_gdp = gdp_points[-1]

            obs.append(
                FactualObservation(
                    indicator_name="GDP Growth Rate",
                    country_code=highest_gdp[0],
                    country_name=highest_gdp[1],
                    value=highest_gdp[2].value,
                    unit="%",
                    year=highest_gdp[2].year,
                    observation_type="highest",
                    description=(
                        f"{highest_gdp[1]} ({highest_gdp[0]}) exhibits the highest latest observed GDP growth rate "
                        f"at {highest_gdp[2].value:+.2f}% ({highest_gdp[2].year})."
                    ),
                )
            )
            if len(gdp_points) > 1 and lowest_gdp[0] != highest_gdp[0]:
                obs.append(
                    FactualObservation(
                        indicator_name="GDP Growth Rate",
                        country_code=lowest_gdp[0],
                        country_name=lowest_gdp[1],
                        value=lowest_gdp[2].value,
                        unit="%",
                        year=lowest_gdp[2].year,
                        observation_type="lowest",
                        description=(
                            f"{lowest_gdp[1]} ({lowest_gdp[0]}) registers the lowest latest observed GDP growth rate "
                            f"at {lowest_gdp[2].value:+.2f}% ({lowest_gdp[2].year})."
                        ),
                    )
                )

        # B. Highest Inflation Rate
        inf_points = [
            (p.country_code, p.country_name, p.latest_indicators["inflation_cpi_pct"])
            for p in profiles
            if p.latest_indicators["inflation_cpi_pct"].status == "available"
        ]
        if inf_points:
            inf_points.sort(key=lambda x: x[2].value, reverse=True)
            highest_inf = inf_points[0]
            obs.append(
                FactualObservation(
                    indicator_name="CPI Inflation Rate",
                    country_code=highest_inf[0],
                    country_name=highest_inf[1],
                    value=highest_inf[2].value,
                    unit="%",
                    year=highest_inf[2].year,
                    observation_type="highest",
                    description=(
                        f"{highest_inf[1]} ({highest_inf[0]}) recorded the highest consumer price inflation "
                        f"among compared economies at {highest_inf[2].value:.2f}% ({highest_inf[2].year})."
                    ),
                )
            )

        # C. Unemployment Rate
        unemp_points = [
            (p.country_code, p.country_name, p.latest_indicators["unemployment_pct"])
            for p in profiles
            if p.latest_indicators["unemployment_pct"].status == "available"
        ]
        if unemp_points:
            unemp_points.sort(key=lambda x: x[2].value, reverse=True)
            highest_unemp = unemp_points[0]
            obs.append(
                FactualObservation(
                    indicator_name="Unemployment Rate",
                    country_code=highest_unemp[0],
                    country_name=highest_unemp[1],
                    value=highest_unemp[2].value,
                    unit="%",
                    year=highest_unemp[2].year,
                    observation_type="highest",
                    description=(
                        f"{highest_unemp[1]} ({highest_unemp[0]}) has the highest reported unemployment rate "
                        f"at {highest_unemp[2].value:.2f}% of total labor force ({highest_unemp[2].year})."
                    ),
                )
            )

        # D. Trade Openness
        trade_points = [
            (p.country_code, p.country_name, p.latest_indicators["trade_openness_pct_gdp"])
            for p in profiles
            if p.latest_indicators["trade_openness_pct_gdp"].status == "available"
        ]
        if trade_points:
            trade_points.sort(key=lambda x: x[2].value, reverse=True)
            highest_trade = trade_points[0]
            obs.append(
                FactualObservation(
                    indicator_name="Trade-to-GDP Ratio",
                    country_code=highest_trade[0],
                    country_name=highest_trade[1],
                    value=highest_trade[2].value,
                    unit="% of GDP",
                    year=highest_trade[2].year,
                    observation_type="highest",
                    description=(
                        f"{highest_trade[1]} ({highest_trade[0]}) demonstrates the highest trade integration "
                        f"(total exports plus imports) at {highest_trade[2].value:.1f}% of GDP ({highest_trade[2].year})."
                    ),
                )
            )

        return obs

comparison_service = ComparisonService()
