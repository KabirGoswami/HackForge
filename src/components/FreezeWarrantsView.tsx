import React from 'react';
import {
  FreezeWarrant,
  CorrelationBreakdown,
  WalletNode,
} from '../engine/forensicEngine';
import { ShieldAlert, Download, Lock, CheckCircle2, FileText } from 'lucide-react';

interface FreezeWarrantsViewProps {
  warrants: FreezeWarrant[];
  correlations: CorrelationBreakdown[];
  nodes: WalletNode[];
  frozenWalletIds: string[];
  onIssueFreeze: (walletId: string) => void;
  onExportJson: () => void;
}

export const FreezeWarrantsView: React.FC<FreezeWarrantsViewProps> = ({
  warrants,
  correlations,
  nodes,
  frozenWalletIds,
  onIssueFreeze,
  onExportJson,
}) => {
  const totalFrozenUsd = warrants.reduce((acc, w) => acc + w.frozenAmountUsd, 0);

  return (
    <div className="space-y-6">
      {/* Header & Summary Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            04. Offshore Exchange Interception &amp; Cryptographic Freeze Warrants
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <span> Mathematical Attribution Packages</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Emergency Compliance Relay for Cash-Out Endpoints</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-400">
              ${(totalFrozenUsd / 1_000_000).toFixed(2)}M / $42.00M Intercepted
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Forensic Dossier (JSON)</span>
          </button>
        </div>
      </div>

      {/* Active Freeze Warrants Registry */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Enforced Compliance &amp; Freeze Warrant Ledger ({warrants.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Signed with SHA-256 Adjacency Proof
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full text-left border-collapse text-xs font-mono tabular-nums"
            data-testid="freeze-warrants-table"
          >
            <thead>
              <tr className="border-b border-slate-800 bg-[#0B0F19] text-slate-400 font-sans font-medium">
                <th className="py-3 px-4">Warrant ID</th>
                <th className="py-3 px-4">Attributed Suspect</th>
                <th className="py-3 px-4">Target Wallet / Exchange Endpoint</th>
                <th className="py-3 px-3 text-right">Mean Δt</th>
                <th className="py-3 px-3 text-right">Posterior P(I|W)</th>
                <th className="py-3 px-4 text-right">Intercepted Volume</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {warrants.map((w) => (
                <tr key={w.warrantId} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-sky-300 font-semibold">
                    {w.warrantId}
                    <div className="text-[10px] text-slate-500">{w.createdAtUtc}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-100">{w.suspectHandle}</td>
                  <td className="py-3 px-4">
                    <div className="text-slate-200">{w.targetWalletAddress}</div>
                    <div className="text-slate-400 font-sans text-[11px]">
                      {w.exchangeEndpoint}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {w.meanLatencyDeltaSec.toFixed(2)}s
                  </td>
                  <td className="py-3 px-3 text-right text-rose-400 font-semibold">
                    {w.posteriorConfidence.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                    ${(w.frozenAmountUsd / 1_000_000).toFixed(2)}M
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-sans font-medium">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{w.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Cash-Out & Staging Endpoints Available for Interception */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">
          High-Risk Offshore Cash-Out &amp; Staging Endpoints
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Issue immediate cryptographic freeze orders to offshore exchanges and bridge guardians with attached OSINT-to-Ledger latency proofs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes
            .filter(
              (n) =>
                n.role === 'offshore_exchange' || n.role === 'staging_wallet'
            )
            .sort((a, b) => b.inflowUsd - a.inflowUsd)
            .map((node) => {
              const isFrozen = frozenWalletIds.includes(node.id);
              const linkedCorr =
                correlations.find((c) => c.targetWalletId === node.id) ||
                correlations[0];

              return (
                <div
                  key={node.id}
                  className="p-4 bg-[#0B0F19] border border-slate-800 rounded-lg flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span>{node.chain}</span>
                      <span className="font-mono tabular-nums text-sky-400">
                        Inflow: ${(node.inflowUsd / 1_000_000).toFixed(2)}M
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 mt-1">
                      {node.label}
                    </h4>
                    <p className="text-xs font-mono text-slate-400 mt-0.5 break-all">
                      {node.address}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                      <div>
                        Linked Suspect:{' '}
                        <strong className="font-mono text-slate-100">
                          {linkedCorr.suspectHandle}
                        </strong>
                      </div>
                      <div className="font-mono tabular-nums text-slate-400">
                        Gas Constant: {node.gasFingerprintGwei} gwei · Jitter: ±
                        {node.botJitterMs}ms
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onIssueFreeze(node.id)}
                    disabled={isFrozen}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      isFrozen
                        ? 'bg-slate-800/80 text-emerald-400 border border-emerald-500/30 cursor-default'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {isFrozen ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Warrant Enforced</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Issue Emergency Freeze Warrant</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Verifiable Mathematical Proof Summary Preview */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 mb-2">
          <FileText className="w-4 h-4 text-sky-400" />
          <span>Law Enforcement &amp; Exchange Compliance Mathematical Affidavit</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          This forensic dossier mathematically links the Tuesday 02:14 UTC smart contract exploit ($42,000,000 drained via primary wallet{' '}
          <code className="text-sky-300">0x7a1b9c44...4f92</code>) to real-world threat actor{' '}
          <strong className="text-slate-100">@kestrel_0x</strong> (egress IP{' '}
          <code className="text-slate-200">185.220.101.44</code>, timezone{' '}
          <code className="text-slate-200">UTC+03:00</code>). Across {correlations[0]?.matchedEventCount || 3} independent public repository commits and dark web escrow messages, the observed time-delta latency between off-chain publication and on-chain execution averaged{' '}
          <strong className="font-mono text-rose-400">
            Δt = {correlations[0]?.meanTimeDeltaSec.toFixed(2)}s
          </strong>
          , with an identical hardcoded priority fee constant of{' '}
          <code className="text-amber-300">3.14159 gwei</code> preserved across peel-chain splitters, ZK-nullifier exits, and the offshore cash-out deposit desk{' '}
          <code className="text-sky-300">0x99e4b108...c108</code>.
        </p>
      </div>
    </div>
  );
};
