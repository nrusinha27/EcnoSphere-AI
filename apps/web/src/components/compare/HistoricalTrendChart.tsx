'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { TrendingUp, ShieldCheck } from 'lucide-react';
import type { CountryComparisonProfile } from '@/lib/api/compare';
import { COUNTRY_COLORS } from './compareConstants';

interface HistoricalTrendChartProps {
  countries: CountryComparisonProfile[];
  commonYears: number[];
}

export function HistoricalTrendChart({ countries, commonYears }: HistoricalTrendChartProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  const years = commonYears.length > 0 ? commonYears : Array.from({ length: 16 }, (_, i) => 2010 + i);

  const series = countries.map((country, idx) => {
    const color = COUNTRY_COLORS[idx % COUNTRY_COLORS.length];
    const dataPointsMap = new Map<number, number | null>();
    country.historical_gdp_growth.forEach((pt) => {
      dataPointsMap.set(pt.year, pt.value);
    });

    const values = years.map((yr) => {
      const v = dataPointsMap.get(yr);
      return v !== undefined ? v : null;
    });

    return {
      name: `${country.country_name} (${country.country_code})`,
      type: 'line',
      data: values,
      smooth: true,
      // CRITICAL: Do not interpolate missing data
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5, color },
      itemStyle: { color },
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const year = params[0].axisValue;
        let out = `<div style="font-family: inherit; font-size: 12px; padding: 2px;">
          <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid ${
            isDark ? '#374151' : '#e5e7eb'
          }; padding-bottom: 3px;">
            Year: ${year}
          </div>`;
        params.forEach((p) => {
          const val = p.value !== null && p.value !== undefined ? `${p.value > 0 ? '+' : ''}${p.value.toFixed(2)}%` : 'Unavailable';
          out += `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 3px;">
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${p.color};"></span>
                <span>${p.seriesName}</span>
              </span>
              <strong>${val}</strong>
            </div>
          `;
        });
        out += `<div style="color: #888; font-size: 10px; margin-top: 5px;">Source: World Bank WDI</div></div>`;
        return out;
      },
    },
    legend: {
      data: series.map((s) => s.name),
      top: 5,
      textStyle: {
        color: isDark ? '#d1d5db' : '#374151',
        fontSize: 11,
      },
      icon: 'circle',
    },
    grid: {
      top: 55,
      right: 25,
      bottom: 30,
      left: 45,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
      axisLabel: {
        color: isDark ? '#9ca3af' : '#4b5563',
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
    },
    yAxis: {
      type: 'value',
      name: 'GDP Growth (%)',
      nameTextStyle: {
        color: isDark ? '#9ca3af' : '#6b7280',
        fontSize: 11,
      },
      axisLabel: {
        color: isDark ? '#9ca3af' : '#4b5563',
        formatter: '{value}%',
      },
      splitLine: {
        lineStyle: {
          color: isDark ? '#1f2937' : '#f3f4f6',
          type: 'dashed',
        },
      },
    },
    series: [
      ...series,
      {
        name: 'Zero Baseline',
        type: 'line',
        markLine: {
          symbol: 'none',
          data: [{ yAxis: 0, lineStyle: { color: isDark ? '#4b5563' : '#9ca3af', width: 1, type: 'dashed' } }],
          label: { show: false },
        },
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Historical Real GDP Growth Trajectory (2010 – 2025)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Comparative annual time-series tracking post-2010 expansions, contractions, and COVID-19 shocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Non-interpolated</span>
        </div>
      </div>

      <div className="h-[340px] w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} />
      </div>

      <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span>Authentic World Bank WDI historical panel. Gaps represent unobserved years.</span>
        <span className="font-mono text-[10px]">Zero interpolation applied</span>
      </div>
    </div>
  );
}
