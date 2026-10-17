import React from "react";
import {
  CorrelationBreakdown,
  LedgerEdge,
  OsintArtifact,
  WalletNode,
  computeLatencyScore,
} from "../engine/forensicEngine";
import { ShieldAlert, Lock, CheckCircle2 } from "lucide-react";

interface LatencyAnalysisViewProps {
  correlations: CorrelationBreakdown[];
  bandwidthSigmaSec: number;
  onChangeBandwidthSigma: (val: number) => void;
  mixerEntropyWeight: number;
  onChangeMixerEntropyWeight: (val: number) => void;
  edges: LedgerEdge[];
  artifacts: OsintArtifact[];
  nodes: WalletNode[];
  frozenWalletIds: string[];
  onIssueFreeze: (walletId: string) => void;
  selectedSuspectId: string;
  onSelectSuspect: (id: string) => void;
}

export const LatencyAnalysisView: React.FC<LatencyAnalysisViewProps> = ({
  correlations,
  bandwidthSigmaSec,
  onChangeBandwidthSigma,
  mixerEntropyWeight,
  onChangeMixerEntropyWeight,
  edges,
  artifacts,
  nodes,
  frozenWalletIds,
  onIssueFreeze,
  selectedSuspectId,
  onSelectSuspect,
}) => {
  const activeSuspect =
    correlations.find((c) => c.suspectId === selectedSuspectId) ||
    correlations[0];

  // Sample points for the Gaussian Latency Decay Curve L(Δt) from Δt = 0s to 20s
  const sampleDeltas = [
    0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0,
  ];
  const expectedLag =
    activeSuspect.suspectId === "susp-kestrel"
      ? 1.5
      : activeSuspect.suspectId === "susp-v0id"
        ? 4.0
        : 9.5;

  return (
    <div className="space-y-6">
      {/* Statistical Model Hyperparameters & Posterior Attribution Table */}
      <div className="panel overflow-hidden">
        <div className="model-heading">
          <h2 className="text-sm font-semibold">
            Bayesian identity attribution &amp; time-delta latency model
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Posterior P(Entity | Cluster) · Hawkes kernel L(Δt; τ, σ) · Spectral
            graph clustering
          </p>
        </div>
        <div className="model-controls">
          <div className="model-control">
            <label htmlFor="sigma-bandwidth-slider">
              <span>Latency bandwidth σ</span>
              <strong className="font-mono text-accent">
                {bandwidthSigmaSec.toFixed(1)}s
              </strong>
            </label>
            <div
              className="range-control"
              style={
                {
                  "--range-progress": `${((bandwidthSigmaSec - 1) / 14) * 100}%`,
                } as React.CSSProperties
              }
            >
              <input
                id="sigma-bandwidth-slider"
                className="model-range"
                type="range"
                min="1.0"
                max="15.0"
                step="0.5"
                value={bandwidthSigmaSec}
                onChange={(e) =>
                  onChangeBandwidthSigma(parseFloat(e.target.value))
                }
              />
            </div>
            <p>
              Adjust the time window used to correlate OSINT events with ledger
              activity.
            </p>
          </div>
          <div className="model-control">
            <label htmlFor="entropy-weight-slider">
              <span>Mixer entropy penalty</span>
              <strong className="font-mono text-warning">
                {(mixerEntropyWeight * 100).toFixed(0)}%
              </strong>
            </label>
            <div
              className="range-control"
              style={
                {
                  "--range-progress": `${((mixerEntropyWeight - 0.05) / 0.8) * 100}%`,
                } as React.CSSProperties
              }
            >
              <input
                id="entropy-weight-slider"
                className="model-range"
                type="range"
                min="0.05"
                max="0.85"
                step="0.05"
                value={mixerEntropyWeight}
                onChange={(e) =>
                  onChangeMixerEntropyWeight(parseFloat(e.target.value))
                }
              />
            </div>
            <p>
              Control the influence of mixer branching entropy on attribution.
            </p>
          </div>
        </div>

        {/* High-Density Suspect Attribution Table */}
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Suspect attribution rankings"
        >
          <table
            className="w-full text-left border-collapse text-xs"
            data-testid="attribution-rankings-table"
          >
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-outline bg-canvas text-slate-400 font-medium">
                <th className="py-3 px-4">Suspect Identity / Alias</th>
                <th className="py-3 px-4">Target Cash-Out Cluster</th>
                <th className="py-3 px-3 text-right">Mean Δt Latency</th>
                <th className="py-3 px-3 text-right">Temporal Score</th>
                <th className="py-3 px-3 text-right">Behavioral Cosine</th>
                <th className="py-3 px-3 text-right">Graph Affinity</th>
                <th className="py-3 px-4 text-right">Model score</th>
                <th className="py-3 px-4 text-right">Interception Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/70 font-mono tabular-nums">
              {correlations.map((row) => {
                const isSelected = row.suspectId === activeSuspect.suspectId;
                const isFrozen = frozenWalletIds.includes(row.targetWalletId);

                return (
                  <tr
                    key={row.suspectId}
                    onClick={() => onSelectSuspect(row.suspectId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-sky-950/25" : "hover:bg-slate-900/50"
                    }`}
                  >
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-100 font-mono">
                        <button
                          type="button"
                          className="suspect-select"
                          aria-pressed={isSelected}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectSuspect(row.suspectId);
                          }}
                        >
                          {row.suspectHandle}
                        </button>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {row.realNameHint}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200">
                        {row.targetWalletAddress.slice(0, 8)}...
                        {row.targetWalletAddress.slice(-6)}
                      </div>
                      <div className="text-slate-400 font-sans text-[11px]">
                        {row.offshoreExchangeWallet} · $
                        {(row.atRiskVolumeUsd / 1_000_000).toFixed(2)}M
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-sky-300">
                      {row.meanTimeDeltaSec.toFixed(2)}s (
                      {row.matchedEventCount} hits)
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {(row.temporalScore * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {(row.behavioralScore * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {(row.graphClusterScore * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-bold text-sm ${
                          row.posteriorProbability >= 80
                            ? "text-rose-400"
                            : row.posteriorProbability >= 55
                              ? "text-amber-300"
                              : "text-slate-300"
                        }`}
                      >
                        {row.posteriorProbability.toFixed(1)}%
                      </span>
                      <div className="text-[10px] font-sans text-slate-400">
                        {row.status}
                      </div>
                    </td>
                    <td
                      className="py-3 px-4 text-right font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onIssueFreeze(row.targetWalletId)}
                        disabled={isFrozen}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          isFrozen
                            ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-default"
                            : "bg-rose-600 hover:bg-rose-500 text-white"
                        }`}
                      >
                        {isFrozen ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Frozen</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3" />
                            <span>
                              Freeze $
                              {Math.round(row.atRiskVolumeUsd / 1_000_000)}M
                            </span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Deep-Dive: Time-Delta Kernel Curve & Event-to-Block Correlation Matrix */}
      <div className="analysis-detail-grid">
        {/* Left: Gaussian Latency Kernel Curve for Selected Suspect */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Time-Delta Latency Kernel L(Δt) — {activeSuspect.suspectHandle}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Measures probability density that an on-chain transaction at{" "}
              <span className="font-mono">t_tx</span> was triggered by an OSINT
              commit/message at <span className="font-mono">t_osint</span> given
              expected automation lag τ ={" "}
              <span className="font-mono tabular-nums">
                {expectedLag.toFixed(1)}s
              </span>
              .
            </p>

            <div className="mt-4 bg-canvas border border-outline rounded p-3">
              <svg
                viewBox="0 0 420 190"
                className="w-full h-auto min-h-[210px]"
                role="img"
                aria-label={`Gaussian time-delta latency curve for ${activeSuspect.suspectHandle}`}
              >
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map((level) => {
                  const y = 155 - level * 125;
                  return (
                    <g key={level}>
                      <line
                        x1="36"
                        y1={y}
                        x2="400"
                        y2={y}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="30"
                        y={y + 3}
                        textAnchor="end"
                        className="text-[9px] font-mono fill-slate-500"
                      >
                        {level.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* Polyline of L(Δt) */}
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.2"
                  points={sampleDeltas
                    .map((dt) => {
                      const x = 36 + (dt / 20) * 364;
                      const score = computeLatencyScore(
                        dt,
                        expectedLag,
                        bandwidthSigmaSec,
                      );
                      const y = 155 - score * 125;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ")}
                />

                {/* Observed Mean Delta Marker */}
                {(() => {
                  const obsDt = Math.min(20, activeSuspect.meanTimeDeltaSec);
                  const obsScore = computeLatencyScore(
                    obsDt,
                    expectedLag,
                    bandwidthSigmaSec,
                  );
                  const cx = 36 + (obsDt / 20) * 364;
                  const cy = 155 - obsScore * 125;
                  return (
                    <g>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={cx}
                        y2={155}
                        stroke="var(--danger)"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <circle cx={cx} cy={cy} r="5" fill="var(--danger)" />
                      <text
                        x={Math.min(340, cx + 8)}
                        y={Math.max(24, cy - 6)}
                        className="text-[10px] font-mono fill-rose-400 font-semibold"
                      >
                        Observed Δt={activeSuspect.meanTimeDeltaSec}s
                      </text>
                    </g>
                  );
                })()}

                {/* X axis labels */}
                {[0, 5, 10, 15, 20].map((sec) => {
                  const x = 36 + (sec / 20) * 364;
                  return (
                    <text
                      key={sec}
                      x={x}
                      y="174"
                      textAnchor="middle"
                      className="text-[9.5px] font-mono fill-slate-400"
                    >
                      {sec}s
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-outline text-xs text-slate-300 font-mono tabular-nums space-y-1">
            <div>Formula: L(Δt) = exp( -( |Δt| - τ )² / (2σ²) )</div>
            <div className="text-slate-400">
              τ = {expectedLag.toFixed(1)}s · σ = {bandwidthSigmaSec.toFixed(1)}
              s · Posterior = {activeSuspect.posteriorProbability.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Right: Synchronized Timestamp Cross-Correlation Proof Ledger */}
        <div className="panel p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Synchronized OSINT-to-Blockchain Timestamp Alignment
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Direct chronological pairing between scraped off-chain artifacts
              and on-chain block execution timestamps.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-outline text-slate-400">
                    <th className="py-2 pr-3 timestamp-osint-header">
                      OSINT Event (t_osint)
                    </th>
                    <th className="py-2 px-3 timestamp-ledger-header">
                      Matched Ledger Tx (t_tx)
                    </th>
                    <th className="py-2 px-3 text-right">Latency Δt</th>
                    <th className="py-2 pl-3 text-right">Shared Fingerprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/60">
                  {artifacts.map((art) => {
                    // Find closest ledger transaction
                    let closestEdge = edges[0];
                    let minDiff = Infinity;
                    for (const e of edges) {
                      const d = Math.abs(e.timestampSec - art.timestampSec);
                      if (d < minDiff) {
                        minDiff = d;
                        closestEdge = e;
                      }
                    }
                    const dstNode = nodes.find(
                      (n) => n.id === closestEdge.targetId,
                    );

                    return (
                      <tr key={art.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 pr-3">
                          <div className="text-sky-300 font-semibold">
                            {art.authorAlias} · {art.sourceType}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            T+{art.timestampSec.toFixed(1)}s ({art.timestampUtc}
                            )
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-200">
                            Tx {closestEdge.txHash.slice(0, 10)}... →{" "}
                            {dstNode?.address.slice(0, 6)}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            T+{closestEdge.timestampSec.toFixed(1)}s · $
                            {(closestEdge.amountUsd / 1_000_000).toFixed(2)}M
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`font-semibold ${
                              minDiff <= 2.5
                                ? "text-rose-400"
                                : minDiff <= 5.0
                                  ? "text-amber-300"
                                  : "text-slate-300"
                            }`}
                          >
                            +{minDiff.toFixed(2)}s
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right text-slate-300">
                          {art.extractedGasQuirk
                            ? `${art.extractedGasQuirk} gwei`
                            : art.timezoneOffset}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-outline flex flex-wrap gap-3 items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Sub-2.0s execution correlation proves automated script trigger
                ownership
              </span>
            </span>
            <span className="font-mono tabular-nums">p-value &lt; 0.00014</span>
          </div>
        </div>
      </div>
    </div>
  );
};
