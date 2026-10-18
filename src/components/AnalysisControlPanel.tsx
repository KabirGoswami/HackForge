import React, { useState, useEffect } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../api";

export function AnalysisControlPanel() {
  const [wallet, setWallet] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("IDLE");
  const [progress, setProgress] = useState(0);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobId && status !== "SUCCESS" && status !== "FAILURE") {
      interval = setInterval(async () => {
        try {
          const data = await api.getJobStatus(jobId);
          setStatus(data.status);
          setProgress(data.progress);
          setDetails(data.details);

          if (data.status === "SUCCESS") {
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const handleAnalyze = async () => {
    if (!wallet) return;

    setError(null);
    setStatus("STARTING");
    setProgress(0);
    setDetails("Initializing forensic pipeline...");

    try {
      const res = await api.analyze(wallet);
      setJobId(res.job_id);
      setStatus("PENDING");
    } catch (e) {
      setError("Failed to trigger analysis. Is the backend running?");
      setStatus("IDLE");
    }
  };

  return (
    <div className="analysis-control-panel">
      <div className="panel-header">
        <Search size={18} />
        <h3 style={{margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: '#aaa'}}>Live Forensic Analysis</h3>
      </div>

      <div className="panel-body" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        <div className="input-group" style={{display: 'flex', gap: '8px'}}>
          <input
            type="text"
            placeholder="Enter target wallet address (0x...)"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            disabled={jobId && status !== "SUCCESS" && status !== "FAILURE"}
            style={{flex: 1, background: '#000', border: '1px solid #444', color: '#fff', padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace'}}
          />
          <button
            onClick={handleAnalyze}
            disabled={!wallet || (jobId && status !== "SUCCESS" && status !== "FAILURE")}
            style={{padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}
          >
            {status === "IDLE" || status === "SUCCESS" || status === "FAILURE" ? "Start Analysis" : "Analyzing..."}
          </button>
        </div>

        {jobId && (
          <div className="progress-container" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            <div className="progress-row" style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888'}}>
              <span className="progress-label">Pipeline Status: {details}</span>
              <span className="progress-percent">{progress}%</span>
            </div>
            <div className="progress-bar-bg" style={{height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden'}}>
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner" style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px'}}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {status === "SUCCESS" && (
          <div className="success-banner" style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px'}}>
            <CheckCircle2 size={14} />
            <span>Analysis complete. Dashboards updated.</span>
          </div>
        )}
      </div>

      <style>{`
        .analysis-control-panel {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          color: #eee;
          font-family: sans-serif;
        }
        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
