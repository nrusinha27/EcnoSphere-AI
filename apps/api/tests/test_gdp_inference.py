"""
EconoSphere AI — Phase 11 / Stage 2 GDP Inference Tests
======================================================
Tests for:
  - GET /api/v1/forecasts/defaults/{country_code}
  - POST /api/v1/forecasts/gdp (live inference + empirical 90% bounds)
  - Validation rules (extra="forbid", missing features -> 422)
  - GET /api/v1/forecasts/model-info
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_USA_FEATURES = {
    "country": "USA",
    "year": 2026,
    "exchange_rate_lcu_usd": 1.0,
    "tariff_rate_pct": 2.5,
    "remittances_usd": 9044000000.0,
    "fdi_net_inflow_usd": 400519000000.0,
    "unemployment_pct": 4.198,
    "imports_pct_gdp": 15.0,
    "tax_revenue_pct_gdp": 12.0,
    "exports_pct_gdp": 11.0,
    "interest_rate_pct": 5.5,
    "reserves_usd": 1385447111476.7,
    "current_account_pct_gdp": -3.626987,
    "inflation_cpi_pct": 3.0,
    "population_total": 341784857.0,
    "gdp_current_usd": 30769700000000.0,
    "gdp_growth_lag1": 2.793187,
    "gdp_growth_lag2": 2.934363,
    "gdp_growth_lag3": 2.524214,
    "inflation_lag1": 2.949525,
    "unemployment_lag1": 4.022,
    "exports_lag1": 10.974696,
    "imports_lag1": 14.041321,
    "gdp_growth_rolling_mean_3": 2.629644,
    "gdp_growth_rolling_std_3": 0.411625,
    "gdp_growth_rolling_mean_5": 3.313034,
    "inflation_rolling_mean_3": 3.0,
    "trade_openness": 0.26,
    "trade_balance_ratio": -0.04,
    "log_gdp_usd": 31.057552,
    "log_population": 19.649692,
    "gdp_growth_rolling_std_5": 1.614158,
    "inflation_rolling_std_3": 0.5,
}

def test_get_country_defaults_usa():
    """Verify defaults endpoint returns all 31 features for USA."""
    response = client.get("/api/v1/forecasts/defaults/USA")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["country_code"] == "USA"
    assert data["feature_year"] == 2025
    assert "features" in data
    assert len(data["features"]) == 31
    assert data["features"]["exchange_rate_lcu_usd"] == 1.0


def test_get_country_defaults_all_countries():
    """Verify defaults exist for all 5 official forecast countries."""
    for code in ["CHN", "GBR", "IND", "JPN", "USA"]:
        response = client.get(f"/api/v1/forecasts/defaults/{code}")
        assert response.status_code == 200, f"Failed for {code}"
        data = response.json()
        assert data["country_code"] == code
        assert len(data["features"]) == 31


def test_get_country_defaults_unknown_country():
    """Verify 404 for countries outside the 5 forecast countries."""
    response = client.get("/api/v1/forecasts/defaults/XYZ")
    assert response.status_code == 404


def test_get_country_defaults_invalid_code():
    """Verify 400 for non-ISO3 format."""
    response = client.get("/api/v1/forecasts/defaults/INVALID")
    assert response.status_code == 400


def test_post_gdp_inference_valid():
    """Verify live inference against frozen Phase 11 model returns prediction and calibrated bounds."""
    response = client.post("/api/v1/forecasts/gdp", json=SAMPLE_USA_FEATURES)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["country"] == "USA"
    assert data["year"] == 2026
    assert isinstance(data["predicted_gdp_growth"], float)
    assert "lower_bound_90" in data
    assert "upper_bound_90" in data
    assert "q90" in data
    assert data["q90"] == 11.4507
    assert data["lower_bound_90"] == pytest.approx(data["predicted_gdp_growth"] - 11.4507, abs=1e-3)
    assert data["upper_bound_90"] == pytest.approx(data["predicted_gdp_growth"] + 11.4507, abs=1e-3)
    assert data["model_version"] == "ECONOSPHERE-PHASE11-PROD-2026-08-21"
    assert data["production_status"] == "PHASE 11 PRODUCTION FROZEN"


def test_post_gdp_inference_missing_feature():
    """Verify 422 if any required feature is missing."""
    incomplete = {k: v for k, v in SAMPLE_USA_FEATURES.items() if k != "unemployment_pct"}
    response = client.post("/api/v1/forecasts/gdp", json=incomplete)
    assert response.status_code == 422


def test_post_gdp_inference_extra_feature():
    """Verify 422 if an extra unexpected feature is sent (extra='forbid')."""
    extra = {**SAMPLE_USA_FEATURES, "fabricated_variable": 123.45}
    response = client.post("/api/v1/forecasts/gdp", json=extra)
    assert response.status_code == 422


def test_get_model_info():
    """Verify model identity endpoint returns frozen metadata."""
    response = client.get("/api/v1/forecasts/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] == "ECONOSPHERE-PHASE11-PROD-2026-08-21"
    assert data["status"] == "PHASE 11 PRODUCTION FROZEN"
    assert data["feature_count"] == 31
    assert data["test_rmse"] == 3.9113
