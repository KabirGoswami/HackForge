import React, { useId, useState } from "react";
import {
  WalletNode,
  LedgerEdge,
  buildAdjacencyMatrix,
} from "../engine/forensicEngine";
import { Network, Grid, ArrowUpRight, ShieldAlert, Lock } from "lucide-react";

interface MatrixGraphCanvasProps {
  nodes: WalletNode[];
  edges: LedgerEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  frozenWalletIds: string[];
  onIssueFreeze: (walletId: string) => void;
  compact?: boolean;
  highlightedWalletIds?: string[];
  clusterHeatmap?: Record<string, number>;
}

const ROLE_LABELS: Record<WalletNode["role"], string> = {
  exploit_origin: "Exploit Origin",
  splitter_bot: "Peel-Chain Bot",
  privacy_mixer: "ZK Privacy Mixer",
  cross_chain_bridge: "Cross-Chain Bridge",
  staging_wallet: "Consolidation Vault",
  offshore_exchange: "Offshore Cash-Out",
};

const ROLE_STROKE: Record<WalletNode["role"], string> = {
  exploit_origin: "var(--danger)",
  splitter_bot: "#F59E0B",
  privacy_mixer: "#A855F7",
  cross_chain_bridge: "var(--accent)",
  staging_wallet: "#F97316",
  offshore_exchange: "#10B981",
};

export const MatrixGraphCanvas: React.FC<MatrixGraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  frozenWalletIds,
  onIssueFreeze,
  compact = false,
  highlightedWalletIds = [],
}) => {
  const [mode, setMode] = useState<"graph" | "matrix_vol" | "matrix_prob">(
    "graph",
  );
  const [matrixCrosshair, setMatrixCrosshair] = useState<{
    row: number | null;
    column: number | null;
  } | null>(null);
  const instanceId = useId().replace(/:/g, "");
  const visualizationId = `${instanceId}-ledger-visualization`;
  const activeMarkerId = `${instanceId}-arrow-active`;
  const mutedMarkerId = `${instanceId}-arrow-muted`;
  const gridId = `${instanceId}-forensic-grid`;
  const activeMode = compact ? "graph" : mode;
  const highlightedIds = new Set([selectedNodeId, ...highlightedWalletIds]);
  const { volumeMatrix, transitionMatrix, nodeEntropies } =
    buildAdjacencyMatrix(nodes, edges);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const selectedIdx = nodes.findIndex((n) => n.id === selectedNode.id);
  const selectedEntropy = nodeEntropies[selectedIdx] ?? 0;
  const isFrozen = frozenWalletIds.includes(selectedNode.id);

  const connectedEdges = edges.filter(
    (e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id,
  );

  return (
    <div
      className={`panel matrix-canvas flex flex-col${compact ? " matrix-canvas-compact" : ""}`}
      data-compact={compact}
    >
      {/* Section Header & Segmented View Switcher */}
      {!compact && (
      <div className="matrix-header">
        <div>
          <h2 className="domain-heading domain-heading-ledger text-base font-semibold text-slate-100">
            Ledger tensor &amp; directed flow topology
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <span>9 Wallet Clusters</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span>1,597 Micro-Transactions Aggregated</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums">$42.00M Total Trace</span>
          </p>
        </div>

        {/* Interactive Segmented Control */}
        <div
          className="representation-switcher"
          role="tablist"
          aria-label="Ledger Representation Mode"
          onKeyDown={(event) => {
            const modes = ["graph", "matrix_vol", "matrix_prob"] as const;
            let index = modes.indexOf(mode);
            if (event.key === "ArrowRight") index = (index + 1) % modes.length;
            else if (event.key === "ArrowLeft")
              index = (index + modes.length - 1) % modes.length;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = modes.length - 1;
            else return;
            event.preventDefault();
            setMode(modes[index]);
            event.currentTarget
              .querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [index]?.focus();
          }}
        >
          <button
            type="button"
            role="tab"
            id={`${instanceId}-tab-graph`}
            aria-controls={visualizationId}
            tabIndex={mode === "graph" ? 0 : -1}
            aria-selected={mode === "graph"}
            onClick={() => setMode("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === "graph"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Graph Topology</span>
          </button>
          <button
            type="button"
            role="tab"
            id={`${instanceId}-tab-matrix_vol`}
            aria-controls={visualizationId}
            tabIndex={mode === "matrix_vol" ? 0 : -1}
            aria-selected={mode === "matrix_vol"}
            onClick={() => setMode("matrix_vol")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === "matrix_vol"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Adjacency Matrix (USD)</span>
          </button>
          <button
            type="button"
            role="tab"
            id={`${instanceId}-tab-matrix_prob`}
            aria-controls={visualizationId}
            tabIndex={mode === "matrix_prob" ? 0 : -1}
            aria-selected={mode === "matrix_prob"}
            onClick={() => setMode("matrix_prob")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === "matrix_prob"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Markov Matrix P(i,j)</span>
          </button>
        </div>
      </div>
      )}

      {/* Main Visualization Viewport */}
      <div
        id={visualizationId}
        role={compact ? "region" : "tabpanel"}
        aria-labelledby={compact ? undefined : `${instanceId}-tab-${mode}`}
        aria-label={compact ? "Correlated wallet transaction graph" : undefined}
        tabIndex={0}
      >
        {activeMode === "graph" ? (
          <div className="relative bg-canvas border-b border-outline">
            <div className="graph-scroll">
              <svg
                viewBox={compact ? "14 88 972 390" : "0 0 1000 490"}
                className="select-none"
                role="img"
                aria-label="Directed Blockchain Transaction Graph showing $42M flow from Exploit Origin through Peel-Chain Bots and Mixers to Offshore Exchanges"
                data-testid="blockchain-flow-svg"
              >
                <defs>
                  <marker
                    id={activeMarkerId}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)" />
                  </marker>
                  <marker
                    id={mutedMarkerId}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--muted)" />
                  </marker>
                  <pattern
                    id={gridId}
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="0.6"
                    />
                  </pattern>
                </defs>

                <rect width="1000" height="490" fill={`url(#${gridId})`} />

                {/* Column Stage Guides - Non-overlapping */}
                {!compact && <g className="text-[10.5px] fill-slate-400 font-mono">
                  <text x="90" y="26" textAnchor="middle">
                    0: DRAINER (T+3m)
                  </text>
                  <text x="310" y="26" textAnchor="middle">
                    1: PEEL BOTS (T+5m)
                  </text>
                  <text x="555" y="26" textAnchor="middle">
                    2: MIXERS (T+20m)
                  </text>
                  <text x="755" y="26" textAnchor="middle">
                    3: STAGING (T+4h)
                  </text>
                  <text x="920" y="26" textAnchor="middle">
                    4: FIAT EXIT (T+5.5h)
                  </text>
                </g>}

                {/* Directed Flow Edges */}
                {edges.map((edge) => {
                  const src = nodes.find((n) => n.id === edge.sourceId);
                  const dst = nodes.find((n) => n.id === edge.targetId);
                  if (!src || !dst) return null;

                  const isHighlighted =
                    compact
                      ? highlightedIds.has(src.id) && highlightedIds.has(dst.id)
                      : src.id === selectedNodeId || dst.id === selectedNodeId;
                  const strokeWidth = Math.max(
                    1.5,
                    Math.min(6.5, edge.amountUsd / 4_500_000),
                  );
                  const midX = (src.x + dst.x) / 2;
                  const midY = (src.y + dst.y) / 2;

                  return (
                    <g
                      key={edge.id}
                      className={`wallet-path${isHighlighted ? " is-highlighted" : ""}`}
                      data-edge-id={edge.id}
                      data-highlighted={isHighlighted}
                    >
                      <path
                        d={`M ${src.x + 56} ${src.y} C ${midX} ${src.y}, ${midX} ${dst.y}, ${dst.x - 58} ${dst.y}`}
                        fill="none"
                        stroke={
                          isHighlighted ? "var(--accent)" : "var(--graph-edge)"
                        }
                        strokeWidth={strokeWidth}
                        strokeOpacity={isHighlighted ? 0.95 : compact ? 0.3 : 0.55}
                        markerEnd={
                          isHighlighted
                            ? `url(#${activeMarkerId})`
                            : `url(#${mutedMarkerId})`
                        }
                      />
                      <rect
                        x={midX - 34}
                        y={midY - 10}
                        width="68"
                        height="18"
                        rx="3"
                        fill="var(--canvas)"
                        stroke={
                          isHighlighted
                            ? "var(--accent-muted)"
                            : "var(--border)"
                        }
                        strokeWidth="1"
                        opacity={compact && !isHighlighted ? 0.6 : 1}
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        className="text-[10px] font-mono fill-slate-300"
                        opacity={compact && !isHighlighted ? 0.6 : 1}
                      >
                        ${(edge.amountUsd / 1_000_000).toFixed(2)}M
                      </text>
                    </g>
                  );
                })}

                {/* Wallet Cluster Nodes */}
                {nodes.map((node, idx) => {
                  const isSelected = node.id === selectedNodeId;
                  const isHighlighted = highlightedIds.has(node.id);
                  const nodeFrozen = frozenWalletIds.includes(node.id);
                  const strokeColor = nodeFrozen
                    ? "var(--danger)"
                    : isHighlighted
                      ? "var(--accent)"
                      : ROLE_STROKE[node.role];

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => onSelectNode(node.id)}
                      className={`wallet-node cursor-pointer${isSelected ? " is-selected" : ""}${isHighlighted ? " is-correlated" : ""}${nodeFrozen ? " is-frozen" : ""}`}
                      data-wallet-id={node.id}
                      data-selected={isSelected}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Select wallet cluster ${node.label} on ${node.chain}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectNode(node.id);
                        }
                      }}
                    >
                      <rect
                        className="wallet-node-shape"
                        x="-56"
                        y="-34"
                        width="112"
                        height="68"
                        rx="6"
                        fill={
                          isSelected
                            ? "var(--surface-raised)"
                            : "var(--surface)"
                        }
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? 2.2 : 1.2}
                      />
                      <text
                        x="-48"
                        y="-17"
                        className="text-[9.5px] font-mono fill-slate-400"
                      >
                        {node.chain} · H={nodeEntropies[idx]?.toFixed(2)}
                      </text>
                      <text
                        x="-48"
                        y="-3"
                        className="text-[11px] font-semibold fill-slate-100 font-mono"
                      >
                        {node.address.slice(0, 6)}...{node.address.slice(-4)}
                      </text>
                      <text
                        x="-48"
                        y="12"
                        className="text-[10px] fill-slate-300"
                      >
                        {ROLE_LABELS[node.role]}
                      </text>
                      <text
                        x="-48"
                        y="25"
                        className="text-[10px] font-mono fill-sky-400"
                      >
                        In: ${(node.inflowUsd / 1_000_000).toFixed(2)}M
                        {nodeFrozen && <tspan className="wallet-frozen-label" fill="var(--danger)"> [FROZEN]</tspan>}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Wallet Cluster Quick-Selector Bar for Fast Keyboard & Screen Reader Access */}
            <div className="px-5 py-2.5 bg-surface border-t border-outline/80 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 mr-1">
                Inspect Cluster:
              </span>
              {nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelectNode(n.id)}
                  aria-pressed={n.id === selectedNodeId}
                  className={`px-2 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                    n.id === selectedNodeId
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-canvas text-slate-400 hover:text-slate-200 border border-outline"
                  }`}
                >
                  {n.address.slice(0, 6)}..{n.address.slice(-4)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Mathematical Adjacency & Stochastic Transition Matrix View */
          <div className="p-4 bg-canvas border-b border-outline overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                {mode === "matrix_vol"
                  ? "Directed Volume Matrix A[i,j] ($M USD transferred from row wallet i to column wallet j)"
                  : "Row-Normalized Markov Matrix P[i,j] = A[i,j] / Σ_k A[i,k] with Shannon Entropy H(i)"}
              </p>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                9 × 9 Sparse Ledger Tensor
              </span>
            </div>

            <table
              className="ledger-matrix w-full text-left border-collapse font-mono text-[11px] tabular-nums"
              data-testid="adjacency-matrix-table"
              onMouseLeave={() => setMatrixCrosshair(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setMatrixCrosshair(null);
                }
              }}
            >
              <thead>
                <tr className="border-b border-outline text-slate-400">
                  <th className="py-2 px-2 bg-surface font-medium whitespace-nowrap">
                    Src i \ Dst j
                  </th>
                  {nodes.map((colNode, cIdx) => (
                    <th
                      key={colNode.id}
                      className="py-2 px-1.5 text-right font-medium bg-surface"
                      title={`${colNode.label} (${colNode.address})`}
                      scope="col"
                      tabIndex={0}
                      data-crosshair={matrixCrosshair?.column === cIdx}
                      onMouseEnter={() => setMatrixCrosshair({ row: null, column: cIdx })}
                      onFocus={() => setMatrixCrosshair({ row: null, column: cIdx })}
                    >
                      W{cIdx + 1}
                    </th>
                  ))}
                  <th className="py-2 px-2 text-right font-medium bg-surface text-sky-400 whitespace-nowrap">
                    H(i)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/60">
                {nodes.map((rowNode, rIdx) => {
                  const isRowSelected = rowNode.id === selectedNodeId;
                  return (
                    <tr
                      key={rowNode.id}
                      onClick={() => onSelectNode(rowNode.id)}
                      data-crosshair-row={matrixCrosshair?.row === rIdx}
                      className={`cursor-pointer transition-colors ${
                        isRowSelected
                          ? "bg-sky-950/30"
                          : "hover:bg-slate-900/60"
                      }`}
                    >
                      <td
                        className="py-2 px-2 font-medium text-slate-200 whitespace-nowrap"
                        data-crosshair={matrixCrosshair?.row === rIdx}
                        onMouseEnter={() => setMatrixCrosshair({ row: rIdx, column: null })}
                      >
                        <button
                          type="button"
                          aria-pressed={isRowSelected}
                          aria-label={`Inspect ${rowNode.label}`}
                          onFocus={() => setMatrixCrosshair({ row: rIdx, column: null })}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectNode(rowNode.id);
                          }}
                        >
                          W{rIdx + 1}·{rowNode.address.slice(0, 6)}
                        </button>
                      </td>
                      {nodes.map((colNode, cIdx) => {
                        const val =
                          mode === "matrix_vol"
                            ? volumeMatrix[rIdx][cIdx] / 1_000_000
                            : transitionMatrix[rIdx][cIdx];
                        const isNonZero = val > 0;
                        return (
                          <td
                            key={colNode.id}
                            tabIndex={0}
                            data-matrix-row={rIdx}
                            data-matrix-column={cIdx}
                            data-crosshair={matrixCrosshair?.row === rIdx || matrixCrosshair?.column === cIdx}
                            aria-label={`From ${rowNode.label} to ${colNode.label}: ${mode === "matrix_vol" ? `$${val.toFixed(2)} million` : val.toFixed(3)}. Press Enter to inspect the source wallet.`}
                            onMouseEnter={() => setMatrixCrosshair({ row: rIdx, column: cIdx })}
                            onFocus={() => setMatrixCrosshair({ row: rIdx, column: cIdx })}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelectNode(rowNode.id);
                                return;
                              }
                              const directions: Record<string, [number, number]> = {
                                ArrowUp: [-1, 0],
                                ArrowDown: [1, 0],
                                ArrowLeft: [0, -1],
                                ArrowRight: [0, 1],
                              };
                              const direction = directions[event.key];
                              if (!direction) return;
                              event.preventDefault();
                              const row = Math.max(0, Math.min(nodes.length - 1, rIdx + direction[0]));
                              const column = Math.max(0, Math.min(nodes.length - 1, cIdx + direction[1]));
                              event.currentTarget.closest("table")
                                ?.querySelector<HTMLTableCellElement>(`[data-matrix-row="${row}"][data-matrix-column="${column}"]`)
                                ?.focus();
                            }}
                            className={`py-2 px-1.5 text-right whitespace-nowrap ${
                              isNonZero
                                ? "text-sky-300 font-semibold bg-sky-500/10"
                                : "text-slate-600"
                            }`}
                          >
                            {isNonZero
                              ? mode === "matrix_vol"
                                ? `$${val.toFixed(1)}M`
                                : val.toFixed(2)
                              : "0"}
                          </td>
                        );
                      })}
                      <td
                        className="py-2 px-2 text-right text-amber-300 font-medium whitespace-nowrap"
                        data-crosshair={matrixCrosshair?.row === rIdx}
                        onMouseEnter={() => setMatrixCrosshair({ row: rIdx, column: null })}
                      >
                        {nodeEntropies[rIdx].toFixed(2)}b
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="matrix-details">
        {/* Selected Node Mathematical Telemetry Inspector */}
        <div className="wallet-inspector">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-sky-400">
                {ROLE_LABELS[selectedNode.role]}
              </span>
              <span aria-hidden="true">·</span>
              <span>Chain: {selectedNode.chain}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Cluster: {selectedNode.clusterId}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Gas Signature: {selectedNode.gasFingerprintGwei} gwei
              </span>
              {isFrozen && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-400 font-semibold">
                    WARRANT FROZEN
                  </span>
                </>
              )}
            </div>

            <h3 className="text-sm font-semibold text-slate-100 font-mono">
              {selectedNode.label} — {selectedNode.address}
            </h3>

            <div className="wallet-telemetry text-slate-300 font-mono tabular-nums">
              <span>
                Inflow: ${(selectedNode.inflowUsd / 1_000_000).toFixed(2)}M
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Outflow: ${(selectedNode.outflowUsd / 1_000_000).toFixed(2)}M
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Retained Balance: $
                {(selectedNode.balanceUsd / 1_000_000).toFixed(2)}M
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Branching Entropy H(i): {selectedEntropy.toFixed(3)} bits
              </span>
              <span aria-hidden="true">·</span>
              <span>Bot Timing Jitter: ±{selectedNode.botJitterMs}ms</span>
            </div>
          </div>

          <div className="inspector-action flex items-center gap-3">
            <button
              type="button"
              onClick={() => onIssueFreeze(selectedNode.id)}
              disabled={isFrozen}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isFrozen
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-outline-strong"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {isFrozen ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Endpoint Frozen</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Freeze Cluster Endpoint</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Connected Micro-Transaction Batch Stream for Selected Cluster */}
        {!compact && <div className="connected-streams">
          <div className="text-xs font-medium text-slate-400 mb-2">
            Connected High-Velocity Flow Vectors ({connectedEdges.length}{" "}
            streams)
          </div>
          <div className="stream-list">
            {connectedEdges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.sourceId);
              const dst = nodes.find((n) => n.id === edge.targetId);
              return (
                <div
                  key={edge.id}
                  className="p-2.5 bg-canvas border border-outline rounded flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-slate-200 truncate">
                      {src?.address.slice(0, 6)}..{src?.address.slice(-4)}{" "}
                      <ArrowUpRight className="inline w-3 h-3 text-sky-400 mx-0.5" />{" "}
                      {dst?.address.slice(0, 6)}..{dst?.address.slice(-4)}
                    </div>
                    <div className="text-slate-400 mt-0.5 truncate">
                      <span>{edge.bridgeOrMixerTag}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {edge.txCount} micro-txs
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-sky-300 font-semibold">
                      ${(edge.amountUsd / 1_000_000).toFixed(2)}M
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Δt = {edge.timeDeltaFromParentSec.toFixed(1)}s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>}
      </div>
    </div>
  );
};
