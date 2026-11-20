'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useGlobalNetwork, useCentrality, GraphNode, GraphEdge } from '@/hooks/useGraph';
import { Search, Globe, ShieldCheck, ArrowUpDown, TrendingUp, ArrowLeft, ArrowRight, Layers, AlertCircle, Info } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

// Dynamically import Cytoscape since it requires window
const TradeGraph = dynamic(() => import('@/components/charts/TradeGraph'), { ssr: false });

function formatTradeCurrency(valueBillions: number | undefined): string {
  if (valueBillions === undefined || valueBillions === null || isNaN(valueBillions)) return '—';
  const abs = Math.abs(valueBillions);
  const sign = valueBillions < 0 ? '−' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`;
  if (abs >= 1) return `${sign}$${abs.toFixed(1)}B`;
  if (abs >= 0.001) return `${sign}$${(abs * 1000).toFixed(0)}M`;
  return `${sign}$${(abs * 1e6).toFixed(0)}K`;
}

function formatUSDExact(valUSD: number | undefined): string {
  if (valUSD === undefined || valUSD === null || isNaN(valUSD)) return '—';
  if (valUSD >= 1e12) return `$${(valUSD / 1e12).toFixed(2)}T`;
  if (valUSD >= 1e9) return `$${(valUSD / 1e9).toFixed(2)}B`;
  if (valUSD >= 1e6) return `$${(valUSD / 1e6).toFixed(1)}M`;
  return `$${valUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function TradeNetworkPage() {
  const [timelineYear, setTimelineYear] = useState(2022);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Fetch verified network filtered by timeline year
  const { data: graph, isLoading, isError, error, refetch } = useGlobalNetwork(timelineYear);
  const { data: centrality, isLoading: centralityLoading } = useCentrality();

  // Dynamic calculations from verified graph data
  const { totalTradeVolume, totalEdgesCount, connectedPartners, nodeNetBalance } = useMemo(() => {
    if (!graph || !graph.nodes.length) {
      return { totalTradeVolume: '—', totalEdgesCount: 0, connectedPartners: [], nodeNetBalance: '—' };
    }

    let totalVol = 0;
    graph.edges.forEach(e => {
      const vol = Number(e.properties.tradeVolume) || 0;
      totalVol += vol;
    });

    let nodeExports = 0;
    let nodeImports = 0;
    const partners: Array<{
      id: string;
      name: string;
      type: string;
      direction: string;
      volume?: number;
      exportUSD?: number;
      importUSD?: number;
    }> = [];

    if (selectedNode && graph) {
      graph.edges.forEach(e => {
        if (e.source === selectedNode.id || e.target === selectedNode.id) {
          const isSource = e.source === selectedNode.id;
          const partnerId = isSource ? e.target : e.source;
          const partnerNode = graph.nodes.find(n => n.id === partnerId);
          const expVal = typeof e.properties.export_value_usd === 'number' ? e.properties.export_value_usd : 0;
          const impVal = typeof e.properties.import_value_usd === 'number' ? e.properties.import_value_usd : 0;
          if (isSource) {
            nodeExports += expVal;
          } else {
            nodeImports += impVal;
          }
          partners.push({
            id: partnerId,
            name: String(partnerNode?.properties.name || partnerId),
            type: 'EXPORTS_TO',
            direction: isSource ? 'Export Outgoing' : 'Import Incoming',
            volume: Number(e.properties.tradeVolume) || undefined,
            exportUSD: typeof e.properties.export_value_usd === 'number' ? e.properties.export_value_usd : undefined,
            importUSD: typeof e.properties.import_value_usd === 'number' ? e.properties.import_value_usd : undefined,
          });
        }
      });
      partners.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    }

    const netBalVal = nodeExports - nodeImports;
    const nodeNetBalance = (nodeExports > 0 || nodeImports > 0)
      ? formatUSDExact(netBalVal)
      : '—';

    return {
      totalTradeVolume: totalVol > 0 ? formatTradeCurrency(totalVol) : '—',
      totalEdgesCount: graph.edges.length,
      connectedPartners: partners,
      nodeNetBalance,
    };
  }, [graph, selectedNode]);

  // Top influencers derived from verified out-degree centrality
  const topInfluencers = useMemo(() => {
    if (centrality && centrality.length > 0) {
      const maxScore = centrality[0]?.score || 1;
      return centrality.slice(0, 7).map((c) => {
        const node = graph?.nodes.find(n => n.id === c.node_id);
        const name = node ? String(node.properties.name || node.id) : c.node_id;
        const percentage = Math.max(12, Math.round((c.score / maxScore) * 100));
        return { name, score: c.score, percentage, id: c.node_id };
      });
    }
    return [];
  }, [centrality, graph]);

  const handleInfluencerClick = useCallback((countryId: string) => {
    const matched = graph?.nodes.find(n => n.id === countryId);
    if (matched) {
      setSelectedNode(matched);
      setSelectedEdge(null);
    }
  }, [graph]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full gap-4 p-2">

      {/* Top Bar: Search & Metadata Information */}
      <div className="flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="trade-network-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search country by name or ISO3 (e.g. USA, CHN, DEU)..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Dataset: <strong className="text-gray-700 dark:text-gray-200">UN Comtrade 2022 Preview</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Sample Nodes: <strong className="text-gray-700 dark:text-gray-200">{graph?.nodes.length || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Middle Section: Canvas & Sidebar Inspector */}
      <div className="flex-1 flex gap-4 min-h-0 relative">

        {/* Left: Interactive Canvas */}
        <div className="flex-1 relative min-h-[450px]">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-950/80 rounded-xl z-20 backdrop-blur-sm border border-gray-200 dark:border-gray-800">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Loading authentic {timelineYear} bilateral trade network...
              </span>
            </div>
          )}

          {isError && (
            <div className="w-full h-full flex items-center justify-center">
              <ErrorState
                title="Trade Network Unavailable"
                error={error}
                onRetry={refetch}
              />
            </div>
          )}

          {!isLoading && !isError && (!graph || (graph.nodes.length === 0 && graph.edges.length === 0)) && (
            <div className="w-full h-full flex items-center justify-center">
              <EmptyState
                title={`No Trade Data for ${timelineYear}`}
                description={`The verified UN Comtrade preview dataset currently covers calendar year 2022. No historical observations exist for ${timelineYear}. Use the timeline slider to switch to 2022.`}
                action={{ label: 'Switch to 2022', onClick: () => setTimelineYear(2022) }}
              />
            </div>
          )}

          {graph && graph.nodes.length > 0 && (
            <TradeGraph
              nodes={graph.nodes}
              edges={graph.edges}
              onNodeSelect={setSelectedNode}
              onEdgeSelect={setSelectedEdge}
              filterQuery={searchQuery}
            />
          )}
        </div>

        {/* Right: Analytics & Selection Inspector Sidebar */}
        <div className="w-84 flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 overflow-y-auto shadow-sm flex flex-col gap-5">
          {selectedEdge ? (
            /* Selected Corridor Edge Inspector */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEdge(null)}
                  className="p-0 h-auto text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
                </Button>
              </div>

              <div>
                <span className="inline-block px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800 mb-2">
                  Bilateral Trade Corridor
                </span>
                <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                  <span>{selectedEdge.source}</span>
                  <ArrowRight className="w-4 h-4 text-blue-500" />
                  <span>{selectedEdge.target}</span>
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">Year: {selectedEdge.properties.year || timelineYear}</p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                <span className="text-xs text-gray-500 font-medium">Primary Trade Volume</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTradeCurrency(Number(selectedEdge.properties.tradeVolume))}
                </span>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-500 block mb-0.5">Exporter Declaration (FOB):</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {formatUSDExact(Number(selectedEdge.properties.export_value_usd))}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-500 block mb-0.5">Importer Declaration (CIF):</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {formatUSDExact(Number(selectedEdge.properties.import_value_usd))}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-500 block mb-0.5">Corridor Net Balance:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {selectedEdge.properties.export_value_usd !== undefined && selectedEdge.properties.import_value_usd !== undefined
                      ? formatUSDExact(Number(selectedEdge.properties.export_value_usd) - Number(selectedEdge.properties.import_value_usd))
                      : '—'}
                  </span>
                </div>
                {Boolean(selectedEdge.properties.perspective) && (
                  <div className="p-2 text-[11px] text-gray-500 bg-gray-100/50 dark:bg-gray-800/50 rounded">
                    <strong>Perspective:</strong> {String(selectedEdge.properties.perspective)}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400 flex-none mt-0.5" />
                <span>Values preserve customs valuation differences (FOB vs. CIF) without artificial mirror balancing.</span>
              </div>
            </div>
          ) : selectedNode ? (
            /* Selected Country Inspector */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                <Button
                  id="back-to-global"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                  className="p-0 h-auto text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Global Analytics
                </Button>
              </div>

              <div>
                <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800 mb-2">
                  Sovereign Economy
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {String(selectedNode.properties.name || selectedNode.id)}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">ISO3: {selectedNode.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block mb-1">Observed Corridors</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{connectedPartners.length}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block mb-1">Net Balance</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white font-mono">{nodeNetBalance}</span>
                </div>
              </div>

              {/* Connected Corridors List */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">
                  Observed Corridors ({connectedPartners.length})
                </h3>
                {connectedPartners.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No direct bilateral corridors observed in preview sample.</p>
                ) : (
                  <ul className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {connectedPartners.map((link, idx) => (
                      <li key={idx} className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-gray-900 dark:text-white font-semibold truncate max-w-[150px]">{link.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${link.direction.includes('Export') ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'}`}>
                            {link.direction}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {link.volume !== undefined ? formatTradeCurrency(link.volume) : '—'}
                          </span>
                          {link.exportUSD !== undefined && (
                            <span className="text-[10px] font-mono text-gray-400">
                              FOB: {formatUSDExact(link.exportUSD)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            /* Global Overview */
            <div className="flex flex-col gap-5 h-full">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Global Analytics
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Calendar year {timelineYear} bilateral trade network
                </p>
              </div>

              {/* Sample Metrics Cards */}
              <div className="grid gap-2.5">
                <div className="p-3.5 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Observed Trade Volume</span>
                  </div>
                  <p id="kpi-total-volume" className="text-2xl font-bold text-gray-900 dark:text-white">{totalTradeVolume}</p>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Across observed preview corridors</span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Total Directed Corridors</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white font-mono">{totalEdgesCount}</span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Net Balance</span>
                  <span id="kpi-net-balance" className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-mono">Select country or corridor</span>
                </div>
              </div>

              {/* Top Trade Influencers */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Top Exporters (Corridors)</h3>
                  {centralityLoading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent animate-spin rounded-full" />}
                </div>
                <ul className="space-y-2">
                  {topInfluencers.map((country, idx) => (
                    <li
                      key={country.id}
                      id={`influencer-${country.id}`}
                      className="flex flex-col gap-1 cursor-pointer group p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleInfluencerClick(country.id)}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">
                          {idx + 1}. {country.name}
                        </span>
                        <span className="font-mono text-gray-400 text-[10px]">
                          {typeof country.score === 'number' ? country.score.toFixed(0) : country.score} links
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${country.percentage}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-800 flex items-start gap-2 text-gray-500">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-none mt-0.5" />
                <p className="text-[11px] leading-tight text-gray-500">
                  Click any country node or corridor edge to inspect authentic bilateral trade statistics.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Timeline Slider */}
      <div className="flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex flex-col gap-2">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Historical Trade Replay
            </span>
          </div>
          <span id="timeline-year-display" className="text-sm font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            {timelineYear} {timelineYear === 2022 ? '(Verified UN Comtrade Data)' : '(No Data Reported)'}
          </span>
        </div>
        <input
          id="timeline-slider"
          type="range"
          min="2015"
          max="2025"
          value={timelineYear}
          onChange={(e) => setTimelineYear(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between px-1 text-[10px] text-gray-400 font-mono">
          {[2015, 2017, 2019, 2021, 2022, 2023, 2025].map(y => (
            <span key={y} className={y === 2022 ? "font-bold text-blue-500" : ""}>{y}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
