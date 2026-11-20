'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useGlobalNetwork, useCentrality, GraphNode } from '@/hooks/useGraph';
import { Search, Filter, Activity, TrendingUp, AlertTriangle, ArrowLeft, Globe, ShieldCheck, ArrowUpDown, Scale } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

// Dynamically import Cytoscape since it requires window
const TradeGraph = dynamic(() => import('@/components/charts/TradeGraph'), { ssr: false });

// ---------------------------------------------------------------------------
// Currency formatter — fixes TN-11 (raw float concatenation bug)
// ---------------------------------------------------------------------------
function formatTradeCurrency(valueBillions: number | undefined): string {
  if (valueBillions === undefined || valueBillions === null || isNaN(valueBillions)) return '—';
  const abs = Math.abs(valueBillions);
  const sign = valueBillions < 0 ? '−' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`;
  if (abs >= 1) return `${sign}$${abs.toFixed(1)}B`;
  if (abs >= 0.001) return `${sign}$${(abs * 1000).toFixed(0)}M`;
  return `${sign}$${(abs * 1e6).toFixed(0)}K`;
}

function formatTradeVolumeLarge(valueBillions: number): string {
  if (valueBillions >= 1000) return `$${(valueBillions / 1000).toFixed(1)}T`;
  if (valueBillions > 0) return `$${valueBillions.toFixed(1)}B`;
  return '—';
}

// ---------------------------------------------------------------------------
// Trade Network Page (Phase 22)
// ---------------------------------------------------------------------------
export default function TradeNetworkPage() {
  // TN-06 FIX: timelineYear is now passed to useGlobalNetwork for real year filtering
  const [timelineYear, setTimelineYear] = useState(2022);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Pass year to the hook — graph will re-fetch on year change
  const { data: graph, isLoading, isError, error, refetch } = useGlobalNetwork(timelineYear);
  const { data: centrality, isLoading: centralityLoading } = useCentrality();

  // TN-11 FIX: Dynamic metric calculation with proper currency formatting (no hardcoded strings)
  const { totalTradeVolume, avgSupplyRisk, totalNetBalance, connectedPartners } = useMemo(() => {
    if (!graph || !graph.nodes.length) {
      return { totalTradeVolume: '—', avgSupplyRisk: '—', totalNetBalance: '—', connectedPartners: [] };
    }

    let totalVol = 0;
    let totalNet = 0;
    let totalRisk = 0;
    let riskCount = 0;

    graph.edges.forEach(e => {
      // tradeVolume is in billions USD
      const vol = Number(e.properties.tradeVolume) || 0;
      const net = Number(e.properties.netBalance) || 0;
      totalVol += vol;
      totalNet += net;
    });

    graph.nodes.forEach(n => {
      if (typeof n.properties.risk === 'number') {
        totalRisk += n.properties.risk;
        riskCount += 1;
      }
    });

    // TN-12 FIX: Calculate trade balance metric
    const formattedNet = totalNet >= 0
      ? `+${formatTradeVolumeLarge(totalNet)}`
      : `−${formatTradeVolumeLarge(Math.abs(totalNet))}`;

    // Get connected partners if a node is selected
    const partners: Array<{ id: string; name: string; type: string; direction: string; volume?: number; importVol?: number; netBalance?: number }> = [];
    if (selectedNode && graph) {
      graph.edges.forEach(e => {
        if (e.source === selectedNode.id || e.target === selectedNode.id) {
          const isSource = e.source === selectedNode.id;
          const partnerId = isSource ? e.target : e.source;
          const partnerNode = graph.nodes.find(n => n.id === partnerId);
          partners.push({
            id: partnerId,
            name: String(partnerNode?.properties.name || partnerId),
            type: isSource ? 'EXPORTS_TO' : 'IMPORTS_FROM',
            direction: isSource ? 'Outgoing' : 'Incoming',
            volume: Number(e.properties.tradeVolume) || undefined,
            importVol: Number(e.properties.importVolume) || undefined,
            netBalance: Number(e.properties.netBalance) || undefined,
          });
        }
      });
      // Sort by volume descending
      partners.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    }

    return {
      totalTradeVolume: totalVol > 0 ? formatTradeVolumeLarge(totalVol) : '—',
      avgSupplyRisk: riskCount > 0 ? `${Math.round((totalRisk / riskCount) * 100)}%` : '—',
      totalNetBalance: formattedNet,
      connectedPartners: partners,
    };
  }, [graph, selectedNode]);

  // TN-03 FIX (frontend side): influencer click now works because node IDs are ISO3
  const topInfluencers = useMemo(() => {
    if (centrality && centrality.length > 0) {
      return centrality.slice(0, 6).map((c) => {
        // c.node_id is ISO3 (e.g. "USA") — matches graph node IDs (Phase 22 aligned)
        const node = graph?.nodes.find(n => n.id === c.node_id);
        const name = node ? String(node.properties.name || node.id) : c.node_id;
        const maxScore = centrality[0]?.score || 1;
        const percentage = Math.max(12, Math.round((c.score / maxScore) * 100));
        return { name, score: c.score, percentage, id: c.node_id };
      });
    }
    // No centrality data — derive from graph edges (fallback)
    if (graph && graph.edges.length > 0) {
      const outDegree: Record<string, number> = {};
      graph.edges.forEach(e => {
        if (e.type === 'EXPORTS_TO') {
          outDegree[e.source] = (outDegree[e.source] || 0) + 1;
        }
      });
      const sorted = Object.entries(outDegree)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const maxDeg = sorted[0]?.[1] || 1;
      return sorted.map(([iso3, deg]) => {
        const node = graph.nodes.find(n => n.id === iso3);
        return {
          name: String(node?.properties.name || iso3),
          score: deg,
          percentage: Math.round((deg / maxDeg) * 100),
          id: iso3,
        };
      });
    }
    return [];
  }, [centrality, graph]);

  const toggleCategoryFilter = useCallback((cat: string) => {
    setCategoryFilter(current => current === cat ? null : cat);
  }, []);

  const handleInfluencerClick = useCallback((countryId: string) => {
    // ISO3 node IDs now match — selection will work (TN-03 fixed at backend + frontend)
    const matched = graph?.nodes.find(n => n.id === countryId);
    if (matched) setSelectedNode(matched);
  }, [graph]);

  // Risk color
  const riskColor = (riskPct: number) => {
    if (riskPct < 25) return 'text-emerald-600 dark:text-emerald-400';
    if (riskPct < 45) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full gap-4 p-2">

      {/* Top Bar: Live Search & Filters */}
      <div className="flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="trade-network-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries, blocs..."
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

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium mr-1">Filter Type:</span>
          <Button
            id="filter-country"
            variant={categoryFilter === 'Country' ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategoryFilter('Country')}
            className="flex items-center gap-2 text-xs cursor-pointer h-9"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            Country
          </Button>
          <Button
            id="filter-bloc"
            variant={categoryFilter === 'EconomicBloc' ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategoryFilter('EconomicBloc')}
            className="flex items-center gap-2 text-xs cursor-pointer h-9"
          >
            <Activity className="w-3.5 h-3.5 text-violet-500" />
            Economic Bloc
          </Button>
          <Button
            id="filter-commodity"
            variant={categoryFilter === 'Commodity' ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategoryFilter('Commodity')}
            className="flex items-center gap-2 text-xs cursor-pointer h-9"
          >
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            Commodity
          </Button>
          {(searchQuery || categoryFilter) && (
            <Button
              id="reset-filters"
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setCategoryFilter(null); }}
              className="text-xs text-gray-500 hover:text-red-500 h-9 px-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Middle Section: Graph & Analytics */}
      <div className="flex-1 flex gap-4 min-h-0 relative">

        {/* Left: Trade Graph Canvas */}
        <div className="flex-1 relative min-h-[450px]">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-950/80 rounded-xl z-20 backdrop-blur-sm border border-gray-200 dark:border-gray-800">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Loading {timelineYear} trade network...</span>
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
                title="Empty Trade Network"
                description="No bilateral trade data was found for the selected year. Try a different year on the timeline."
                action={{ label: 'Refresh Network', onClick: refetch }}
              />
            </div>
          )}

          {graph && graph.nodes.length > 0 && (
            <TradeGraph
              nodes={graph.nodes}
              edges={graph.edges}
              onNodeSelect={setSelectedNode}
              filterQuery={searchQuery}
              categoryFilter={categoryFilter}
            />
          )}
        </div>

        {/* Right: Analytics & Node Inspector Sidebar */}
        <div className="w-80 flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 overflow-y-auto shadow-sm flex flex-col gap-6">
          {selectedNode ? (
            /* Selected Node Inspector */
            <div className="flex flex-col gap-5">
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
                <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800 mb-2">
                  {selectedNode.label}
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {String(selectedNode.properties.name || selectedNode.id)}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">ISO3: {selectedNode.id}</p>
                {selectedNode.properties.region && (
                  <p className="text-xs text-gray-500 mt-0.5">{String(selectedNode.properties.region)}</p>
                )}
              </div>

              {/* Node KPIs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block mb-1">Trade Partners</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{connectedPartners.length}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 block mb-1">Supply Risk</span>
                  <span className={`text-lg font-bold ${riskColor(typeof selectedNode.properties.risk === 'number' ? Math.round(selectedNode.properties.risk * 100) : 20)}`}>
                    {typeof selectedNode.properties.risk === 'number' ? `${Math.round(selectedNode.properties.risk * 100)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Connected Partners List — TN-11 fixed currency format */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2.5">
                  Trade Links ({connectedPartners.length})
                </h3>
                {connectedPartners.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No direct links found in current network.</p>
                ) : (
                  <ul className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {connectedPartners.map((link, idx) => (
                      <li key={idx} className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-gray-900 dark:text-white font-semibold truncate max-w-[150px]">{link.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${link.direction === 'Outgoing' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'}`}>
                            {link.direction}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {link.volume !== undefined ? formatTradeCurrency(link.volume) : '—'}
                          </span>
                          {/* TN-12: Trade balance shown per partner */}
                          {link.netBalance !== undefined && (
                            <span className={`font-semibold ${link.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {link.netBalance >= 0 ? '+' : '−'}{formatTradeCurrency(Math.abs(link.netBalance))}
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
            <div className="flex flex-col gap-6 h-full">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Global Analytics
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {timelineYear} bilateral trade network metrics
                </p>
              </div>

              {/* KPI Cards — TN-11, TN-12 fixed */}
              <div className="grid gap-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Export Volume</span>
                  </div>
                  <p id="kpi-total-volume" className="text-2xl font-bold text-gray-900 dark:text-white">{totalTradeVolume}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Avg Risk</span>
                    </div>
                    <p id="kpi-avg-risk" className="text-xl font-bold text-gray-900 dark:text-white">{avgSupplyRisk}</p>
                  </div>
                  {/* TN-12 FIX: Trade balance metric card */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Scale className="w-3.5 h-3.5 text-teal-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Net Balance</span>
                    </div>
                    <p id="kpi-net-balance" className="text-xl font-bold text-gray-900 dark:text-white">{totalNetBalance}</p>
                  </div>
                </div>
              </div>

              {/* Top Network Influencers — TN-03 fix (click now works) */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Top Network Influencers</h3>
                  {centralityLoading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent animate-spin rounded-full" />}
                </div>
                <ul className="space-y-2.5">
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

              <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2 text-gray-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-none" />
                <p className="text-[11px] leading-tight">
                  Click any country or influencer to inspect bilateral trade links and net balance.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Timeline Slider — TN-06 FIX: now connected to year-filtered network query */}
      <div className="flex-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex flex-col gap-2">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Historical Trade Replay</span>
          </div>
          <span id="timeline-year-display" className="text-sm font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            {timelineYear}
          </span>
        </div>
        <input
          id="timeline-slider"
          type="range"
          min="2015"
          max="2025"
          value={timelineYear}
          onChange={(e) => {
            // TN-06 FIX: changing year now triggers a re-fetch via useGlobalNetwork(timelineYear)
            setTimelineYear(parseInt(e.target.value));
          }}
          className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between px-1 text-[10px] text-gray-400 font-mono">
          {[2015, 2017, 2019, 2021, 2023, 2025].map(y => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
