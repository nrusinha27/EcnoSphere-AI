from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class GraphNode(BaseModel):
    id: str
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class ShortestPathRequest(BaseModel):
    source_id: str
    target_id: str
    relationship_type: Optional[str] = None
    max_depth: int = 5

class NeighborhoodRequest(BaseModel):
    node_id: str
    depth: int = 1
    relationship_type: Optional[str] = None

class CentralityResponse(BaseModel):
    node_id: str
    score: float

class PartnerTradeMetric(BaseModel):
    partner_iso3: str
    trade_value_usd: float
    flow_direction: str

class TradeMetricsResponse(BaseModel):
    country_iso3: str
    year: int
    total_reported_exports_usd: float
    total_reported_imports_usd: float
    reported_trade_balance_usd: float
    trade_concentration_hhi: float
    is_complete_national_statistic: bool = False
    coverage_scope: str
    coverage_disclaimer: str
    top_export_partners: List[PartnerTradeMetric]
    top_import_partners: List[PartnerTradeMetric]

class CorridorMetricsResponse(BaseModel):
    source_iso3: str
    target_iso3: str
    year: int
    reported_export_fob_usd: Optional[float] = None
    reported_import_cif_usd: Optional[float] = None
    trade_volume_billions: Optional[float] = None
    perspective: str
    source_dataset: str
    coverage_disclaimer: str
