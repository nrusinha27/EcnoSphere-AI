"""
Phase 22 — Graph API Endpoints
================================
Changes:
  - GET /network now accepts optional ?year=YYYY query param for timeline replay
  - Added CentralityResponse import (was missing from type hint)
"""
from fastapi import APIRouter, Query
from typing import List, Optional
from app.schemas.graph import GraphResponse, CentralityResponse
from app.services.graph import graph_service

router = APIRouter()


@router.get("/network", response_model=GraphResponse)
async def get_global_network(year: Optional[int] = Query(None, ge=2015, le=2025, description="Filter by year (2015–2025)")):
    """
    Returns the global bilateral trade knowledge graph.

    Supports optional year filtering for Historical Simulation Replay timeline.
    Falls back to offline cached snapshot if Neo4j is unavailable (never returns HTTP 500).
    """
    return await graph_service.get_network(year=year)


@router.get("/neighbors/{node_id}", response_model=GraphResponse)
async def get_neighbors(node_id: str, depth: int = Query(1, ge=1, le=3)):
    """
    Returns neighboring nodes and edges up to the specified depth.
    node_id must be an ISO3 country code (e.g. 'USA').
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
