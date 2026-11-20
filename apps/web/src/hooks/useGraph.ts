/**
 * Phase 22 — Graph React Query Hooks
 * =====================================
 * Changes:
 *   - useGlobalNetwork(year?) passes year query param to /graph/network
 *   - Added useGraphNeighbors(nodeId, depth) — wires backend /graph/neighbors/{id}
 *   - Added useShortestPath(source, target) — wires backend /graph/path
 *   - GraphEdgeProperties includes tradeVolume, export_value_usd, import_value_usd, perspective
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface GraphNodeProperties {
  name?: string;
  iso3?: string;
  region?: string;
  income_group?: string;
  health?: number;
  stability?: number;
  risk?: number;
  category?: string;
  type?: string;
  [key: string]: unknown;
}

export interface GraphNode {
  id: string; // Sovereign ISO3 code (e.g. "USA")
  label: string;
  properties: GraphNodeProperties;
}

export interface GraphEdgeProperties {
  commodity_id?: string;
  commodity_category?: string;
  commodity_scope?: string;
  year?: number;
  tradeVolume?: number; // Export value in billions USD
  importVolume?: number; // Import value in billions USD
  netBalance?: number; // Net trade balance in billions USD
  export_value_usd?: number;
  import_value_usd?: number;
  perspective?: string;
  source?: string;
  dependencyScore?: number;
  growth?: number;
  joined_year?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string; // ISO3 code
  target: string; // ISO3 code
  type: string;
  properties: GraphEdgeProperties;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CentralityRank {
  node_id: string; // ISO3 code
  score: number;
}

export interface TradeMetrics {
  country_iso3: string;
  year: number;
  total_reported_exports_usd: number;
  total_reported_imports_usd: number;
  reported_trade_balance_usd: number;
  trade_concentration_hhi: number;
  is_complete_national_statistic: boolean;
  coverage_scope: string;
  coverage_disclaimer: string;
  top_export_partners: Array<{ partner_iso3: string; trade_value_usd: number; flow_direction: string }>;
  top_import_partners: Array<{ partner_iso3: string; trade_value_usd: number; flow_direction: string }>;
}

export interface CorridorMetrics {
  source_iso3: string;
  target_iso3: string;
  year: number;
  reported_export_fob_usd?: number;
  reported_import_cif_usd?: number;
  trade_volume_billions?: number;
  perspective: string;
  source_dataset: string;
  coverage_disclaimer: string;
}

/**
 * Fetch global bilateral trade network.
 * Pass year to filter by Historical Simulation Replay year.
 */
export function useGlobalNetwork(year?: number) {
  return useQuery({
    queryKey: ['graph', 'network', year ?? 'all'],
    queryFn: async () => {
      const params = year ? { year: String(year) } : {};
      const response = await apiClient.get<GraphResponse>('/graph/network', { params });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCentrality() {
  return useQuery({
    queryKey: ['graph', 'centrality'],
    queryFn: async () => {
      const response = await apiClient.get<CentralityRank[]>('/graph/centrality');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Fetch neighbors of an ISO3 node up to `depth` hops.
 */
export function useGraphNeighbors(nodeId: string | null, depth: number = 1) {
  return useQuery({
    queryKey: ['graph', 'neighbors', nodeId, depth],
    queryFn: async () => {
      if (!nodeId) return { nodes: [], edges: [] };
      const response = await apiClient.get<GraphResponse>(`/graph/neighbors/${nodeId}`, {
        params: { depth: String(depth) }
      });
      return response.data;
    },
    enabled: Boolean(nodeId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch shortest trade path between two ISO3 nodes.
 */
export function useShortestPath(sourceId: string | null, targetId: string | null) {
  return useQuery({
    queryKey: ['graph', 'path', sourceId, targetId],
    queryFn: async () => {
      if (!sourceId || !targetId) return { nodes: [], edges: [] };
      const response = await apiClient.get<GraphResponse>('/graph/path', {
        params: { source: sourceId, target: targetId }
      });
      return response.data;
    },
    enabled: Boolean(sourceId && targetId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch verified country trade metrics and market concentration.
 */
export function useCountryMetrics(countryIso3: string | null, year: number = 2022) {
  return useQuery({
    queryKey: ['graph', 'metrics', countryIso3, year],
    queryFn: async () => {
      if (!countryIso3) return null;
      const response = await apiClient.get<TradeMetrics>(`/graph/metrics/${countryIso3}`, {
        params: { year: String(year) }
      });
      return response.data;
    },
    enabled: Boolean(countryIso3),
    staleTime: 5 * 60 * 1000,
  });
}
