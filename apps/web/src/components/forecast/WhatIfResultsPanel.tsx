"use client";

/**
 * EconoSphere AI — Stage 2 What-If Results Panel
 *
 * Displays the real model inference output comparing baseline vs what-if scenario.
 * Features:
 * - Predicted GDP growth rate point estimates
 * - 90% empirical prediction interval [pred - Q90, pred + Q90]
 * - Delta calculation (scenario - baseline) with directional indicator
 * - Modified inputs breakdown table showing exactly which variables changed
 * - Model provenance and scientific disclosure (test RMSE, frozen Phase 11 status, no SHAP disclosure)
 */

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Cpu,
} from "lucide-react";
import { InferenceResponse } from "@/hooks/useMLForecast";

interface WhatIfResultsPanelProps {
  scenarioResult: InferenceResponse | null;
  baselineResult: InferenceResponse | null;
  changes: Record<string, { from: number | null; to: number }>;
}

function formatValue(key: string, val: number | null): string {
  if (val === null) return "Model Imputed (Median)";
  if (key.includes("usd") && !key.includes("pct")) {
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    return `$${val.toLocaleString()}`;
  }
  if (key.includes("pct") || key.includes("rate") || key.includes("growth")) {
    return `${val.toFixed(2)}%`;
  }
  return val.toFixed(4);
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WhatIfResultsPanel({
  scenarioResult,
  baselineResult,
  changes,
}: WhatIfResultsPanelProps) {
  if (!scenarioResult) {
    return (
      <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-3">
        <Cpu className="w-10 h-10 text-gray-600" />
        <h3 className="text-gray-300 font-medium">No Simulation Executed</h3>
        <p className="text-gray-500 text-sm max-w-md">
          Adjust the economic indicators on the left and click &quot;Generate Forecast&quot; to execute real-time inference using the locked Phase 11 ML model.
        </p>
      </div>
    );
  }

  const delta = baselineResult
    ? scenarioResult.predicted_gdp_growth - baselineResult.predicted_gdp_growth
    : 0;

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Model Inference Outcome
            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {scenarioResult.production_status}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Country: <span className="text-white font-medium">{scenarioResult.country}</span> | Target Year: <span className="text-white font-medium">{scenarioResult.year}</span> | Model: <span className="font-mono text-blue-400">{scenarioResult.model_version}</span>
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Scenario Point Estimate */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400">
            {hasChanges ? "What-If Forecast" : "Baseline Forecast"}
          </span>
          <div className="text-3xl font-bold text-white mt-1">
            {scenarioResult.predicted_gdp_growth > 0 ? "+" : ""}
            {scenarioResult.predicted_gdp_growth.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-400 mt-2">
            90% Interval: [{scenarioResult.lower_bound_90.toFixed(2)}%, {scenarioResult.upper_bound_90.toFixed(2)}%]
          </div>
        </div>

        {/* Baseline Comparison */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400">Baseline (2025 Data)</span>
          <div className="text-2xl font-semibold text-gray-300 mt-1">
            {baselineResult ? (
              <>
                {baselineResult.predicted_gdp_growth > 0 ? "+" : ""}
                {baselineResult.predicted_gdp_growth.toFixed(2)}%
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Unperturbed 2025 indicator projection
          </div>
        </div>

        {/* Delta */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400">Model Prediction Shift (Delta)</span>
          <div className="flex items-center gap-2 mt-1">
            {delta > 0.001 ? (
              <>
                <TrendingUp className="w-6 h-6 text-emerald-400" />
                <span className="text-2xl font-bold text-emerald-400">
                  +{delta.toFixed(2)} pp
                </span>
              </>
            ) : delta < -0.001 ? (
              <>
                <TrendingDown className="w-6 h-6 text-rose-400" />
                <span className="text-2xl font-bold text-rose-400">
                  {delta.toFixed(2)} pp
                </span>
              </>
            ) : (
              <>
                <Minus className="w-6 h-6 text-gray-400" />
                <span className="text-2xl font-bold text-gray-300">0.00 pp</span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Relative to baseline model projection (non-causal)
          </div>
        </div>
      </div>

      {/* Uncertainty Interval Details */}
      <div className="bg-blue-950/20 border border-blue-900/40 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-blue-300 font-medium">
          <span>Uncertainty Calibration (Global Q90)</span>
          <span>±{scenarioResult.q90.toFixed(2)} pp interval width</span>
        </div>
        <div className="relative pt-2 pb-1">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
            <div className="bg-blue-600/40 w-1/3"></div>
            <div className="bg-blue-500 w-1/3"></div>
            <div className="bg-blue-600/40 w-1/3"></div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
            <span>{scenarioResult.lower_bound_90.toFixed(2)}%</span>
            <span className="text-white font-bold">{scenarioResult.predicted_gdp_growth.toFixed(2)}%</span>
            <span>{scenarioResult.upper_bound_90.toFixed(2)}%</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Calibrated using 90th percentile of historical out-of-sample validation residuals (Phase 11 Step 12).
          Empirical coverage is 90% across the historical validation window (2019–2022).
        </p>
      </div>

      {/* Inputs Modified Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          Variable Modifications Breakdown
          <span className="text-xs font-normal text-gray-400">
            ({Object.keys(changes).length} modified)
          </span>
        </h3>
        {Object.keys(changes).length === 0 ? (
          <p className="text-xs text-gray-500 italic bg-gray-800/40 p-3 rounded-lg border border-gray-800">
            No indicators modified. Output represents the unmodified baseline run.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="py-2 px-3">Indicator</th>
                  <th className="py-2 px-3">Baseline Value</th>
                  <th className="py-2 px-3">Scenario Input</th>
                  <th className="py-2 px-3">Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/60 font-mono">
                {Object.entries(changes).map(([k, v]) => {
                  const shift = v.from !== null ? v.to - v.from : 0;
                  return (
                    <tr key={k} className="hover:bg-gray-800/30">
                      <td className="py-2 px-3 font-sans text-gray-300 font-medium">{formatKey(k)}</td>
                      <td className="py-2 px-3 text-gray-400">{formatValue(k, v.from)}</td>
                      <td className="py-2 px-3 text-blue-400 font-semibold">{formatValue(k, v.to)}</td>
                      <td className="py-2 px-3">
                        {v.from !== null ? (
                          <span className={shift > 0 ? "text-emerald-400" : shift < 0 ? "text-rose-400" : "text-gray-400"}>
                            {shift > 0 ? "+" : ""}{formatValue(k, shift)}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-sans text-[11px]">Replaced Imputation</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explainability & Rigor Transparency Disclosures */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1.5">
        <div className="font-semibold text-gray-300 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Explainability & Governance Disclosure
        </div>
        <p>
          <strong>No SHAP feature attribution artifacts:</strong> Live feature contributions are not manufactured or simulated.
          The above table reflects exact input delta perturbations fed into the frozen HistGradientBoostingRegressor model pipeline.
        </p>
        <p>
          <strong>Imputation Notice:</strong> Features left blank or missing in the underlying data are imputed via the median imputer fitted on the 2000–2018 training cohort.
        </p>
      </div>
    </div>
  );
}
