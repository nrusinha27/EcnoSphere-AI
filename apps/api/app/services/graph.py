"""
Phase 22 — Graph Service
=========================
Thin orchestration layer above GraphRepository.
Passes year parameter through for timeline replay and provides trade metrics.
"""
from typing import List, Optional

from app.repositories.graph import GraphRepository
from app.schemas.graph import (
    GraphResponse, CentralityResponse,
    TradeMetricsResponse, CorridorMetricsResponse
)


class GraphService:
    def __init__(self):
        self.repo = GraphRepository()

    async def get_network(self, year: Optional[int] = None) -> GraphResponse:
        """Returns the global bilateral trade network, optionally filtered by year."""
        return await self.repo.get_network(year=year)

    async def get_neighbors(self, node_id: str, depth: int) -> GraphResponse:
        """Returns neighboring nodes up to depth hops from the given ISO3 node."""
        return await self.repo.get_neighbors(node_id, depth)

    async def get_shortest_path(self, source_id: str, target_id: str) -> GraphResponse:
        """Returns the shortest trade path between two ISO3 sovereign nodes."""
        return await self.repo.get_shortest_path(source_id, target_id)

    async def get_centrality(self) -> List[CentralityResponse]:
        """Returns nodes ranked by out-degree centrality (trade influence proxy)."""
        records = await self.repo.get_centrality()
        return [
            CentralityResponse(node_id=r["node_id"], score=float(r["score"]))
            for r in records
            if r.get("node_id")
        ]

    async def get_country_metrics(self, country_iso3: str, year: int = 2022) -> TradeMetricsResponse:
        """Returns calculated bilateral trade metrics and market concentration for a country."""
        return await self.repo.get_country_metrics(country_iso3, year=year)

    async def get_corridor_metrics(self, source_iso3: str, target_iso3: str, year: int = 2022) -> CorridorMetricsResponse:
        """Returns bilateral corridor metrics between two ISO3 sovereign nations."""
        return await self.repo.get_corridor_metrics(source_iso3, target_iso3, year=year)


graph_service = GraphService()
