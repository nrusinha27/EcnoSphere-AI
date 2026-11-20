'use client';

import React, { useState } from 'react';
import { Download, Database, Layers, CheckCircle2 } from 'lucide-react';
import type { CountryComparisonProfile } from '@/lib/api/compare';
import {
  INDICATOR_CATEGORIES,
  COUNTRY_COLOR_STYLES,
  formatIndicatorValue,
} from './compareConstants';

interface ComparisonTableProps {
  countries: CountryComparisonProfile[];
}

export function ComparisonTable({ countries }: ComparisonTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const categoriesToDisplay =
    selectedCategory === 'all'
      ? INDICATOR_CATEGORIES
      : INDICATOR_CATEGORIES.filter((c) => c.id === selectedCategory);

  const handleExportCSV = () => {
    // Generate authentic CSV from the compared indicators
    const headers = ['Category', 'Indicator', 'Unit'];
    countries.forEach((c) => {
      headers.push(`${c.country_name} (${c.country_code}) Value`);
      headers.push(`${c.country_code} Observation Year`);
    });
    headers.push('Data Source');

    const rows: string[][] = [];

    INDICATOR_CATEGORIES.forEach((cat) => {
      cat.indicators.forEach((ind) => {
        const row = [cat.name, `"${ind.name}"`, ind.unit];
        countries.forEach((c) => {
          const pt = c.latest_indicators[ind.key];
          if (pt && pt.value !== null && pt.value !== undefined) {
            row.push(String(pt.value));
            row.push(pt.year ? String(pt.year) : 'N/A');
          } else {
            row.push('Unavailable');
            row.push('N/A');
          }
        });
        row.push('World Bank WDI');
        rows.push(row);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `econosphere_comparison_${countries.map((c) => c.country_code).join('_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Comprehensive Macroeconomic Indicator Matrix</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            14 World Bank WDI indicators grouped across Growth, Inflation, Fiscal, and Trade pillars.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter Pills */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                selectedCategory === 'all'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All (14)
            </button>
            {INDICATOR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              <th className="py-3 px-4 font-semibold w-1/4">Indicator / Metric</th>
              <th className="py-3 px-3 font-semibold w-24">Unit</th>
              {countries.map((c, idx) => {
                const style = COUNTRY_COLOR_STYLES[idx % COUNTRY_COLOR_STYLES.length];
                return (
                  <th key={c.country_code} className="py-3 px-4 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: style.hex }}
                      />
                      <span className="text-gray-900 dark:text-white">{c.country_name}</span>
                      <span className="font-mono text-[10px] text-gray-400">({c.country_code})</span>
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 font-semibold w-24 text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {categoriesToDisplay.map((cat) => (
              <React.Fragment key={cat.id}>
                {/* Category Header Row */}
                <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                  <td
                    colSpan={3 + countries.length}
                    className="py-2 px-4 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]"
                  >
                    {cat.name}
                  </td>
                </tr>

                {/* Indicator Rows */}
                {cat.indicators.map((ind) => (
                  <tr
                    key={ind.key}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200">
                      {ind.name}
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {ind.unit}
                    </td>
                    {countries.map((c) => {
                      const point = c.latest_indicators[ind.key];
                      const isAvail = point && point.value !== null && point.value !== undefined;

                      return (
                        <td key={c.country_code} className="py-3 px-4">
                          {isAvail ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatIndicatorValue(point.value, ind.unit)}
                              </span>
                              {point.year && (
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  Observed: {point.year}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                              Data unavailable
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right text-gray-400 text-[10px] font-mono">
                      WDI
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer Disclaimer */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>
            Indicators are retrieved directly from authentic World Bank records without estimation or synthetic imputation.
          </span>
        </span>
        <span className="font-mono text-[10px] text-gray-400">
          master_panel.csv • World Bank Group
        </span>
      </div>
    </div>
  );
}
