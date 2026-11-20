"""
Unit and integration tests for Trade Network Graph endpoints, metrics, and fault-tolerance.
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_global_network():
    mock_network = {
        "nodes": [{"id": "USA", "label": "United States", "properties": {"region": "Americas"}}],
        "edges": [{"id": "e1", "source": "USA", "target": "CAN", "type": "EXPORTS_TO", "properties": {"tradeVolume": 356.3}}]
    }
    with patch("app.services.graph.graph_service.get_network", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_network
        response = client.get("/api/v1/graph/network")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 1
        assert len(data["edges"]) == 1
        assert data["nodes"][0]["id"] == "USA"
        assert data["edges"][0]["id"] == "e1"


def test_get_neighbors():
    mock_network = {
        "nodes": [{"id": "USA", "label": "United States", "properties": {}}, {"id": "MEX", "label": "Mexico", "properties": {}}],
        "edges": [{"id": "e2", "source": "USA", "target": "MEX", "type": "EXPORTS_TO", "properties": {"tradeVolume": 324.1}}]
    }
    with patch("app.services.graph.graph_service.get_neighbors", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_network
        response = client.get("/api/v1/graph/neighbors/USA?depth=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1


def test_get_shortest_path():
    mock_path = {
        "nodes": [{"id": "USA", "label": "United States", "properties": {}}, {"id": "CHN", "label": "China", "properties": {}}],
        "edges": [{"id": "e3", "source": "USA", "target": "CHN", "type": "EXPORTS_TO", "properties": {"tradeVolume": 153.8}}]
    }
    with patch("app.services.graph.graph_service.get_shortest_path", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_path
        response = client.get("/api/v1/graph/path?source=USA&target=CHN")
        assert response.status_code == 200
        data = response.json()
        assert data["nodes"][1]["id"] == "CHN"


def test_get_centrality():
    mock_centrality = [
        {"node_id": "NLD", "score": 233.0},
        {"node_id": "DEU", "score": 231.0}
    ]
    with patch("app.services.graph.graph_service.get_centrality", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_centrality
        response = client.get("/api/v1/graph/centrality")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["node_id"] == "NLD"
        assert data[0]["score"] == 233.0


def test_get_country_metrics_endpoint():
    """Verify GET /api/v1/graph/metrics/{country} returns verified trade metrics with disclaimers."""
    response = client.get("/api/v1/graph/metrics/USA?year=2022")
    assert response.status_code == 200
    data = response.json()
    assert data["country_iso3"] == "USA"
    assert data["year"] == 2022
    assert data["total_reported_exports_usd"] > 0
    assert data["total_reported_imports_usd"] > 0
    assert data["is_complete_national_statistic"] is False
    assert "Partial bilateral trade sample" in data["coverage_disclaimer"]
    assert len(data["top_export_partners"]) > 0


def test_get_corridor_metrics_endpoint():
    """Verify GET /api/v1/graph/corridor returns empirical bilateral corridor data."""
    response = client.get("/api/v1/graph/corridor?source=USA&target=CHN&year=2022")
    assert response.status_code == 200
    data = response.json()
    assert data["source_iso3"] == "USA"
    assert data["target_iso3"] == "CHN"
    assert data["reported_export_fob_usd"] is not None
    assert data["reported_import_cif_usd"] is not None


def test_country_metrics_unobserved_country_returns_404():
    """Verify GET /api/v1/graph/metrics/{country} returns 404 for unobserved country."""
    response = client.get("/api/v1/graph/metrics/XYZ?year=2022")
    assert response.status_code == 404
    assert "NO_DATA" in response.json()["detail"]


def test_service_unavailable_503_when_primary_and_fallback_fail():
    """Verify HTTP 503 is returned when both primary database and fallback cache fail."""
    from fastapi import HTTPException
    with patch("app.services.graph.graph_service.get_network", side_effect=HTTPException(status_code=503, detail="Service unavailable")):
        response = client.get("/api/v1/graph/network")
        assert response.status_code == 503
