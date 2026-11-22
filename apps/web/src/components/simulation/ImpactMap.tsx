'use client';
import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { ShieldCheck, Activity } from 'lucide-react';

interface ImpactMapProps {
  currentHorizon?: number;
  isRunning?: boolean;
  globalState?: Record<string, any>;
  activeShocks?: Record<string, any>;
}

const COUNTRY_LABELS: Record<string, string> = {
  USA: 'United States',
  CHN: 'China',
  IND: 'India',
  DEU: 'Germany',
  JPN: 'Japan',
  GBR: 'United Kingdom',
  FRA: 'France',
  BRA: 'Brazil',
  AUS: 'Australia',
  CAN: 'Canada'
};

export function ImpactMap({ currentHorizon = 0, isRunning = false, globalState, activeShocks }: ImpactMapProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full min-h-[450px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800" />;
  }

  // Frontend resilience: avoid silent zero fabrication when simulation snapshot data is pending or unavailable
  if (!globalState || Object.keys(globalState).length === 0) {
    return (
      <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-card rounded-xl border p-8 text-center space-y-4">
        <Activity className="w-12 h-12 text-primary animate-pulse" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Awaiting Live Simulation Stream</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {isRunning 
              ? `Computing macroeconomic equilibrium and trade shock transitions for Horizon Day ${currentHorizon}...`
              : "No active simulation snapshots ingested. Start a simulation run from the Command Center to visualize live quantitative outputs without fabricated demo values."}
          </p>
        </div>
      </div>
    );
  }

  // Derive dynamic economic stability scores directly from live backend simulation global_state and active_shocks
  const countryEntries = Object.entries(globalState);
  const data = countryEntries.slice(0, 10).map(([iso, metrics]: [string, any]) => {
    const rawGdp = Number(metrics?.gdp) || 0;
    const rawInflation = Number(metrics?.inflation) ?? 2.0;
    const rawUnemployment = Number(metrics?.unemployment) ?? 5.0;

    // Normalize percentages if received as whole numbers (e.g., 2.5% vs 0.025)
    const inflation = rawInflation > 1 ? rawInflation / 100 : rawInflation;
    const unemployment = rawUnemployment > 1 ? rawUnemployment / 100 : rawUnemployment;
    
    // Country-specific active shocks
    const shock = activeShocks?.[iso] || {};
    const exportReduction = Math.abs(Number(shock.export_reduction) || 0);
    const inflationSpike = Number(shock.inflation_increase) || 0;

    // Temporal crisis decay factor: Day 1-180 peak crisis, Day 365 50% recovery, Day 1095 90% recovery
    const recoveryRatio = currentHorizon <= 180 ? 0.0 : currentHorizon === 365 ? 0.50 : 0.90;
    const effectiveExportShock = exportReduction * (1.0 - recoveryRatio);
    const effectiveInfShock = inflationSpike * (1.0 - recoveryRatio);

    // Crisis stability model:
    // - Base normal stability: 82
    // - Export collapse penalty: up to 18-20 pts
    // - Inflation surge penalty: up to 15 pts
    // - Macro rate penalty: inflation above 2%
    // - GDP resilience benefit: (rawGdp - 1.25) * 14
    const exportPenalty = effectiveExportShock * 30.0;
    const infShockPenalty = effectiveInfShock * 22.0;
    const macroPenalty = Math.max(0, (inflation - 0.02) * 200.0);
    const unemploymentPenalty = Math.max(0, (unemployment - 0.05) * 120.0);
    const gdpResilience = rawGdp > 0 ? (rawGdp - 1.25) * 14.0 : 0;

    const score = Math.round(82 - exportPenalty - infShockPenalty - macroPenalty - unemploymentPenalty + gdpResilience);
    const val = Math.max(10, Math.min(100, score));
    
    return {
      name: iso,
      fullName: COUNTRY_LABELS[iso] || iso,
      value: val,
      metrics: {
        gdp: rawGdp,
        inflation,
        unemployment,
        exportReduction,
        inflationSpike
      },
      itemStyle: {
        color: val > 75 ? '#10b981' : val >= 60 ? '#f59e0b' : '#ef4444'
      }
    };
  });

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<any>) => {
        const item = params[0];
        const m = item?.data?.metrics || {};
        const fullName = item?.data?.fullName || item.name;
        const val = item.value;
        const statusBadge = val > 75
          ? '<span style="color:#10b981;font-weight:600;">● STABLE (Low Risk)</span>'
          : val >= 60
          ? '<span style="color:#f59e0b;font-weight:600;">● WATCH (Elevated Shock)</span>'
          : '<span style="color:#ef4444;font-weight:600;">● AT RISK (High Vulnerability)</span>';

        let shockDetails = '';
        if (m.exportReduction > 0) {
          shockDetails += `<div class="text-xs text-rose-400">Trade Shock: -${(m.exportReduction * 100).toFixed(0)}% exports</div>`;
        }
        if (m.inflationSpike > 0) {
          shockDetails += `<div class="text-xs text-amber-400">Price Shock: +${(m.inflationSpike * 100).toFixed(1)}% inflation surge</div>`;
        }
        if (!shockDetails) {
          shockDetails = '<div class="text-xs text-slate-400">Status: Nominal transmission channel</div>';
        }

        return `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-sm">${fullName} (${item.name})</div>
                <div class="mb-1 text-xs">${statusBadge}</div>
                <div class="text-xs">Stability Index: <span class="font-mono font-bold text-sm">${item.value}</span> / 100</div>
                <div class="border-t border-slate-800 my-1 pt-1 space-y-0.5">
                  <div class="text-xs text-slate-300">GDP Shock Index: <span class="font-mono">${Number(m.gdp || 0).toFixed(3)}</span></div>
                  <div class="text-xs text-slate-300">Annual Inflation: <span class="font-mono">${((m.inflation || 0) * 100).toFixed(2)}%</span></div>
                  ${shockDetails}
                </div>`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { color: isDark ? '#94a3b8' : '#475569', fontWeight: 600 },
      axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      name: 'Stability Index',
      nameTextStyle: { color: isDark ? '#94a3b8' : '#475569', padding: [0, 0, 0, 20] },
      axisLabel: { color: isDark ? '#94a3b8' : '#475569' },
      splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#e2e8f0', type: 'dashed' } }
    },
    series: [
      {
        name: 'Node Stability',
        type: 'bar',
        barWidth: '45%',
        data: data,
        label: {
          show: true,
          position: 'top',
          color: isDark ? '#e2e8f0' : '#1e293b',
          formatter: '{c}'
        },
        itemStyle: {
          borderRadius: [6, 6, 0, 0]
        }
      }
    ]
  };

  return (
    <div className="w-full h-full min-h-[450px] flex flex-col justify-between bg-card rounded-xl border p-6 relative overflow-hidden">
      <div className="flex justify-between items-center z-10 mb-2">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Global Shock Propagation Heatmap
          </h3>
          <p className="text-xs text-muted-foreground">
            {isRunning ? `Simulating live economic indicator shifts at Horizon Day ${currentHorizon}...` : "Displaying computed economic node stability from verified simulation state."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-emerald-500 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> &gt;75 Stable</span>
          <span className="flex items-center gap-1 text-amber-500 font-semibold"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/> 60-75 Watch</span>
          <span className="flex items-center gap-1 text-rose-500 font-semibold"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/> &lt;60 At Risk</span>
        </div>
      </div>
      <div className="w-full flex-1 min-h-[340px]">
        <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
      </div>
    </div>
  );
}
