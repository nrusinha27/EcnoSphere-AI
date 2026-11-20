'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { useTheme } from 'next-themes';
import { GraphNode, GraphEdge } from '@/hooks/useGraph';

interface TradeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode | null) => void;
  filterQuery?: string;
  categoryFilter?: string | null;
}

/**
 * Phase 22 fixes applied:
 *  TN-04: Edge dimming logic FIXED — edges visible at 0.6 opacity by default
 *  TN-07: Dynamic edge width via mapData(tradeVolume) — major corridors appear thicker
 *  TN-09: Layout randomize: false — stable positions on filter/search changes
 */
export default function TradeGraph({ nodes, edges, onNodeSelect, filterQuery, categoryFilter }: TradeGraphProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // Keep stable node positions after initial layout to prevent re-randomization (TN-09)
  const layoutDoneRef = useRef(false);

  const elements = useMemo(() => {
    const hasActiveFilter = Boolean(filterQuery || categoryFilter);
    const visibleNodeIds = new Set<string>();

    const cyNodes = nodes.map(node => {
      const label = String(node.properties.name || node.id);
      const matchesSearch = !filterQuery || label.toLowerCase().includes(filterQuery.toLowerCase()) || node.id.toLowerCase().includes(filterQuery.toLowerCase());
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
      // TN-04 FIX: Edge is only dimmed when a filter IS active AND neither endpoint is visible
      // Previously: !hasActiveFilter (inverted — dimmed everything by default)
      // Fixed:       hasActiveFilter && (neither endpoint visible)
      const edgeDimmed = hasActiveFilter && (!visibleNodeIds.has(edge.source) && !visibleNodeIds.has(edge.target));

      // Normalize tradeVolume to billions for mapData selector
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

    // Reset layout lock when nodes change (new year/data loaded)
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
        'background-color': '#3b82f6',
        'width': 28,
        'height': 28,
        'border-width': 2,
        'border-color': isDark ? '#1e3a8a' : '#bfdbfe',
        'transition-property': 'opacity',
        'transition-duration': 0.2
      }
    },
    {
      selector: 'node[category = "Country"]',
      style: {
        'background-color': '#10b981',
        'shape': 'ellipse',
      }
    },
    {
      selector: 'node[category = "Commodity"]',
      style: {
        'background-color': '#f59e0b',
        'shape': 'hexagon',
      }
    },
    {
      selector: 'node[category = "EconomicBloc"]',
      style: {
        'background-color': '#8b5cf6',
        'shape': 'round-rectangle',
        'width': 40,
        'height': 22,
      }
    },
    {
      selector: 'node[dimmed = "true"]',
      style: {
        'opacity': 0.12,
      }
    },
    {
      // TN-07 FIX: Dynamic edge width based on tradeVolume (billions USD)
      // mapData(tradeVolume, min, max, minWidth, maxWidth)
      // 0B = 1.5px, 600B (USA-CHN) ≈ 10px
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
      selector: 'edge[label = "MEMBER_OF"]',
      style: {
        'line-color': isDark ? '#8b5cf6' : '#a78bfa',
        'target-arrow-color': isDark ? '#8b5cf6' : '#a78bfa',
        'line-style': 'dashed',
        'width': 1.5,
      }
    },
    {
      // TN-04 FIX: Only dimmed edges use low opacity — default edges at 0.6
      selector: 'edge[dimmed = "true"]',
      style: {
        'opacity': 0.08,
      }
    }
  ];

  const handleCyRef = useCallback((cy: cytoscape.Core) => {
    cy.off('tap', 'node');
    cy.off('tap');

    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      if (onNodeSelect) {
        // Node id is already ISO3 (e.g. "USA") — direct match guaranteed (TN-03 fixed at backend)
        const matched = nodes.find(n => n.id === nodeData.id);
        onNodeSelect(matched || null);
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy && onNodeSelect) {
        onNodeSelect(null);
      }
    });

    // TN-09: After initial layout completes, lock positions to prevent re-randomization
    cy.one('layoutstop', () => {
      layoutDoneRef.current = true;
    });
  }, [nodes, onNodeSelect]);

  return (
    <div className="relative w-full h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Visual Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white/85 dark:bg-gray-900/85 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-md flex flex-col gap-2">
        <span className="font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Network Nodes</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
          <span className="text-gray-600 dark:text-gray-300">Country</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-amber-500 inline-block rotate-45" />
          <span className="text-gray-600 dark:text-gray-300">Commodity</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-2.5 rounded-sm bg-violet-500 inline-block" />
          <span className="text-gray-600 dark:text-gray-300">Economic Bloc</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-0.5">
          <span className="font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Edge Width</span>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 bg-blue-400 rounded" />
            <span className="text-gray-500 dark:text-gray-400">Minor flow</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-2 w-4 bg-blue-500 rounded" />
            <span className="text-gray-500 dark:text-gray-400">Major corridor</span>
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
          // TN-09 FIX: randomize: false prevents layout reshuffling on filter/search
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
