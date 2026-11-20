'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { Activity, Users } from 'lucide-react';
import type { CountryComparisonProfile } from '@/lib/api/compare';
import { COUNTRY_COLORS } from './compareConstants';

interface MacroIndicatorChartsProps {
  countries: CountryComparisonProfile[];
}

export function MacroIndicatorCharts({ countries }: MacroIndicatorChartsProps) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  // --- Inflation Data ---
  const inflationData = countries.map((c, idx) => {
    const item = c.latest_indicators.inflation_cpi_pct;
    return {
      name: c.country_name,
      code: c.country_code,
      value: item?.value !== null && item?.value !== undefined ? item.value : null,
      year: item?.year || 'N/A',
      color: COUNTRY_COLORS[idx % COUNTRY_COLORS.length],
    };
  });

  // --- Unemployment Data ---
  const unemploymentData = countries.map((c, idx) => {
    const item = c.latest_indicators.unemployment_pct;
    return {
      name: c.country_name,
      code: c.country_code,
      value: item?.value !== null && item?.value !== undefined ? item.value : null,
      year: item?.year || 'N/A',
      color: COUNTRY_COLORS[idx % COUNTRY_COLORS.length],
    };
  });

  // Option generator for clean bar comparison
  const createBarOption = (
    data: typeof inflationData,
    indicatorLabel: string,
    unit: string
  ) => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const item = data[p.dataIndex];
          if (!item) return '';
          const valStr =
            item.value !== null ? `${item.value.toFixed(2)}${unit}` : 'Data Unavailable';
          return `
            <div style="font-family: inherit; font-size: 12px; padding: 2px;">
              <div style="font-weight: 600; margin-bottom: 3px; color: ${item.color};">
                ${item.name} (${item.code})
              </div>
              <div>${indicatorLabel}: <strong>${valStr}</strong></div>
              <div style="color: #888; font-size: 11px; margin-top: 2px;">Observed Year: ${item.year}</div>
              <div style="color: #888; font-size: 10px;">Source: World Bank WDI</div>
            </div>
          `;
        },
      },
      grid: {
        top: 25,
        right: 20,
        bottom: 35,
        left: 45,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => `${d.code}\n(${d.year})`),
        axisLabel: {
          color: isDark ? '#9ca3af' : '#4b5563',
          fontSize: 11,
          lineHeight: 14,
        },
        axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: isDark ? '#9ca3af' : '#4b5563',
          formatter: `{value}${unit}`,
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
          name: indicatorLabel,
          type: 'bar',
          barWidth: '35%',
          data: data.map((d) => ({
            value: d.value,
            itemStyle: {
              color: d.color,
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart 1: Inflation CPI */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Consumer Price Inflation (CPI)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Latest annual percentage change in consumer price indices
            </p>
          </div>
        </div>

        <div className="h-[250px] w-full">
          <ReactECharts
            option={createBarOption(inflationData, 'CPI Inflation', '%')}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        </div>

        <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between">
          <span>Target metric: Annual % change</span>
          <span className="font-mono text-[10px]">World Bank WDI</span>
        </div>
      </div>

      {/* Chart 2: Unemployment Rate */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Unemployment Rate
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Share of the total labor force without work (modeled ILO estimate)
            </p>
          </div>
        </div>

        <div className="h-[250px] w-full">
          <ReactECharts
            option={createBarOption(unemploymentData, 'Unemployment Rate', '%')}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        </div>

        <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between">
          <span>Target metric: % of total labor force</span>
          <span className="font-mono text-[10px]">World Bank WDI</span>
        </div>
      </div>
    </div>
  );
}
