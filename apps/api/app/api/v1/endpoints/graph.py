"""
Phase 22 — Graph API Endpoints
================================
Endpoints for the global bilateral trade network, pathfinding,
centrality rankings, and empirical trade metrics.
"""
from fastapi import APIRouter, Query, Path
from typing import List, Optional
from app.schemas.graph import (
    GraphResponse, CentralityResponse,
    TradeMetricsResponse, CorridorMetricsResponse
)
from app.services.graph import graph_service

router = APIRouter()


@router.get("/network", response_model=GraphResponse)
async def get_global_network(year: Optional[int] = Query(None, ge=2015, le=2025, description="Filter by year (2015–2025)")):
    """
    Returns the global bilateral trade knowledge graph.
    Supports optional year filtering for Historical Simulation Replay timeline.
    Falls back to offline cached snapshot if Neo4j is unavailable.
    Returns HTTP 503 if both primary and fallback cache are unavailable.
    """
    return await graph_service.get_network(year=year)


@router.get("/neighbors/{node_id}", response_model=GraphResponse)
async def get_neighbors(node_id: str, depth: int = Query(1, ge=1, le=3)):
    """
    Returns neighboring nodes and edges up to the specified depth.
    node_id must be a sovereign ISO3 country code (e.g. 'USA').
    """
    return await graph_service.get_neighbors(node_id, depth)


@router.get("/path", response_model=GraphResponse)
async def get_shortest_path(
    source: str = Query(..., description="Source country ISO3 (e.g. 'USA')"),
    target: str = Query(..., description="Target country ISO3 (e.g. 'CHN')")
):
    """Returns the shortest trade path between two ISO3 sovereign nodes."""
    return await graph_service.get_shortest_path(source, target)


@router.get("/centrality", response_model=List[CentralityResponse])
async def get_centrality():
    """
    Returns top countries ranked by out-degree trade centrality.
    Falls back to computing from cached network when Neo4j is offline.
    """
    return await graph_service.get_centrality()


@router.get("/metrics/{country_code}", response_model=TradeMetricsResponse)
async def get_country_metrics(
    country_code: str = Path(..., min_length=3, max_length=3, description="Sovereign ISO3 code (e.g. 'USA')"),
    year: int = Query(2022, ge=2015, le=2025, description="Reporting year")
):
    """
    Returns verified bilateral trade metrics for an economy, including:
      - Total reported exports and imports within the sample
      - Reported sample net balance
      - Market concentration (HHI)
      - Top trading partners
      - Explicit sample coverage disclaimers
    """
    return await graph_service.get_country_metrics(country_code, year=year)


@router.get("/corridor", response_model=CorridorMetricsResponse)
async def get_corridor_metrics(
    source: str = Query(..., min_length=3, max_length=3, description="Source country ISO3 (e.g. 'USA')"),
    target: str = Query(..., min_length=3, max_length=3, description="Target country ISO3 (e.g. 'CHN')"),
    year: int = Query(2022, ge=2015, le=2025, description="Reporting year")
):
    """
    Returns empirical bilateral trade statistics between two sovereign nations,
    including independent FOB export and CIF import valuations.
    """
    return await graph_service.get_corridor_metrics(source, target, year=year)
