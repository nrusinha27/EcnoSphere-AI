'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { BarChart3, Info } from 'lucide-react';
import type { CountryComparisonProfile } from '@/lib/api/compare';
import { COUNTRY_COLORS } from './compareConstants';

interface GDPComparisonChartProps {
  countries: CountryComparisonProfile[];
}

export function GDPComparisonChart({ countries }: GDPComparisonChartProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  const chartData = countries.map((c, idx) => {
    const gdp = c.latest_indicators.gdp_growth_pct;
    return {
      name: c.country_name,
      code: c.country_code,
      value: gdp?.value !== null && gdp?.value !== undefined ? gdp.value : null,
      year: gdp?.year || 'N/A',
      color: COUNTRY_COLORS[idx % COUNTRY_COLORS.length],
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params;
        const item = chartData[p.dataIndex];
        if (!item) return '';
        const valStr =
          item.value !== null ? `${item.value > 0 ? '+' : ''}${item.value.toFixed(2)}%` : 'Data Unavailable';
        return `
          <div style="font-family: inherit; font-size: 12px; padding: 2px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: ${item.color};">
              ${item.name} (${item.code})
            </div>
            <div>Latest Real GDP Growth: <strong>${valStr}</strong></div>
            <div style="color: #888; font-size: 11px; margin-top: 2px;">Observed Year: ${item.year}</div>
            <div style="color: #888; font-size: 10px;">Source: World Bank WDI</div>
          </div>
        `;
      },
    },
    grid: {
      top: 30,
      right: 25,
      bottom: 40,
      left: 50,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.map((d) => `${d.code}\n(${d.year})`),
      axisLabel: {
        color: isDark ? '#9ca3af' : '#4b5563',
        fontSize: 11,
        lineHeight: 14,
      },
      axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
      axisTick: { alignWithLabel: true },
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
      {
        name: 'Real GDP Growth',
        type: 'bar',
        barWidth: '35%',
        data: chartData.map((d) => ({
          value: d.value,
          itemStyle: {
            color: d.color,
            borderRadius: [4, 4, 0, 0],
          },
        })),
        markLine: {
          symbol: 'none',
          data: [{ yAxis: 0, lineStyle: { color: isDark ? '#6b7280' : '#9ca3af', width: 1.5 } }],
          label: { show: false },
        },
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Latest Real GDP Growth Comparison
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cross-country snapshot of most recently reported annual growth rates
            </p>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} />
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
        <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span>
          Note: Growth rates reflect the latest authentic reporting year available in the World Bank WDI dataset per economy.
        </span>
      </div>
    </div>
  );
}
