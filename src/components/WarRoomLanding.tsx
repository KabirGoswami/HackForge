import { useEffect, useId, useRef, useState, type Ref } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Fingerprint, GitCommitHorizontal, Link2, Network, Radar, X } from "lucide-react";
import type { CorrelationBreakdown, LedgerEdge, OsintArtifact, WalletNode } from "../engine/forensicEngine";
import type { Investigation } from "../investigations";
import "./WarRoomLanding.css";

interface WarRoomLandingProps {
  investigation: Pick<Investigation, "title" | "reference" | "description" | "drainedUsd" | "exploitLabel" | "mode">;
  headingRef?: Ref<HTMLHeadingElement>;
  correlations: CorrelationBreakdown[];
  artifacts: OsintArtifact[];
  nodes: WalletNode[];
  edges: LedgerEdge[];
  totalFrozenUsd: number;
}

function matchesWallet(reference: string, address: string) {
  const [prefix, suffix] = reference.toLowerCase().split(/\.{2,3}/);
  return /^0x[\da-f]{4,}$/.test(prefix) && address.toLowerCase().startsWith(prefix)
    && (!suffix || address.toLowerCase().endsWith(suffix));
}

const shortAddress = (address: string) => `${address.slice(0, 8)}…${address.slice(-4)}`;
const replayTime = (seconds: number) =>
  `${new Date(Date.UTC(2026, 0, 1, 2, 14) + seconds * 1000).toISOString().slice(11, 23)} UTC`;

export function WarRoomLanding({ investigation, headingRef, correlations, artifacts, nodes, edges, totalFrozenUsd }: WarRoomLandingProps) {
  const [suspectId, setSuspectId] = useState(correlations[0]?.suspectId ?? "");
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = correlations.find((item) => item.suspectId === suspectId) ?? correlations[0];
  const source = selected?.matchedArtifacts.find((item) => item.id === artifactId) ?? selected?.matchedArtifacts[0];
  const target = nodes.find((node) => node.id === selected?.targetWalletId);
  const nearest = source ? edges.reduce<LedgerEdge | undefined>((closest, edge) =>
    !closest || Math.abs(edge.timestampSec - source.timestampSec) < Math.abs(closest.timestampSec - source.timestampSec)
      ? edge : closest, undefined) : undefined;
  const delta = source && nearest ? nearest.timestampSec - source.timestampSec : null;
  const feeMatches = source?.extractedGasQuirk !== undefined
    ? nodes.filter((node) => Math.abs(node.gasFingerprintGwei - source.extractedGasQuirk!) < 0.000001) : [];
  const referencedWallets = source ? nodes.filter((node) => source.extractedWallets.some((wallet) => matchesWallet(wallet, node.address))) : [];
  const hasEvidence = Boolean(source && selected && target);
  const amountLabel = investigation.drainedUsd >= 1_000_000 ? `$${(investigation.drainedUsd / 1_000_000).toFixed(0)}M` : `$${investigation.drainedUsd.toLocaleString()}`;

  useEffect(() => {
    if (inspecting) dialogRef.current?.showModal();
  }, [inspecting]);

  useEffect(() => {
    const close = () => dialogRef.current?.close();
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  return (
    <div className="war-room-landing">
      <div className="war-room-intro">
        <div>
          <span className="war-room-case-label"><span className="status-dot" /> Case #{investigation.reference} <span>{investigation.mode === "replay" ? "Replay investigation" : "Active investigation"}</span></span>
          <h1 ref={headingRef} id={headingRef ? "workspace-title" : undefined} tabIndex={-1}>{investigation.title}<span>The hunt has two fronts.</span></h1>
          <p>One team follows the human. The other follows the money. The evidence meets in the middle.</p>
        </div>
        <span className="war-room-incident"><strong>{investigation.mode === "replay" ? amountLabel : `${artifacts.length} ${artifacts.length === 1 ? "source" : "sources"}`}</strong><span>{investigation.exploitLabel}</span></span>
      </div>

      <section className="war-room-arena" aria-label="Choose your investigation team">
        <div className="war-room-scenery" aria-hidden="true">
          <svg viewBox="0 0 1200 640" preserveAspectRatio="none">
            <path d="M0 116H200L325 242H445M1200 116H1000L875 242H755" />
            <path d="M0 442H260L350 352H445M1200 442H940L850 352H755" />
            <path d="M56 640V556L224 388M1144 640V556L976 388" />
            <circle cx="325" cy="242" r="5" /><circle cx="875" cy="242" r="5" />
            <circle cx="350" cy="352" r="5" /><circle cx="850" cy="352" r="5" />
          </svg>
        </div>

        <a className="war-team war-team-osint" href="#/osint" aria-label="Enter OSINT investigators workspace">
          <div className="war-team-heading">
            <span className="war-team-label"><Radar size={16} /> OSINT investigators</span>
            <h3>Follow<br />the human.</h3>
            <p>Find the aliases. Surface the signals.<br />Turn a fragment into an identity.</p>
          </div>
          <div className="war-team-emblem"><OsintTerritory alias={source?.authorAlias ?? "Identity unknown"} ip={source?.extractedIps[0] ?? "No markers indexed"} /></div>
          <div className="war-team-evidence">
            <span><GitCommitHorizontal size={13} /> Off-chain intelligence</span>
            <code>{source?.authorAlias ?? "No indexed identity"}</code>
            <div><span>{artifacts.length} indexed sources</span><span>GitHub · Telegram · Dark web</span></div>
          </div>
          <div className="war-team-footer"><span className="war-team-enter">Enter OSINT workspace <ArrowRight size={18} /></span></div>
        </a>

        <div className="war-bridge-column">
          <span className="war-bridge-link-label"><Link2 size={13} /> Shared intelligence</span>
          <div className="war-bridge-symbol"><BridgeStructure /></div>
          <h3>Evidence<br />Bridge</h3>
          <p>Where the identity<br />meets the transaction.</p>
          {selected && <div className="war-bridge-selector">
            <label htmlFor="war-bridge-suspect">Trace a connection</label>
            <select id="war-bridge-suspect" value={selected.suspectId} onChange={(event) => { setSuspectId(event.target.value); setArtifactId(null); }}>
              {correlations.map((correlation) => <option key={correlation.suspectId} value={correlation.suspectId}>{correlation.suspectHandle}</option>)}
            </select>
          </div>}
          <div className="war-bridge-proof" aria-live="polite">
            <div><span>Fee fingerprint</span><code>{feeMatches.length ? `${source!.extractedGasQuirk} gwei` : "No fee match"}</code></div>
            <div><span>Event → transaction</span><code>{delta !== null ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}s` : "No indexed pair"}</code></div>
          </div>
          <button className="war-bridge-open" onClick={() => setInspecting(true)} disabled={!hasEvidence}>Inspect the bridge <ArrowUpRight size={16} /></button>
          <div className="war-bridge-score"><strong>{selected ? `${selected.posteriorProbability.toFixed(1)}%` : "—"}</strong><span>model score</span></div>
        </div>

        <a className="war-team war-team-ledger" href="#/matrix" aria-label="Enter blockchain analysts workspace">
          <div className="war-team-heading">
            <span className="war-team-label"><Network size={16} /> Blockchain analysts</span>
            <h3>Follow<br />the money.</h3>
            <p>Trace the hops. Unmask the clusters.<br />Find the funds before they disappear.</p>
          </div>
          <div className="war-team-emblem"><LedgerTerritory amount={amountLabel} address={target ? shortAddress(target.address) : "No wallet indexed"} /></div>
          <div className="war-team-evidence">
            <span><Network size={13} /> On-chain forensics</span>
            <code>{target ? shortAddress(target.address) : "No indexed wallet"}</code>
            <div><span>{nodes.length} wallet clusters</span><span>{edges.length} transaction paths</span></div>
          </div>
          <div className="war-team-footer"><span className="war-team-enter">Enter ledger workspace <ArrowRight size={18} /></span></div>
        </a>
      </section>

      <div className="war-room-case-strip" aria-label="Shared investigation summary">
        <span><Fingerprint size={16} /><strong>{correlations.length}</strong> correlated identities</span>
        <span><strong>${(totalFrozenUsd / 1_000_000).toFixed(2)}M</strong> frozen</span>
        <span>One case. Two disciplines. A connected trail.</span>
        <a href="#case-operations" onClick={(event) => {
          event.preventDefault();
          const details = document.getElementById("case-operations") as HTMLDetailsElement | null;
          if (details) { details.open = true; details.querySelector("summary")?.focus(); details.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }
        }}>Case operations <ArrowDown size={13} /></a>
      </div>

      <dialog ref={dialogRef} className="war-bridge-dialog" aria-labelledby="war-bridge-dialog-title" onClose={() => setInspecting(false)} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
        <div className="war-bridge-dialog-header">
          <div><span><Link2 size={14} /> {investigation.title} · Evidence Bridge</span><h2 id="war-bridge-dialog-title">Inspect the connection</h2></div>
          <button className="icon-button" aria-label="Close Evidence Bridge" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
        </div>
        {selected && source && target && <>
          <div className="war-bridge-dialog-grid">
            <section className="war-bridge-detail-source">
              <h3><Radar size={15} /> OSINT evidence</h3>
              <strong className="war-detail-handle">{selected.suspectHandle}</strong>
              <p>{selected.realNameHint}</p>
              <label htmlFor="war-bridge-artifact">Source artifact</label>
              <select id="war-bridge-artifact" value={source.id} onChange={(event) => setArtifactId(event.target.value)}>{selected.matchedArtifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.id} · {artifact.sourceType}</option>)}</select>
              <time>{source.timestampUtc}</time><blockquote>{source.rawText}</blockquote>
              <p className="war-detail-origin">{source.sourceOrigin}</p>
              <div className="war-detail-markers">{source.extractedIps.map((ip) => <code key={ip}>{ip}</code>)}{source.extractedWallets.map((wallet) => <code key={wallet}>{wallet}</code>)}</div>
              <a href="#/osint">Open full OSINT workspace <ArrowRight size={12} /></a>
            </section>
            <section className="war-bridge-detail-reasons" aria-live="polite">
              <h3><Link2 size={15} /> Matching reasons</h3>
              <div><span>Fee match</span><strong>{feeMatches.length ? `${source.extractedGasQuirk} gwei` : "No shared fee fingerprint"}</strong><p>{feeMatches.length ? `${source.id} · ${feeMatches.length} wallets share this extracted gas constant.` : `${source.id} has no matching indexed wallet fee.`}</p></div>
              <div><span>Wallet reference</span><strong>{referencedWallets.length} indexed {referencedWallets.length === 1 ? "match" : "matches"}</strong><p>{referencedWallets.map((node) => shortAddress(node.address)).join(" · ") || "No direct address match in this source."}</p></div>
              <div><span>Timing association</span><strong>{delta !== null ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}s` : "No indexed pair"}</strong><p>{source.id} → {nearest?.id ?? "—"}. Closest indexed transaction; model mean Δt {selected.meanTimeDeltaSec.toFixed(2)}s.</p></div>
              <div><span>Graph proximity</span><strong>{(selected.graphClusterScore * 100).toFixed(1)}% cluster affinity</strong><p>Existing Markov flow model for the target wallet.</p></div>
              <div className="war-detail-score"><span>Model score</span><strong>{selected.posteriorProbability.toFixed(1)}%</strong><p>{selected.status}</p></div>
            </section>
            <section className="war-bridge-detail-wallet">
              <h3><Network size={15} /> Ledger endpoint</h3><strong className="war-detail-handle">{target.label}</strong>
              <code className="war-detail-address">{target.address}</code>
              <dl><div><dt>Chain</dt><dd>{target.chain}</dd></div><div><dt>Wallet cluster</dt><dd>{target.clusterId}</dd></div><div><dt>Inflow</dt><dd>${(target.inflowUsd / 1_000_000).toFixed(2)}M</dd></div><div><dt>Outflow</dt><dd>${(target.outflowUsd / 1_000_000).toFixed(2)}M</dd></div><div><dt>Gas signature</dt><dd>{target.gasFingerprintGwei} gwei</dd></div><div><dt>Timing jitter</dt><dd>±{target.botJitterMs}ms</dd></div></dl>
              {nearest && <div className="war-detail-transaction"><span>Nearest ledger event · {nearest.id}</span><time>{replayTime(nearest.timestampSec)}</time><code>{nearest.txHash}</code><p>${(nearest.amountUsd / 1_000_000).toFixed(2)}M · {nearest.txCount} transactions</p></div>}
              <a href="#/matrix">Open full ledger workspace <ArrowRight size={12} /></a>
            </section>
          </div>
          <p className="war-bridge-dialog-note">{investigation.mode === "replay" ? "Replay data. " : ""}These are model associations; a shared fee or a close timestamp alone does not establish identity.</p>
        </>}
      </dialog>
    </div>
  );
}

function OsintTerritory({ alias, ip }: { alias: string; ip: string }) {
  return <svg viewBox="0 0 330 210" fill="none" aria-hidden="true">
    <circle cx="174" cy="106" r="84" stroke="currentColor" strokeOpacity=".12" />
    <circle cx="174" cy="106" r="62" stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 7" />
    <path d="M174 10V29M174 184V202M78 106H96M252 106H270" stroke="currentColor" strokeOpacity=".5" />
    <path d="M38 56H80L115 90M256 148H290V105M58 165H104L126 143" stroke="currentColor" strokeOpacity=".5" />
    <rect x="45" y="27" width="145" height="91" rx="5" fill="#302239" stroke="currentColor" strokeOpacity=".4" transform="rotate(-10 45 27)" />
    <rect x="112" y="85" width="168" height="98" rx="5" fill="#322536" stroke="currentColor" strokeOpacity=".45" transform="rotate(8 112 85)" />
    <rect x="82" y="53" width="170" height="108" rx="6" fill="#382b40" stroke="currentColor" strokeOpacity=".75" />
    <path d="M82 79H252" stroke="currentColor" strokeOpacity=".25" />
    <circle cx="96" cy="66" r="3" fill="currentColor" /><circle cx="106" cy="66" r="3" fill="currentColor" opacity=".5" /><circle cx="116" cy="66" r="3" fill="currentColor" opacity=".25" />
    <text x="98" y="102" fill="currentColor" fontSize="12" fontFamily="var(--font-mono)">{alias.slice(0, 18)}</text>
    <text x="98" y="124" fill="#d2bfcf" fontSize="10" fontFamily="var(--font-mono)">{ip}</text>
    <path d="M98 139H158M165 139H192M199 139H232" stroke="currentColor" strokeOpacity=".4" strokeWidth="3" />
    <circle cx="45" cy="56" r="5" fill="#322536" stroke="currentColor" /><circle cx="290" cy="105" r="5" fill="#322536" stroke="currentColor" />
  </svg>;
}

function LedgerTerritory({ amount, address }: { amount: string; address: string }) {
  return <svg viewBox="0 0 330 210" fill="none" aria-hidden="true">
    <path d="M42 106H105L150 55H205M105 106L150 158H205M205 55L258 106M205 158L258 106H302" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
    <path d="M20 28H80L116 64M314 178H270L240 149" stroke="currentColor" strokeOpacity=".2" />
    <circle cx="165" cy="106" r="89" stroke="currentColor" strokeOpacity=".12" />
    <circle cx="165" cy="106" r="66" stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 7" />
    <LedgerBlock x={42} y={106} size={22} /><LedgerBlock x={165} y={55} size={27} />
    <LedgerBlock x={165} y={157} size={27} /><LedgerBlock x={270} y={106} size={31} />
    <circle cx="105" cy="106" r="5" fill="#25283c" stroke="currentColor" />
    <text x="102" y="111" textAnchor="end" fill="currentColor" fontSize="9" fontFamily="var(--font-mono)">{amount}</text>
    <text x="267" y="164" textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="var(--font-mono)">{address}</text>
  </svg>;
}

function LedgerBlock({ x, y, size }: { x: number; y: number; size: number }) {
  return <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.2"><path d={`M0 ${-size}L${size} ${-size / 2}V${size / 2}L0 ${size}L${-size} ${size / 2}V${-size / 2}Z`} fill="#293047" /><path d={`M${-size} ${-size / 2}L0 0L${size} ${-size / 2}M0 0V${size}`} /><path d={`M0 ${-size}L${size} ${-size / 2}L0 0L${-size} ${-size / 2}Z`} fill="currentColor" fillOpacity=".12" /></g>;
}

function BridgeStructure() {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="0 0 280 132" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-bridge`} x1="0" y1="0" x2="280" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#dea879" /><stop offset=".5" stopColor="#c7a4ff" /><stop offset="1" stopColor="#84bfd9" /></linearGradient></defs>
    <g stroke={`url(#${id}-bridge)`} strokeWidth="1.5"><path d="M8 103H272M8 111H272M59 106V23H68V106M212 106V23H221V106" /><path d="M8 99Q37 83 62 30Q140 133 217 30Q244 83 272 99" strokeWidth="2" /><path d="M23 90V103M40 70V103M85 57V103M105 75V103M125 83V103M145 85V103M165 80V103M185 68V103M201 49V103M239 72V103M256 92V103" strokeOpacity=".7" /><path d="M48 122H79M201 122H232M8 111L26 103L44 111L62 103L80 111L98 103L116 111L134 103L152 111L170 103L188 111L206 103L224 111L242 103L260 111L272 103" strokeOpacity=".6" /></g>
  </svg>;
}
