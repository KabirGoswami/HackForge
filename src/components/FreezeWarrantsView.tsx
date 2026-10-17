import React from "react";
import {
  FreezeWarrant,
  CorrelationBreakdown,
  WalletNode,
} from "../engine/forensicEngine";
import {
  ShieldAlert,
  Download,
  Lock,
  CheckCircle2,
  FileText,
} from "lucide-react";

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
  const totalFrozenUsd = warrants.reduce(
    (acc, w) => acc + w.frozenAmountUsd,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="panel warrant-summary">
        <div>
          <h2>Offshore exchange interception</h2>
          <p>
            Mathematical attribution packages and emergency compliance relay for
            cash-out endpoints.
          </p>
        </div>
        <div className="intercepted-total">
          <span>Protocol assets intercepted</span>
          <strong>
            ${(totalFrozenUsd / 1_000_000).toFixed(2)}M <small>/ $42.00M</small>
          </strong>
        </div>
      </div>
      <div className="panel">
        <div className="warrant-toolbar">
          <div>
            <h3>
              Enforced compliance &amp; freeze warrant ledger ({warrants.length}
              )
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Signed with SHA-256 adjacency proof
            </p>
          </div>
          <button
            type="button"
            onClick={onExportJson}
            className="button button-secondary"
          >
            <Download size={15} />
            Export forensic dossier (JSON)
          </button>
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Enforced freeze warrant ledger"
        >
          <table
            className="w-full text-left border-collapse text-xs font-mono tabular-nums"
            data-testid="freeze-warrants-table"
          >
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-outline bg-canvas text-slate-400 font-sans font-medium">
                <th className="py-3 px-4">Warrant ID</th>
                <th className="py-3 px-4">Attributed Suspect</th>
                <th className="py-3 px-4">Target Wallet / Exchange Endpoint</th>
                <th className="py-3 px-3 text-right">Mean Δt</th>
                <th className="py-3 px-3 text-right">Posterior P(I|W)</th>
                <th className="py-3 px-4 text-right">Intercepted Volume</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/70">
              {warrants.map((w) => (
                <tr key={w.warrantId} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-sky-300 font-semibold">
                    {w.warrantId}
                    <div className="text-[10px] text-slate-500">
                      {w.createdAtUtc}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-100">
                    {w.suspectHandle}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-200">
                      {w.targetWalletAddress}
                    </div>
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
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>High-risk offshore cash-out &amp; staging endpoints</h2>
            <p>
              Issue cryptographic freeze orders to offshore exchanges and bridge
              guardians with attached OSINT-to-ledger latency proofs.
            </p>
          </div>
        </div>
        <div className="endpoint-list">
          {nodes
            .filter(
              (node) =>
                node.role === "offshore_exchange" ||
                node.role === "staging_wallet",
            )
            .sort((a, b) => b.inflowUsd - a.inflowUsd)
            .map((node) => {
              const isFrozen = frozenWalletIds.includes(node.id);
              const linkedCorr =
                correlations.find((corr) => corr.targetWalletId === node.id) ||
                correlations[0];
              return (
                <article key={node.id} className="endpoint-row">
                  <div>
                    <span className="endpoint-chain">{node.chain}</span>
                    <h4>{node.label}</h4>
                    <p>{node.address}</p>
                  </div>
                  <div className="endpoint-evidence">
                    <div>
                      Linked suspect <strong>{linkedCorr.suspectHandle}</strong>
                    </div>
                    <div>
                      Gas constant{" "}
                      <strong>{node.gasFingerprintGwei} gwei</strong>
                    </div>
                    <div>
                      Timing jitter <strong>±{node.botJitterMs}ms</strong>
                    </div>
                  </div>
                  <div className="endpoint-action">
                    <span>
                      Inflow ${(node.inflowUsd / 1_000_000).toFixed(2)}M
                    </span>
                    <button
                      type="button"
                      onClick={() => onIssueFreeze(node.id)}
                      disabled={isFrozen}
                      className={`button button-small ${isFrozen ? "button-frozen" : "button-danger"}`}
                    >
                      {isFrozen ? (
                        <Lock size={14} />
                      ) : (
                        <ShieldAlert size={14} />
                      )}
                      {isFrozen
                        ? "Warrant enforced"
                        : "Issue emergency freeze warrant"}
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2 className="flex items-center gap-2">
            <FileText size={17} className="text-accent" />
            Law enforcement &amp; exchange compliance mathematical affidavit
          </h2>
        </div>
        <p className="affidavit-body">
          This forensic dossier mathematically links the Tuesday 02:14 UTC smart
          contract exploit ($42,000,000 drained via primary wallet{" "}
          <code className="text-sky-300">0x7a1b9c44...4f92</code>) to real-world
          threat actor <strong className="text-slate-100">@kestrel_0x</strong>{" "}
          (egress IP <code className="text-slate-200">185.220.101.44</code>,
          timezone <code className="text-slate-200">UTC+03:00</code>). Across{" "}
          {correlations[0]?.matchedEventCount || 3} independent public
          repository commits and dark web escrow messages, the observed
          time-delta latency between off-chain publication and on-chain
          execution averaged{" "}
          <strong className="font-mono text-rose-400">
            Δt = {correlations[0]?.meanTimeDeltaSec.toFixed(2)}s
          </strong>
          , with an identical hardcoded priority fee constant of{" "}
          <code className="text-amber-300">3.14159 gwei</code> preserved across
          peel-chain splitters, ZK-nullifier exits, and the offshore cash-out
          deposit desk <code className="text-sky-300">0x99e4b108...c108</code>.
        </p>
      </div>
    </div>
  );
};
