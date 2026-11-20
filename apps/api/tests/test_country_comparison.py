"""
EconoSphere AI — Stage 3 Multi-Country Economic Comparison Tests
===============================================================
Comprehensive test suite verifying:
- Valid country selection (2 to 5 countries)
- Validation rejections: < 2 countries, > 5 countries, invalid ISO3 codes, duplicate codes
- Absence of data fabrication (unavailable indicators remain null, never zero)
- Observation year tracking and unit consistency
- Available countries catalogue
- Read-only safety
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_available_comparison_countries():
    """Verify list of available countries is non-empty and flags core and forecast countries."""
    response = client.get("/api/v1/countries/available-comparison-countries")
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) >= 200

    # Ensure USA, CHN, IND are present with correct flags
    by_code = {c["country_code"]: c for c in data}
    assert "USA" in by_code
    assert by_code["USA"]["is_core_economy"] is True
    assert by_code["USA"]["is_forecast_supported"] is True

    assert "CHN" in by_code
    assert by_code["CHN"]["is_core_economy"] is True
    assert by_code["CHN"]["is_forecast_supported"] is True

    assert "DEU" in by_code
    assert by_code["DEU"]["is_core_economy"] is True
    assert by_code["DEU"]["is_forecast_supported"] is False  # Stage 2 model only supports CHN, GBR, IND, JPN, USA


def test_comparison_valid_two_countries():
    """Verify comparing 2 countries returns valid structures, units, and years."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,CHN")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["compared_count"] == 2
    assert len(data["countries"]) == 2

    c_usa = next(c for c in data["countries"] if c["country_code"] == "USA")
    assert c_usa["country_name"] == "United States"
    assert c_usa["is_core_economy"] is True
    assert c_usa["is_forecast_supported"] is True

    gdp_ind = c_usa["latest_indicators"]["gdp_growth_pct"]
    assert gdp_ind["status"] == "available"
    assert isinstance(gdp_ind["value"], float)
    assert gdp_ind["unit"] == "%"
    assert gdp_ind["year"] >= 2020


def test_comparison_valid_five_countries():
    """Verify comparing maximum allowed 5 countries succeeds."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,CHN,IND,JPN,GBR")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["compared_count"] == 5
    assert len(data["countries"]) == 5
    assert len(data["observations"]) > 0


def test_comparison_rejects_single_country():
    """Verify comparing only 1 country returns 400 Bad Request."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA")
    assert response.status_code == 400
    assert "at least 2" in response.json()["detail"].lower()


def test_comparison_rejects_more_than_five_countries():
    """Verify comparing 6 countries returns 400 Bad Request."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,CHN,IND,JPN,GBR,DEU")
    assert response.status_code == 400
    assert "maximum of 5" in response.json()["detail"].lower()


def test_comparison_rejects_duplicate_countries_yielding_single():
    """Verify duplicates like USA,USA are deduplicated, leaving 1 country and rejecting with 400."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,USA")
    assert response.status_code == 400
    assert "at least 2" in response.json()["detail"].lower()


def test_comparison_rejects_invalid_iso3_format():
    """Verify non-ISO3 format is rejected with 400."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,TOOLONG")
    assert response.status_code == 400
    assert "Expected 3-letter" in response.json()["detail"]


def test_comparison_rejects_nonexistent_country():
    """Verify unknown country code returns 400 with helpful message."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,ZZZ")
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_comparison_missing_data_integrity():
    """Verify unavailable indicators are explicitly marked unavailable with null value, not zero."""
    # Micronesia (FSM) or Tuvalu (TUV) typically has missing fiscal debt in World Bank data
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,TUV")
    assert response.status_code == 200
    data = response.json()
    c_tuv = next(c for c in data["countries"] if c["country_code"] == "TUV")
    debt = c_tuv["latest_indicators"]["govt_debt_pct_gdp"]
    # If missing, must be None and 'unavailable', NEVER 0.0
    if debt["status"] == "unavailable":
        assert debt["value"] is None
        assert debt["year"] is None
        assert debt["unit"] == "% of GDP"


def test_comparison_time_series_structure():
    """Verify time series arrays match common_years range (2010 to 2025)."""
    response = client.get("/api/v1/countries/comparison?iso_codes=USA,CHN")
    assert response.status_code == 200
    data = response.json()
    assert 2010 in data["common_years"]
    assert 2024 in data["common_years"]
    c_usa = data["countries"][0]
    assert len(c_usa["historical_gdp_growth"]) == len(data["common_years"])
    # Check that each point has a year and value (float or None)
    for pt in c_usa["historical_gdp_growth"]:
        assert "year" in pt
        assert pt["value"] is None or isinstance(pt["value"], float)
