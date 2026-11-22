"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, FastForward, Rewind } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { ImpactMap } from "@/components/simulation/ImpactMap";

/**
 * M-2 Fix: Derive WebSocket URL from the shared API base URL.
 * Converts http:// → ws:// and https:// → wss:// for TLS-compatible production.
 */
function getWsBase(): string {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  return apiBase.replace(/^http/, "ws");
}

export default function SimulationDashboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHorizon, setCurrentHorizon] = useState(0);
  const [runId, setRunId] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [globalState, setGlobalState] = useState<Record<string, any> | undefined>(undefined);
  const [activeShocks, setActiveShocks] = useState<Record<string, any> | undefined>(undefined);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [currentSnapshotIdx, setCurrentSnapshotIdx] = useState<number>(-1);
  const ws = useRef<WebSocket | null>(null);

  // Load the most recent completed simulation run on mount so controls are active and ready
  useEffect(() => {
    async function loadLatestRun() {
      try {
        const { data: runs } = await apiClient.get<any[]>("/simulation");
        const completedRuns = (runs || []).filter(r => r.status === "COMPLETED");
        if (completedRuns.length > 0) {
          const latest = completedRuns[0];
          setRunId(latest.id);
          const { data: snaps } = await apiClient.get<any[]>(`/simulation/${latest.id}/snapshots`);
          if (snaps && snaps.length > 0) {
            setSnapshots(snaps);
            // Default to final horizon (e.g. Day 1095)
            const lastIdx = snaps.length - 1;
            setCurrentSnapshotIdx(lastIdx);
            const snap = snaps[lastIdx];
            setCurrentHorizon(snap.horizon_days);
            setGlobalState(snap.global_state);
            setActiveShocks(snap.active_shocks);
            setLogs(snaps.map(s => `Snapshot generated for day ${s.horizon_days}`));
          }
        }
      } catch (err) {
        console.error("Failed to load initial simulation run:", err);
      }
    }
    loadLatestRun();
  }, []);

  useEffect(() => {
    if (runId && isPlaying) {
      ws.current = new WebSocket(`${getWsBase()}/simulation/${runId}/stream`);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "SNAPSHOT") {
          setCurrentHorizon(data.horizon);
          setLogs(prev => [...prev, data.message]);
          if (data.global_state) setGlobalState(data.global_state);
          if (data.active_shocks) setActiveShocks(data.active_shocks);
          setSnapshots(prev => {
            const updated = [...prev, { horizon_days: data.horizon, global_state: data.global_state, active_shocks: data.active_shocks }];
            setCurrentSnapshotIdx(updated.length - 1);
            return updated;
          });
        }
      };

      return () => {
        ws.current?.close();
      };
    }
  }, [runId, isPlaying]);

  const startSimulation = async () => {
    try {
      setLogs(["Initializing simulation engine..."]);
      const { data } = await apiClient.post("/simulation/start", {
        scenario_id: 1,
        config: {
          time_horizons: [1, 7, 30, 180, 365, 1095],
          max_depth: 3
        }
      });
      setRunId(data.id);
      setIsPlaying(true);
      setSnapshots([]);
      setCurrentSnapshotIdx(-1);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayPause = () => {
    if (ws.current) {
      const command = isPlaying ? "PAUSE" : "RESUME";
      ws.current.send(JSON.stringify({ command }));
    }
    setIsPlaying(!isPlaying);
  };

  const handleRewind = () => {
    if (snapshots.length === 0) return;
    const nextIdx = Math.max(0, currentSnapshotIdx - 1);
    setCurrentSnapshotIdx(nextIdx);
    const snap = snapshots[nextIdx];
    setCurrentHorizon(snap.horizon_days);
    setGlobalState(snap.global_state);
    setActiveShocks(snap.active_shocks);
  };

  const handleFastForward = () => {
    if (snapshots.length === 0) return;
    const nextIdx = Math.min(snapshots.length - 1, currentSnapshotIdx + 1);
    setCurrentSnapshotIdx(nextIdx);
    const snap = snapshots[nextIdx];
    setCurrentHorizon(snap.horizon_days);
    setGlobalState(snap.global_state);
    setActiveShocks(snap.active_shocks);
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Simulation Command Center</h1>

        <div className="flex items-center space-x-2 bg-card border rounded-lg p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            disabled={snapshots.length === 0 || currentSnapshotIdx <= 0}
            onClick={handleRewind}
            title="Step Back Horizon"
          >
            <Rewind className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={isPlaying ? handlePlayPause : startSimulation}
            title={isPlaying ? "Pause Simulation" : "Run / Restart Simulation"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={snapshots.length === 0 || currentSnapshotIdx >= snapshots.length - 1}
            onClick={handleFastForward}
            title="Step Forward Horizon"
          >
            <FastForward className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">
        <div className="col-span-2 bg-card border rounded-xl overflow-hidden flex items-center justify-center relative">
          <div className="absolute top-4 right-4 z-20 bg-background/80 backdrop-blur px-3 py-1 rounded-full border text-sm font-medium">
            Day {currentHorizon}
          </div>
          <ImpactMap currentHorizon={currentHorizon} isRunning={isPlaying} globalState={globalState} activeShocks={activeShocks} />
        </div>
        
        <div className="bg-card border rounded-xl p-4 flex flex-col space-y-4">
          <h3 className="font-semibold text-lg">Event Log</h3>
          <div className="flex-1 overflow-y-auto space-y-2 text-sm text-muted-foreground font-mono">
            {logs.length === 0 && <div>Ready to start simulation...</div>}
            {logs.map((log, i) => (
              <div key={i} className="border-l-2 border-primary pl-2">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
