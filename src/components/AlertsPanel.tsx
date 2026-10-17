import React, { useState, useEffect } from "react";
import { ShieldAlert, Settings, BellOff, Bell, DollarSign } from "lucide-react";

interface Alert {
  cluster_id: string;
  volume_usd: number;
  severity: "CRITICAL" | "WARNING";
  message: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  currentThreshold: number;
  onUpdateThreshold: (val: number) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  currentThreshold,
  onUpdateThreshold,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(currentThreshold.toString());

  useEffect(() => {
    setThresholdInput(currentThreshold.toString());
  }, [currentThreshold]);

  const handleSaveThreshold = () => {
    const val = parseFloat(thresholdInput);
    if (!isNaN(val) && val > 0) {
      onUpdateThreshold(val);
      setIsSettingsOpen(false);
    }
  };

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-heading flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-danger" />
          <h2 className="text-base font-semibold text-slate-100">
            Cluster Volume Alerts
          </h2>
        </div>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-200"
          title="Alert Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {isSettingsOpen && (
        <div className="mb-4 p-3 bg-slate-900/50 border border-outline rounded-lg animate-in fade-in slide-in-from-top-2">
          <label className="text-xs font-mono text-slate-400 block mb-2">
            USD Volume Threshold
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                $
              </span>
              <input
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-full bg-canvas border border-outline rounded px-6 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              onClick={handleSaveThreshold}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
            <BellOff size={32} className="mb-2 text-slate-600" />
            <p className="text-xs text-slate-500 font-mono">
              No critical volume anomalies detected.
            </p>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 border-l-4 rounded-r-lg bg-slate-900/30 border-outline transition-all hover:bg-slate-800/50 ${
                alert.severity === "CRITICAL"
                  ? "border-l-danger bg-danger/5"
                  : "border-l-warning bg-warning/5"
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-1 rounded ${
                    alert.severity === "CRITICAL" ? "bg-danger text-white" : "bg-warning text-black"
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Cluster {alert.cluster_id}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-300">
                  ${(alert.volume_usd / 1_000_000).toFixed(2)}M
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {alert.message}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-outline flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-1">
          <Bell size={12} />
          <span>Active Monitoring</span>
        </div>
        <span>Threshold: ${currentThreshold.toLocaleString()}</span>
      </div>
    </div>
  );
};
