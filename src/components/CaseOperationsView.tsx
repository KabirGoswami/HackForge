import React from "react";
import { CaseOverview } from "./CaseOverview";
import { AnalystCopilot } from "./AnalystCopilot";
import type {
  CorrelationBreakdown,
  FreezeWarrant,
  OsintArtifact,
  WalletNode,
} from "../engine/forensicEngine";
import type { Investigation } from "../investigations";
import { ArrowUpRight, Bot, FileText, Radar, ShieldAlert } from "lucide-react";

interface CaseOperationsViewProps {
  investigation: Investigation;
  correlations: CorrelationBreakdown[];
  artifacts: OsintArtifact[];
  nodes: WalletNode[];
  warrants: FreezeWarrant[];
  bandwidthSigmaSec: number;
  totalFrozenUsd: number;
  frozenWalletIds: string[];
  onIssueFreeze: (id: string) => void;
  warRoomKpis?: any;
  selectedNodeId: string;
}

export const CaseOperationsView: React.FC<CaseOperationsViewProps> = ({
  investigation,
  correlations,
  artifacts,
  nodes,
  warrants,
  bandwidthSigmaSec,
  totalFrozenUsd,
  frozenWalletIds,
  onIssueFreeze,
  warRoomKpis,
  selectedNodeId,
}) => {
  const hasLedger = nodes.length > 0;

  return (
    <div className="case-operations-view space-y-6">
      {/* Top operational summary banner */}
      <div className="panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-outline bg-surface">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-iris/20 text-iris text-xs font-mono font-medium">
              <ShieldAlert size={12} />
              Operational Dossier
            </span>
            <span className="text-xs text-muted font-mono">
              Case #{investigation.reference}
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-100">
            Incident Operations &amp; Intelligence Copilot
          </h2>
          <p className="text-xs text-muted mt-0.5 max-w-2xl">
            Correlated entities, asset freeze enforcement status, and real-time AI copilot reasoning over Bayesian links.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a
            href="#/"
            className="button button-sm button-secondary flex items-center gap-1 text-xs"
          >
            <span>Return to Evidence Bridge</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      {/* Main operational workspace */}
      {hasLedger && correlations.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Main Case Overview - 2 Cols */}
          <div className="xl:col-span-2 space-y-6">
            <CaseOverview
              correlations={correlations}
              artifacts={artifacts}
              warrants={warrants}
              bandwidthSigmaSec={bandwidthSigmaSec}
              totalFrozenUsd={totalFrozenUsd}
              frozenWalletIds={frozenWalletIds}
              onIssueFreeze={onIssueFreeze}
              warRoomKpis={warRoomKpis}
            />
          </div>

          {/* AI Copilot Intelligence Terminal - 1 Col */}
          <div className="xl:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Bot size={15} className="text-sky-400" />
                <span>Forensic Copilot Terminal</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                Live Copilot
              </span>
            </div>
            <div className="rounded-xl border border-outline overflow-hidden shadow-lg bg-surface">
              <AnalystCopilot suspectId={selectedNodeId} />
            </div>
          </div>
        </div>
      ) : (
        <div className="investigation-empty-state">
          <Radar size={28} className="text-iris" />
          <h2 className="text-lg font-semibold text-slate-100 mt-3 mb-1">
            {investigation.title}
          </h2>
          <p className="text-xs text-muted max-w-lg mb-4">
            {investigation.description ||
              "A new investigation, ready for evidence. Collect off-chain OSINT signals or add ledger transactions to generate the operational dossier."}
          </p>
          <div className="flex items-center gap-3">
            <a href="#/osint" className="button button-sm button-primary flex items-center gap-1.5 text-xs">
              <span>Collect OSINT evidence</span>
              <ArrowUpRight size={13} />
            </a>
            <a href="#/" className="button button-sm button-secondary text-xs">
              View Evidence Bridge
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
