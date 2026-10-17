import {
  ArrowUpRight,
  Activity,
  LockKeyhole,
  Network,
  Radar,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  CorrelationBreakdown,
  FreezeWarrant,
  OsintArtifact,
} from "../engine/forensicEngine";

interface CaseOverviewProps {
  correlations: CorrelationBreakdown[];
  artifacts: OsintArtifact[];
  warrants: FreezeWarrant[];
  bandwidthSigmaSec: number;
  totalFrozenUsd: number;
  frozenWalletIds: string[];
  onIssueFreeze: (id: string) => void;
}

export function CaseOverview({
  correlations,
  artifacts,
  warrants,
  bandwidthSigmaSec,
  totalFrozenUsd,
  frozenWalletIds,
  onIssueFreeze,
}: CaseOverviewProps) {
  const top = correlations[0];
  return (
    <div className="overview-layout">
      <div className="incident-notice">
        <span className="incident-icon">
          <ShieldAlert size={20} />
        </span>
        <div>
          <strong>DeFi protocol exploit</strong>
          <span>Tuesday 02:14:00 UTC · Active interception, hour 06:00</span>
        </div>
        <a href="#/matrix">
          Inspect fund flow <ArrowUpRight size={16} />
        </a>
      </div>

      <div className="metric-strip">
        <div className="metric metric-loss">
          <div className="metric-label">
            <Network size={15} />
            Drained protocol assets (02:14 UTC)
          </div>
          <strong className="metric-value">$42,000,000</strong>
          <p>
            Origin: <code>0x7a1b...4f92</code>
          </p>
          <p>1,597 micro-splits</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <UserRound size={15} />
            Primary attributed threat actor
          </div>
          <strong className="metric-value metric-actor">
            {top.suspectHandle}
          </strong>
          <p>
            <span className="confidence-value">
              {top.posteriorProbability.toFixed(1)}%
            </span>{" "}
            posterior confidence
          </p>
          <p>
            IP: <code>185.220.101.44</code> · Fee: <code>3.14159 gwei</code>
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <Activity size={15} />
            OSINT-to-chain mean time-delta (Δt)
          </div>
          <strong className="metric-value text-accent">
            {top.meanTimeDeltaSec.toFixed(2)}
            <small>s latency</small>
          </strong>
          <p>{artifacts.length} correlated leaks</p>
          <p>
            σ = <code>{bandwidthSigmaSec.toFixed(1)}s</code> kernel
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <LockKeyhole size={15} />
            Offshore fiat exit interception
          </div>
          <strong className="metric-value text-success">
            ${(totalFrozenUsd / 1_000_000).toFixed(2)}
            <small>M frozen</small>
          </strong>
          <p>
            {warrants.length} enforced{" "}
            {warrants.length === 1 ? "warrant" : "warrants"}
          </p>
          <p>
            Target: <code>0x99e4...c108</code>
          </p>
        </div>
      </div>

      <div className="overview-main-grid">
        <div className="panel attribution-panel">
          <div className="panel-heading">
            <div>
              <h2>Live identity-to-wallet attribution</h2>
              <p>
                Bayesian fusion of OSINT markers and Markov flow centrality.
              </p>
            </div>
            <a className="text-link" href="#/latency">
              Tune model <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="attribution-list">
            {correlations.map((corr) => {
              const isFrozen = frozenWalletIds.includes(corr.targetWalletId);
              return (
                <article className="attribution-row" key={corr.suspectId}>
                  <span className="suspect-avatar">
                    <UserRound size={20} strokeWidth={1.4} />
                  </span>
                  <div className="attribution-identity">
                    <strong>{corr.suspectHandle}</strong>
                    <p>{corr.realNameHint}</p>
                    <div className="attribution-facts">
                      <span>
                        Exit{" "}
                        <code>
                          {corr.targetWalletAddress.slice(0, 8)}..
                          {corr.targetWalletAddress.slice(-4)}
                        </code>
                      </span>
                      <span>
                        Δt <code>{corr.meanTimeDeltaSec.toFixed(2)}s</code>
                      </span>
                      <span>
                        <code>
                          ${(corr.atRiskVolumeUsd / 1_000_000).toFixed(2)}M
                        </code>{" "}
                        at risk
                      </span>
                    </div>
                  </div>
                  <div
                    className={`attribution-score ${corr.posteriorProbability >= 80 ? "text-danger" : corr.posteriorProbability >= 55 ? "text-warning" : ""}`}
                  >
                    <strong>{corr.posteriorProbability.toFixed(1)}%</strong>
                    <span>Posterior</span>
                  </div>
                  <button
                    className={`button button-small ${isFrozen ? "button-frozen" : "button-danger"}`}
                    disabled={isFrozen}
                    onClick={() => onIssueFreeze(corr.targetWalletId)}
                  >
                    {isFrozen ? (
                      <LockKeyhole size={13} />
                    ) : (
                      <ShieldAlert size={13} />
                    )}
                    {isFrozen ? "Frozen" : "Freeze"}
                  </button>
                </article>
              );
            })}
          </div>
          <div className="panel-footnote">
            <span className="status-dot" />
            Attribution updates when evidence or model parameters change.
          </div>
        </div>

        <aside className="panel case-briefing">
          <div className="panel-heading">
            <h2>Investigation brief</h2>
            <span className="briefing-icon">
              <Radar size={19} />
            </span>
          </div>
          <div className="briefing-body">
            <h3>Quantitative OSINT &amp; Blockchain Attribution Engine</h3>
            <p>
              Fusing unstructured dark web, Telegram, and GitHub repository
              markers with the 9×9 multi-chain transaction tensor via Hawkes
              time-delta latency modeling and spectral graph clustering.
            </p>
            <dl className="briefing-facts">
              <div>
                <dt>Case reference</dt>
                <dd>AT-42M-0214</dd>
              </div>
              <div>
                <dt>Exploit timestamp</dt>
                <dd>Tuesday 02:14:00 UTC</dd>
              </div>
              <div>
                <dt>Investigation phase</dt>
                <dd>
                  <span className="status-dot" />
                  Active interception
                </dd>
              </div>
              <div>
                <dt>Elapsed response</dt>
                <dd>Hour 06:00</dd>
              </div>
            </dl>
            <a
              href="#/matrix"
              className="button button-secondary briefing-action"
            >
              Open forensic matrix <ArrowUpRight size={15} />
            </a>
          </div>
        </aside>
      </div>

      <div className="workspace-shortcuts" aria-label="Investigation tools">
        <a href="#/matrix">
          <Network size={21} />
          <div>
            <strong>Follow the fund flow</strong>
            <span>Graph topology and transaction matrices</span>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a href="#/osint">
          <Radar size={21} />
          <div>
            <strong>Inspect the evidence</strong>
            <span>{artifacts.length} indexed off-chain artifacts</span>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a href="#/warrants">
          <LockKeyhole size={21} />
          <div>
            <strong>Review interceptions</strong>
            <span>
              {warrants.length} enforced freeze{" "}
              {warrants.length === 1 ? "warrant" : "warrants"}
            </span>
          </div>
          <ArrowUpRight size={17} />
        </a>
      </div>
    </div>
  );
}
