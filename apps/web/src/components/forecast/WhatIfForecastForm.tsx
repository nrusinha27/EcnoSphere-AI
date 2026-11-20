"use client";

/**
 * EconoSphere AI — Stage 2 What-If GDP Forecasting Form
 *
 * Presents an interactive form for exploring how changes in economic indicators
 * affect the Phase 11 HistGradientBoostingRegressor GDP growth forecast.
 *
 * Rules:
 * - Only 11 primary economic indicators are user-editable.
 * - 20 derived/lag/contextual features are shown as read-only (imputed from 2025 data).
 * - null features are shown with a "will be model-imputed" badge.
 * - No SHAP values — input changes are shown for transparency only.
 * - Actual model inference via POST /api/v1/forecasts/gdp.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useCountryDefaults,
  useGDPInference,
  InferenceRequest,
  InferenceResponse,
  CountryDefaults,
} from "@/hooks/useMLForecast";

// ─── Constants ────────────────────────────────────────────────────────────────

const FORECAST_COUNTRIES = [
  { code: "CHN", name: "China" },
  { code: "GBR", name: "United Kingdom" },
  { code: "IND", name: "India" },
  { code: "JPN", name: "Japan" },
  { code: "USA", name: "United States" },
];

const Q90 = 11.4507;
const FORECAST_YEAR = 2026;
const FEATURE_YEAR = 2025;

// 11 user-editable primary indicators
interface FieldConfig {
  key: keyof Omit<InferenceRequest, "country" | "year">;
  label: string;
  unit: string;
  description: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const EDITABLE_FIELDS: FieldConfig[] = [
  {
    key: "unemployment_pct",
    label: "Unemployment Rate",
    unit: "%",
    description: "National unemployment rate",
    min: 0, max: 30, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "inflation_cpi_pct",
    label: "CPI Inflation",
    unit: "%",
    description: "Consumer price index annual inflation",
    min: -5, max: 50, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "interest_rate_pct",
    label: "Lending Interest Rate",
    unit: "%",
    description: "Commercial bank lending rate",
    min: 0, max: 40, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "exports_pct_gdp",
    label: "Exports (% of GDP)",
    unit: "%",
    description: "Exports of goods and services as % of GDP",
    min: 0, max: 100, step: 0.5,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "imports_pct_gdp",
    label: "Imports (% of GDP)",
    unit: "%",
    description: "Imports of goods and services as % of GDP",
    min: 0, max: 120, step: 0.5,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "tariff_rate_pct",
    label: "Tariff Rate",
    unit: "%",
    description: "Mean tariff rate on imports (%)",
    min: 0, max: 50, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "tax_revenue_pct_gdp",
    label: "Tax Revenue (% of GDP)",
    unit: "%",
    description: "Total government tax revenue as % of GDP",
    min: 0, max: 60, step: 0.5,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "current_account_pct_gdp",
    label: "Current Account Balance",
    unit: "% of GDP",
    description: "Current account balance as % of GDP",
    min: -20, max: 20, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "fdi_net_inflow_usd",
    label: "FDI Net Inflows",
    unit: "USD bn",
    description: "Net foreign direct investment inflows",
    min: -500e9, max: 1000e9, step: 1e9,
    format: (v) => `$${(v / 1e9).toFixed(1)}B`,
  },
  {
    key: "exchange_rate_lcu_usd",
    label: "Exchange Rate (LCU/USD)",
    unit: "LCU",
    description: "Local currency units per 1 USD",
    min: 0.01, max: 10000, step: 0.01,
    format: (v) => v.toFixed(4),
  },
  {
    key: "gdp_growth_lag1",
    label: "Previous Year GDP Growth",
    unit: "%",
    description: "GDP growth rate from prior year (lag-1 feature)",
    min: -20, max: 20, step: 0.1,
    format: (v) => `${v.toFixed(2)}%`,
  },
];

const EDITABLE_KEYS = new Set(EDITABLE_FIELDS.map((f) => f.key));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFeatureName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFeatureValue(key: string, value: number | null): string {
  if (value === null) return "—";
  if (key.includes("usd") && !key.includes("pct")) {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    return `$${value.toLocaleString()}`;
  }
  if (key.includes("log_")) return value.toFixed(4);
  if (key.includes("population")) return value.toLocaleString();
  return value.toFixed(4);
}

// Build an InferenceRequest from defaults + user overrides
function buildRequest(
  country: string,
  defaults: CountryDefaults,
  overrides: Partial<Record<string, number>>
): InferenceRequest {
  const features: Record<string, number | null | undefined> = { ...defaults.features };
  Object.entries(overrides).forEach(([k, v]) => {
    features[k] = v;
  });

  // Fall back to 0 for any null (model will impute, but API requires float)
  const withFallback = (key: string): number => {
    const v = features[key];
    return v ?? 0;
  };

  return {
    country,
    year: FORECAST_YEAR,
    exchange_rate_lcu_usd: withFallback("exchange_rate_lcu_usd"),
    tariff_rate_pct: withFallback("tariff_rate_pct"),
    remittances_usd: withFallback("remittances_usd"),
    fdi_net_inflow_usd: withFallback("fdi_net_inflow_usd"),
    unemployment_pct: withFallback("unemployment_pct"),
    imports_pct_gdp: withFallback("imports_pct_gdp"),
    tax_revenue_pct_gdp: withFallback("tax_revenue_pct_gdp"),
    exports_pct_gdp: withFallback("exports_pct_gdp"),
    interest_rate_pct: withFallback("interest_rate_pct"),
    reserves_usd: withFallback("reserves_usd"),
    current_account_pct_gdp: withFallback("current_account_pct_gdp"),
    inflation_cpi_pct: withFallback("inflation_cpi_pct"),
    population_total: withFallback("population_total"),
    gdp_current_usd: withFallback("gdp_current_usd"),
    gdp_growth_lag1: withFallback("gdp_growth_lag1"),
    gdp_growth_lag2: withFallback("gdp_growth_lag2"),
    gdp_growth_lag3: withFallback("gdp_growth_lag3"),
    inflation_lag1: withFallback("inflation_lag1"),
    unemployment_lag1: withFallback("unemployment_lag1"),
    exports_lag1: withFallback("exports_lag1"),
    imports_lag1: withFallback("imports_lag1"),
    gdp_growth_rolling_mean_3: withFallback("gdp_growth_rolling_mean_3"),
    gdp_growth_rolling_std_3: withFallback("gdp_growth_rolling_std_3"),
    gdp_growth_rolling_mean_5: withFallback("gdp_growth_rolling_mean_5"),
    inflation_rolling_mean_3: withFallback("inflation_rolling_mean_3"),
    trade_openness: withFallback("trade_openness"),
    trade_balance_ratio: withFallback("trade_balance_ratio"),
    log_gdp_usd: withFallback("log_gdp_usd"),
    log_population: withFallback("log_population"),
    gdp_growth_rolling_std_5: withFallback("gdp_growth_rolling_std_5"),
    inflation_rolling_std_3: withFallback("inflation_rolling_std_3"),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WhatIfForecastFormProps {
  onResult: (result: InferenceResponse | null, baseline: InferenceResponse | null, changes: Record<string, { from: number | null; to: number }>) => void;
}

export function WhatIfForecastForm({ onResult }: WhatIfForecastFormProps) {
  const [selectedCountry, setSelectedCountry] = useState("USA");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [showDerived, setShowDerived] = useState(false);

  const { data: defaults, isLoading: defaultsLoading, error: defaultsError } =
    useCountryDefaults(selectedCountry);

  const inference = useGDPInference();

  // Reset overrides when country changes
  useEffect(() => {
    setOverrides({});
    onResult(null, null, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  const getFieldValue = useCallback(
    (key: string): number => {
      if (key in overrides) return overrides[key];
      const dv = defaults?.features?.[key as keyof typeof defaults.features];
      return dv ?? 0;
    },
    [overrides, defaults]
  );

  const handleFieldChange = (key: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setOverrides({});
    onResult(null, null, {});
  };

  const handleSubmit = async () => {
    if (!defaults) return;

    // Build baseline request (no overrides)
    const baselineReq = buildRequest(selectedCountry, defaults, {});
    // Build scenario request (with user overrides)
    const scenarioReq = buildRequest(selectedCountry, defaults, overrides);

    // Compute which inputs changed
    const changes: Record<string, { from: number | null; to: number }> = {};
    Object.entries(overrides).forEach(([k, v]) => {
      const original = defaults.features[k as keyof typeof defaults.features] ?? null;
      if (original !== v) {
        changes[k] = { from: original as number | null, to: v };
      }
    });

    try {
      // Run baseline first, then scenario
      const [baselineResult, scenarioResult] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/forecasts/gdp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baselineReq),
        }).then((r) => {
          if (!r.ok) throw new Error(`Baseline inference failed: ${r.status}`);
          return r.json() as Promise<InferenceResponse>;
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/forecasts/gdp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenarioReq),
        }).then((r) => {
          if (!r.ok) throw new Error(`Scenario inference failed: ${r.status}`);
          return r.json() as Promise<InferenceResponse>;
        }),
      ]);

      onResult(scenarioResult, baselineResult, changes);
    } catch (err) {
      console.error("WhatIf inference error:", err);
      onResult(null, null, {});
    }
  };

  const isLoading = defaultsLoading;
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">What-If GDP Forecasting</h2>
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-900 text-blue-300 border border-blue-700">
            Phase 11 Model
          </span>
        </div>
        {hasOverrides && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Disclosure */}
      <div className="flex items-start gap-2 bg-blue-950/50 border border-blue-800/50 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-300">
          Modifies the 11 primary economic indicators and re-runs the frozen
          HistGradientBoostingRegressor (RMSE 3.91 pp). No SHAP values available — input
          changes are shown for transparency only. The 90% prediction interval
          (±{Q90} pp) is an empirical calibration, not a statistical guarantee.
        </p>
      </div>

      {/* Country selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FORECAST_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {defaults && (
          <p className="mt-1 text-xs text-gray-500">
            Using {FEATURE_YEAR} historical data as baseline · forecasting {FORECAST_YEAR}
            {defaults.null_features.length > 0 && (
              <span className="ml-1 text-amber-500">
                · {defaults.null_features.length} feature(s) will be model-imputed
              </span>
            )}
          </p>
        )}
      </div>

      {/* Editable indicators */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading {selectedCountry} defaults…</span>
        </div>
      ) : defaultsError ? (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/30 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load country defaults. Ensure the API server is running.</span>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Editable Economic Indicators
              <span className="ml-2 text-xs text-gray-500">(adjust to explore scenarios)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {EDITABLE_FIELDS.map((field) => {
                const rawDefault = defaults?.features?.[field.key];
                const currentVal = getFieldValue(field.key as string);
                const isNull = rawDefault === null || rawDefault === undefined;
                const isModified = field.key in overrides;

                return (
                  <div
                    key={field.key}
                    className={`bg-gray-800 border rounded-lg p-3 ${
                      isModified ? "border-blue-600" : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-300">
                        {field.label}
                        {isModified && (
                          <span className="ml-1 text-blue-400 text-xs">●</span>
                        )}
                      </label>
                      <span className="text-xs text-gray-400">
                        {isNull ? (
                          <span className="text-amber-500">will be imputed</span>
                        ) : (
                          <>baseline: {field.format(rawDefault as number)}</>
                        )}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={currentVal}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      onChange={(e) => handleFieldChange(field.key as string, parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Derived / contextual features (read-only) */}
          <div>
            <button
              onClick={() => setShowDerived(!showDerived)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showDerived ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showDerived ? "Hide" : "Show"} derived / contextual features (read-only)
            </button>
            {showDerived && defaults && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(defaults.features)
                  .filter(([k]) => !EDITABLE_KEYS.has(k as typeof EDITABLE_KEYS extends Set<infer U> ? U : never))
                  .map(([k, v]) => (
                    <div key={k} className="bg-gray-800/50 rounded p-2">
                      <div className="text-xs text-gray-400 truncate">{formatFeatureName(k)}</div>
                      <div className={`text-xs font-mono mt-0.5 ${v === null ? "text-amber-500" : "text-gray-200"}`}>
                        {v === null ? "imputed" : formatFeatureValue(k, v)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={inference.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {inference.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running inference…
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Generate Forecast {hasOverrides ? "(What-If)" : "(Baseline)"}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
