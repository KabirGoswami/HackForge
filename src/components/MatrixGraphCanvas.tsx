import React, { useState } from 'react';
import {
  WalletNode,
  LedgerEdge,
  buildAdjacencyMatrix,
} from '../engine/forensicEngine';
import { Network, Grid, ArrowUpRight, ShieldAlert, Lock } from 'lucide-react';

interface MatrixGraphCanvasProps {
  nodes: WalletNode[];
  edges: LedgerEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  frozenWalletIds: string[];
  onIssueFreeze: (walletId: string) => void;
}

const ROLE_LABELS: Record<WalletNode['role'], string> = {
  exploit_origin: 'Exploit Origin',
  splitter_bot: 'Peel-Chain Bot',
  privacy_mixer: 'ZK Privacy Mixer',
  cross_chain_bridge: 'Cross-Chain Bridge',
  staging_wallet: 'Consolidation Vault',
  offshore_exchange: 'Offshore Cash-Out',
};

const ROLE_STROKE: Record<WalletNode['role'], string> = {
  exploit_origin: '#EF4444',
  splitter_bot: '#F59E0B',
  privacy_mixer: '#A855F7',
  cross_chain_bridge: '#38BDF8',
  staging_wallet: '#F97316',
  offshore_exchange: '#10B981',
};

export const MatrixGraphCanvas: React.FC<MatrixGraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  frozenWalletIds,
  onIssueFreeze,
}) => {
  const [mode, setMode] = useState<'graph' | 'matrix_vol' | 'matrix_prob'>('graph');
  const { volumeMatrix, transitionMatrix, nodeEntropies } = buildAdjacencyMatrix(
    nodes,
    edges
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const selectedIdx = nodes.findIndex((n) => n.id === selectedNode.id);
  const selectedEntropy = nodeEntropies[selectedIdx] ?? 0;
  const isFrozen = frozenWalletIds.includes(selectedNode.id);

  const connectedEdges = edges.filter(
    (e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id
  );

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg flex flex-col">
      {/* Section Header & Segmented View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            01. Ledger Tensor &amp; Directed Flow Topology
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <span>9 Wallet Clusters</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>1,597 Micro-Transactions Aggregated</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">$42.00M Total Trace</span>
          </p>
        </div>

        {/* Interactive Segmented Control */}
        <div
          className="flex items-center gap-1 p-1 bg-[#0B0F19] border border-slate-800 rounded-md"
          role="tablist"
          aria-label="Ledger Representation Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'graph'}
            onClick={() => setMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === 'graph'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Graph Topology</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'matrix_vol'}
            onClick={() => setMode('matrix_vol')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === 'matrix_vol'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Adjacency Matrix (USD)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'matrix_prob'}
            onClick={() => setMode('matrix_prob')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              mode === 'matrix_prob'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Markov Matrix P(i,j)</span>
          </button>
        </div>
      </div>

      {/* Main Visualization Viewport */}
      {mode === 'graph' ? (
        <div className="relative bg-[#0B0F19] border-b border-slate-800">
          <div className="w-full p-3">
            <svg
              viewBox="0 0 1000 490"
              className="w-full h-auto max-h-[390px] select-none"
              role="img"
              aria-label="Directed Blockchain Transaction Graph showing $42M flow from Exploit Origin through Peel-Chain Bots and Mixers to Offshore Exchanges"
              data-testid="blockchain-flow-svg"
            >
              <defs>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
                </marker>
                <marker
                  id="arrow-muted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                </marker>
                <pattern
                  id="forensic-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="0.6"
                  />
                </pattern>
              </defs>

              <rect width="1000" height="490" fill="url(#forensic-grid)" />

              {/* Column Stage Guides - Non-overlapping */}
              <g className="text-[10.5px] fill-slate-400 font-mono">
                <text x="90" y="26" textAnchor="middle">0: DRAINER (T+3m)</text>
                <text x="310" y="26" textAnchor="middle">1: PEEL BOTS (T+5m)</text>
                <text x="555" y="26" textAnchor="middle">2: MIXERS (T+20m)</text>
                <text x="755" y="26" textAnchor="middle">3: STAGING (T+4h)</text>
                <text x="920" y="26" textAnchor="middle">4: FIAT EXIT (T+5.5h)</text>
              </g>

              {/* Directed Flow Edges */}
              {edges.map((edge) => {
                const src = nodes.find((n) => n.id === edge.sourceId);
                const dst = nodes.find((n) => n.id === edge.targetId);
                if (!src || !dst) return null;

                const isHighlighted =
                  src.id === selectedNodeId || dst.id === selectedNodeId;
                const strokeWidth = Math.max(
                  1.5,
                  Math.min(6.5, edge.amountUsd / 4_500_000)
                );
                const midX = (src.x + dst.x) / 2;
                const midY = (src.y + dst.y) / 2;

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${src.x + 56} ${src.y} C ${midX} ${src.y}, ${midX} ${dst.y}, ${dst.x - 58} ${dst.y}`}
                      fill="none"
                      stroke={isHighlighted ? '#38BDF8' : '#334155'}
                      strokeWidth={strokeWidth}
                      strokeOpacity={isHighlighted ? 0.95 : 0.55}
                      markerEnd={
                        isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-muted)'
                      }
                    />
                    <rect
                      x={midX - 34}
                      y={midY - 10}
                      width="68"
                      height="18"
                      rx="3"
                      fill="#0B0F19"
                      stroke={isHighlighted ? '#0284C7' : '#1E293B'}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      className="text-[10px] font-mono fill-slate-300"
                    >
                      ${(edge.amountUsd / 1_000_000).toFixed(2)}M
                    </text>
                  </g>
                );
              })}

              {/* Wallet Cluster Nodes */}
              {nodes.map((node, idx) => {
                const isSelected = node.id === selectedNodeId;
                const nodeFrozen = frozenWalletIds.includes(node.id);
                const strokeColor = nodeFrozen
                  ? '#EF4444'
                  : isSelected
                  ? '#38BDF8'
                  : ROLE_STROKE[node.role];

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => onSelectNode(node.id)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`Select wallet cluster ${node.label} on ${node.chain}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectNode(node.id);
                      }
                    }}
                  >
                    <rect
                      x="-56"
                      y="-34"
                      width="112"
                      height="68"
                      rx="6"
                      fill={isSelected ? '#1E293B' : '#111827'}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2.2 : 1.2}
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
                      {nodeFrozen ? ' [FROZEN]' : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Wallet Cluster Quick-Selector Bar for Fast Keyboard & Screen Reader Access */}
          <div className="px-5 py-2.5 bg-[#111827] border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 mr-1">
              Inspect Cluster:
            </span>
            {nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelectNode(n.id)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                  n.id === selectedNodeId
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-[#0B0F19] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {n.address.slice(0, 6)}..{n.address.slice(-4)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Mathematical Adjacency & Stochastic Transition Matrix View */
        <div className="p-4 bg-[#0B0F19] border-b border-slate-800 overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {mode === 'matrix_vol'
                ? 'Directed Volume Matrix A[i,j] ($M USD transferred from row wallet i to column wallet j)'
                : 'Row-Normalized Markov Matrix P[i,j] = A[i,j] / Σ_k A[i,k] with Shannon Entropy H(i)'}
            </p>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              9 × 9 Sparse Ledger Tensor
            </span>
          </div>

          <table
            className="w-full text-left border-collapse font-mono text-[11px] tabular-nums"
            data-testid="adjacency-matrix-table"
          >
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2 bg-[#111827] font-medium whitespace-nowrap">
                  Src i \ Dst j
                </th>
                {nodes.map((colNode, cIdx) => (
                  <th
                    key={colNode.id}
                    className="py-2 px-1.5 text-right font-medium bg-[#111827]"
                    title={`${colNode.label} (${colNode.address})`}
                  >
                    W{cIdx + 1}
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-medium bg-[#111827] text-sky-400 whitespace-nowrap">
                  H(i)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {nodes.map((rowNode, rIdx) => {
                const isRowSelected = rowNode.id === selectedNodeId;
                return (
                  <tr
                    key={rowNode.id}
                    onClick={() => onSelectNode(rowNode.id)}
                    className={`cursor-pointer transition-colors ${
                      isRowSelected
                        ? 'bg-sky-950/30'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-2 px-2 font-medium text-slate-200 whitespace-nowrap">
                      W{rIdx + 1}·{rowNode.address.slice(0, 6)}
                    </td>
                    {nodes.map((colNode, cIdx) => {
                      const val =
                        mode === 'matrix_vol'
                          ? volumeMatrix[rIdx][cIdx] / 1_000_000
                          : transitionMatrix[rIdx][cIdx];
                      const isNonZero = val > 0;
                      return (
                        <td
                          key={colNode.id}
                          className={`py-2 px-1.5 text-right whitespace-nowrap ${
                            isNonZero
                              ? 'text-sky-300 font-semibold bg-sky-500/10'
                              : 'text-slate-600'
                          }`}
                        >
                          {isNonZero
                            ? mode === 'matrix_vol'
                              ? `$${val.toFixed(1)}M`
                              : val.toFixed(2)
                            : '0'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right text-amber-300 font-medium whitespace-nowrap">
                      {nodeEntropies[rIdx].toFixed(2)}b
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Node Mathematical Telemetry Inspector */}
      <div className="p-5 bg-[#111827] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
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

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1 font-mono tabular-nums">
            <span>
              Inflow: ${(selectedNode.inflowUsd / 1_000_000).toFixed(2)}M
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Outflow: ${(selectedNode.outflowUsd / 1_000_000).toFixed(2)}M
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Retained Balance: ${(selectedNode.balanceUsd / 1_000_000).toFixed(2)}M
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Branching Entropy H(i): {selectedEntropy.toFixed(3)} bits
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Bot Timing Jitter: ±{selectedNode.botJitterMs}ms
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onIssueFreeze(selectedNode.id)}
            disabled={isFrozen}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              isFrozen
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
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
      <div className="px-5 pb-4 border-t border-slate-800/80 pt-3">
        <div className="text-xs font-medium text-slate-400 mb-2">
          Connected High-Velocity Flow Vectors ({connectedEdges.length} streams)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {connectedEdges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.sourceId);
            const dst = nodes.find((n) => n.id === edge.targetId);
            return (
              <div
                key={edge.id}
                className="p-2.5 bg-[#0B0F19] border border-slate-800 rounded flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono text-slate-200 truncate">
                    {src?.address.slice(0, 6)}..{src?.address.slice(-4)}{' '}
                    <ArrowUpRight className="inline w-3 h-3 text-sky-400 mx-0.5" />{' '}
                    {dst?.address.slice(0, 6)}..{dst?.address.slice(-4)}
                  </div>
                  <div className="text-slate-400 mt-0.5 truncate">
                    <span>{edge.bridgeOrMixerTag}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
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
      </div>
    </div>
  );
};
