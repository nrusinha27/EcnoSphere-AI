/**
 * Phase 22 — Graph React Query Hooks
 * =====================================
 * Changes:
 *   - useGlobalNetwork(year?) now passes year query param to /graph/network
 *     enabling Historical Simulation Replay timeline (TN-06 fix)
 *   - Added useGraphNeighbors(nodeId, depth) — wires backend /graph/neighbors/{id}
 *   - Added useShortestPath(source, target) — wires backend /graph/path
 *   - GraphEdgeProperties now includes tradeVolume, importVolume, netBalance fields
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
  id: string;       // Sovereign ISO3 code (e.g. "USA") — Phase 22 standardized
  label: string;
  properties: GraphNodeProperties;
}

export interface GraphEdgeProperties {
  commodity_id?: string;
  commodity_category?: string;
  year?: number;
  tradeVolume?: number;       // Export value in billions USD
  importVolume?: number;      // Import value in billions USD
  netBalance?: number;        // Net trade balance in billions USD
  dependencyScore?: number;
  growth?: number;
  joined_year?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;  // ISO3 code
  target: string;  // ISO3 code
  type: string;
  properties: GraphEdgeProperties;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CentralityRank {
  node_id: string;  // ISO3 code
  score: number;
}

/**
 * Fetch global bilateral trade network.
 * Pass year to filter by Historical Simulation Replay year (TN-06).
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
    retry: 1,  // Single retry before failing gracefully
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
 * Only fetches when nodeId is non-empty.
 */
export function useGraphNeighbors(nodeId: string | null, depth: number = 1) {
  return useQuery({
    queryKey: ['graph', 'neighbors', nodeId, depth],
    queryFn: async () => {
      const response = await apiClient.get<GraphResponse>(`/graph/neighbors/${nodeId}`, {
        params: { depth: String(depth) }
      });
      return response.data;
    },
    enabled: Boolean(nodeId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Find shortest trade path between two ISO3 nodes.
 * Only fetches when both source and target are provided.
 */
export function useShortestPath(source: string | null, target: string | null) {
  return useQuery({
    queryKey: ['graph', 'path', source, target],
    queryFn: async () => {
      const response = await apiClient.get<GraphResponse>('/graph/path', {
        params: { source, target }
      });
      return response.data;
    },
    enabled: Boolean(source && target && source !== target),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
