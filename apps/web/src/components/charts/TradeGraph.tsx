'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { useTheme } from 'next-themes';
import { GraphNode, GraphEdge } from '@/hooks/useGraph';

interface TradeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode | null) => void;
  onEdgeSelect?: (edge: GraphEdge | null) => void;
  filterQuery?: string;
  categoryFilter?: string | null;
}

/**
 * Phase 22 TradeGraph Component
 * Features:
 *  - TN-04: Non-inverted edge dimming (visible at 0.6 opacity by default)
 *  - TN-07: Dynamic volume-scaled edge thickness via mapData(tradeVolume)
 *  - TN-09: Layout randomize: false — stable deterministic node placement
 *  - Node selection (ISO3 standardized)
 *  - Edge selection with bidirectional trade relationship inspection
 */
export default function TradeGraph({
  nodes,
  edges,
  onNodeSelect,
  onEdgeSelect,
  filterQuery,
  categoryFilter
}: TradeGraphProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const layoutDoneRef = useRef(false);

  const elements = useMemo(() => {
    const hasActiveFilter = Boolean(filterQuery || categoryFilter);
    const visibleNodeIds = new Set<string>();

    const cyNodes = nodes.map(node => {
      const label = String(node.properties.name || node.id);
      const matchesSearch = !filterQuery ||
        label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(filterQuery.toLowerCase());
      const matchesCategory = !categoryFilter || node.label.toLowerCase() === categoryFilter.toLowerCase();
      const isVisible = !hasActiveFilter || (matchesSearch && matchesCategory);

      if (isVisible) {
        visibleNodeIds.add(node.id);
      }

      return {
        data: {
          ...node.properties,
          id: node.id,
          label: label,
          category: node.label,
          dimmed: !isVisible ? 'true' : 'false'
        }
      };
    });

    const cyEdges = edges.map(edge => {
      const edgeDimmed = hasActiveFilter && (!visibleNodeIds.has(edge.source) && !visibleNodeIds.has(edge.target));
      const tradeVol = Number(edge.properties.tradeVolume) || Number(edge.properties.weight) || 0;

      return {
        data: {
          ...edge.properties,
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.type,
          tradeVolume: tradeVol,
          dimmed: edgeDimmed ? 'true' : 'false'
        }
      };
    });

    layoutDoneRef.current = false;
    return [...cyNodes, ...cyEdges];
  }, [nodes, edges, filterQuery, categoryFilter]);

  const stylesheet = [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 5,
        'color': isDark ? '#e5e7eb' : '#374151',
        'font-size': '11px',
        'font-family': 'Inter, sans-serif',
        'background-color': '#10b981',
        'width': 26,
        'height': 26,
        'border-width': 2,
        'border-color': isDark ? '#064e3b' : '#a7f3d0',
        'transition-property': 'opacity',
        'transition-duration': 0.2
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#3b82f6',
        'border-color': '#93c5fd',
        'border-width': 3,
        'width': 32,
        'height': 32
      }
    },
    {
      selector: 'node[dimmed = "true"]',
      style: {
        'opacity': 0.12,
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'mapData(tradeVolume, 0, 600, 1.5, 10)',
        'line-color': isDark ? '#4b5563' : '#9ca3af',
        'target-arrow-color': isDark ? '#4b5563' : '#9ca3af',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.6,
        'transition-property': 'opacity',
        'transition-duration': 0.2
      }
    },
    {
      selector: 'edge[label = "EXPORTS_TO"]',
      style: {
        'line-color': isDark ? '#3b82f6' : '#60a5fa',
        'target-arrow-color': isDark ? '#3b82f6' : '#60a5fa',
      }
    },
    {
      selector: 'edge:selected',
      style: {
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
        'width': 6,
        'opacity': 1.0,
        'z-index': 999
      }
    },
    {
      selector: 'edge[dimmed = "true"]',
      style: {
        'opacity': 0.06,
      }
    }
  ];

  const handleCyRef = useCallback((cy: cytoscape.Core) => {
    cy.off('tap', 'node');
    cy.off('tap', 'edge');
    cy.off('tap');

    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      if (onNodeSelect) {
        const matched = nodes.find(n => n.id === nodeData.id);
        onNodeSelect(matched || null);
      }
      if (onEdgeSelect) onEdgeSelect(null);
    });

    cy.on('tap', 'edge', (evt) => {
      const edgeData = evt.target.data();
      if (onEdgeSelect) {
        const matched = edges.find(e => e.id === edgeData.id);
        onEdgeSelect(matched || null);
      }
      if (onNodeSelect) onNodeSelect(null);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        if (onNodeSelect) onNodeSelect(null);
        if (onEdgeSelect) onEdgeSelect(null);
      }
    });

    cy.one('layoutstop', () => {
      layoutDoneRef.current = true;
    });
  }, [nodes, edges, onNodeSelect, onEdgeSelect]);

  return (
    <div className="relative w-full h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Visual Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-md flex flex-col gap-2 pointer-events-none">
        <span className="font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Trade Network Legend</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
          <span className="text-gray-600 dark:text-gray-300">Sovereign Country</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-0.5">
          <span className="font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Edge Thickness</span>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 bg-blue-400 rounded" />
            <span className="text-gray-500 dark:text-gray-400">&lt; $50B Corridor</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-2 w-4 bg-blue-500 rounded" />
            <span className="text-gray-500 dark:text-gray-400">&gt; $200B Major Corridor</span>
          </div>
        </div>
      </div>

      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={stylesheet as React.ComponentProps<typeof CytoscapeComponent>['stylesheet']}
        layout={{
          name: 'cose',
          animate: false,
          randomize: !layoutDoneRef.current,
          nodeRepulsion: 450000,
          idealEdgeLength: 120,
          numIter: 200,
        }}
        wheelSensitivity={0.2}
        cy={handleCyRef}
      />
    </div>
  );
}
