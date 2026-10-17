import React, { useState, useMemo } from 'react';
import {
  INITIAL_WALLET_NODES,
  INITIAL_LEDGER_EDGES,
  INITIAL_OSINT_ARTIFACTS,
  INITIAL_SUSPECTS,
  PRESET_SCRAPE_FEEDS,
  OsintArtifact,
  FreezeWarrant,
  correlateIdentities,
} from './engine/forensicEngine';
import { MatrixGraphCanvas } from './components/MatrixGraphCanvas';
import { OsintScraperPanel } from './components/OsintScraperPanel';
import { LatencyAnalysisView } from './components/LatencyAnalysisView';
import { FreezeWarrantsView } from './components/FreezeWarrantsView';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

type ActiveSection = 'matrix' | 'osint' | 'latency' | 'warrants';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('matrix');
  const [nodes] = useState(INITIAL_WALLET_NODES);
  const [edges] = useState(INITIAL_LEDGER_EDGES);
  const [artifacts, setArtifacts] = useState<OsintArtifact[]>(INITIAL_OSINT_ARTIFACTS);
  const [presetIndex, setPresetIndex] = useState<number>(0);

  // Selected wallet cluster & suspect
  const [selectedNodeId, setSelectedNodeId] = useState<string>('w-cex-offshore-1');
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>('susp-kestrel');

  // Statistical modeling parameters
  const [bandwidthSigmaSec, setBandwidthSigmaSec] = useState<number>(4.5);
  const [mixerEntropyWeight, setMixerEntropyWeight] = useState<number>(0.35);

  // Enforced Freeze Warrants
  const [warrants, setWarrants] = useState<FreezeWarrant[]>([
    {
      warrantId: 'WRN-2026-0891',
      createdAtUtc: '08:02:11 UTC',
      suspectHandle: '@kestrel_0x',
      targetWalletAddress: '0xc409e881b27a4401f932d110e87a5502b991f312',
      exchangeEndpoint: 'Consolidation Staging Vault (0xc409...f312)',
      frozenAmountUsd: 1_120_000,
      posteriorConfidence: 96.4,
      primaryEvidenceHash: '0x8f3a91d...e719a402',
      meanLatencyDeltaSec: 1.43,
      status: 'ENFORCED_FREEZE',
    },
  ]);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const frozenWalletIds = useMemo(() => {
    return warrants.map((w) => {
      const found = nodes.find((n) => n.address === w.targetWalletAddress);
      return found ? found.id : '';
    });
  }, [warrants, nodes]);

  // Real-time Bayesian correlation computation
  const correlations = useMemo(() => {
    return correlateIdentities(
      nodes,
      edges,
      artifacts,
      INITIAL_SUSPECTS,
      bandwidthSigmaSec,
      mixerEntropyWeight
    );
  }, [nodes, edges, artifacts, bandwidthSigmaSec, mixerEntropyWeight]);

  const topSuspect = correlations[0];

  const totalFrozenUsd = useMemo(
    () => warrants.reduce((sum, w) => sum + w.frozenAmountUsd, 0),
    [warrants]
  );

  // Handler: Scrape next queued live threat feed
  const handleScrapePresetFeed = () => {
    if (presetIndex >= PRESET_SCRAPE_FEEDS.length) return;
    const rawPreset = PRESET_SCRAPE_FEEDS[presetIndex];
    const newArtifact: OsintArtifact = {
      ...rawPreset,
      id: `osint-scraped-${Date.now()}`,
    };
    setArtifacts((prev) => [newArtifact, ...prev]);
    setPresetIndex((prev) => prev + 1);
    setStatusBanner(
      `Scraped new ${newArtifact.sourceType} from ${newArtifact.authorAlias} — Extracted IP ${newArtifact.extractedIps.join(', ')} and updated Bayesian posterior matrix.`
    );
  };

  // Handler: Add custom OSINT artifact
  const handleAddArtifact = (newArt: OsintArtifact) => {
    setArtifacts((prev) => [newArt, ...prev]);
    setStatusBanner(
      `Fused custom ${newArt.sourceType} artifact (${newArt.authorAlias}) into the blockchain correlation tensor.`
    );
  };

  // Handler: Issue Freeze Warrant on a wallet cluster
  const handleIssueFreeze = (walletId: string) => {
    const targetNode = nodes.find((n) => n.id === walletId);
    if (!targetNode) return;
    if (frozenWalletIds.includes(walletId)) return;

    const matchedCorr =
      correlations.find((c) => c.targetWalletId === walletId) || topSuspect;

    const newWarrant: FreezeWarrant = {
      warrantId: `WRN-2026-0${892 + warrants.length}`,
      createdAtUtc: '08:14:22 UTC',
      suspectHandle: matchedCorr.suspectHandle,
      targetWalletAddress: targetNode.address,
      exchangeEndpoint: targetNode.label,
      frozenAmountUsd: targetNode.inflowUsd,
      posteriorConfidence: matchedCorr.posteriorProbability,
      primaryEvidenceHash: `0x${targetNode.address.slice(2, 10)}...c108`,
      meanLatencyDeltaSec: matchedCorr.meanTimeDeltaSec,
      status: 'ENFORCED_FREEZE',
    };

    setWarrants((prev) => [newWarrant, ...prev]);
    setStatusBanner(
      `Emergency Freeze Warrant ${newWarrant.warrantId} enforced on ${targetNode.label} ($${(
        targetNode.inflowUsd / 1_000_000
      ).toFixed(2)}M intercepted).`
    );
  };

  // Handler: Export Forensic Dossier JSON
  const handleExportDossier = () => {
    const payload = {
      incident: 'Tuesday 02:14 UTC DeFi Protocol Exploit ($42,000,000)',
      generatedAtUtc: new Date().toISOString(),
      topAttribution: topSuspect,
      correlations,
      enforcedWarrants: warrants,
      osintArtifactCount: artifacts.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aethertrace-forensic-dossier.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner(
      'Exported cryptographic attribution dossier (aethertrace-forensic-dossier.json).'
    );
  };

  const primaryCashOutFrozen = frozenWalletIds.includes('w-cex-offshore-1');

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract (responsive wrap on small screens) */}
      <header className="flex flex-wrap items-center justify-between gap-y-3 gap-x-8 px-4 sm:px-6 py-4 border-b border-slate-800 bg-[#0B0F19]">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('matrix');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          AetherTrace
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="order-3 md:order-2 w-full md:w-auto flex items-center justify-between sm:justify-start gap-2 sm:gap-6 text-[11px] sm:text-sm font-medium text-slate-400 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/70"
        >
          <button
            type="button"
            onClick={() => setActiveSection('matrix')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'matrix'
                ? 'text-slate-100 border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Forensic Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('osint')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'osint'
                ? 'text-slate-100 border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            OSINT Scraper
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('latency')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'latency'
                ? 'text-slate-100 border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Latency Model
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('warrants')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'warrants'
                ? 'text-slate-100 border-sky-400'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Freeze Warrants
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="order-2 md:order-3 flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!primaryCashOutFrozen) {
                handleIssueFreeze('w-cex-offshore-1');
              } else {
                handleExportDossier();
              }
            }}
            className={`px-3.5 sm:px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              primaryCashOutFrozen
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
          >
            {primaryCashOutFrozen
              ? 'Export Forensic Dossier'
              : 'Freeze $27.28M Cash-Out'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Incident Context Header & Quantitative Telemetry Strip */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 font-mono">
                <span>INCIDENT CASE #AT-42M-0214</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>TUESDAY 02:14:00 UTC EXPLOIT TRACE</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>HOUR 06:00 ACTIVE INTERCEPTION</span>
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight mt-1"
                style={{ textWrap: 'balance' }}
              >
                Quantitative OSINT &amp; Blockchain Attribution Engine
              </h1>
            </div>

            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Fusing unstructured dark web, Telegram, and GitHub repository markers with the 9×9 multi-chain transaction tensor via Hawkes time-delta latency modeling and spectral graph clustering.
            </p>
          </div>

          {/* Live Action Feedback Notification */}
          {statusBanner && (
            <div
              role="status"
              className="px-4 py-2.5 bg-sky-950/40 border border-sky-500/40 rounded-lg flex items-center justify-between gap-4 text-xs text-sky-200"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{statusBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 4-Column Full-Width KPI Telemetry Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-lg">
              <div className="text-xs text-slate-400">
                Drained Protocol Assets (02:14 UTC)
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums mt-1">
                $42,000,000
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                <span>Origin: 0x7a1b...4f92</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>1,597 Micro-Splits</span>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border border-slate-800 rounded-lg">
              <div className="text-xs text-slate-400">
                Primary Attributed Threat Actor
              </div>
              <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums mt-1">
                {topSuspect.suspectHandle} ({topSuspect.posteriorProbability.toFixed(1)}%)
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                <span>IP: 185.220.101.44</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Fee: 3.14159 gwei</span>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border border-slate-800 rounded-lg">
              <div className="text-xs text-slate-400">
                OSINT-to-Chain Mean Time-Delta (Δt)
              </div>
              <div className="text-2xl font-bold text-sky-400 font-mono tabular-nums mt-1">
                {topSuspect.meanTimeDeltaSec.toFixed(2)}s Latency
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                <span>{artifacts.length} Correlated Leaks</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>σ = {bandwidthSigmaSec.toFixed(1)}s Kernel</span>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border border-slate-800 rounded-lg">
              <div className="text-xs text-slate-400">
                Offshore Fiat Exit Interception
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
                ${(totalFrozenUsd / 1_000_000).toFixed(2)}M Frozen
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                <span>{warrants.length} Enforced Warrants</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Target: 0x99e4...c108</span>
              </div>
            </div>
          </div>
        </section>

        {/* Active View Switch */}
        {activeSection === 'matrix' && (
          <div className="space-y-6">
            {/* Primary War Room Grid: Left 7 Cols Ledger Matrix/Graph, Right 5 Cols OSINT & Attribution Bridge */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7">
                <MatrixGraphCanvas
                  nodes={nodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  frozenWalletIds={frozenWalletIds}
                  onIssueFreeze={handleIssueFreeze}
                />
              </div>

              <div className="xl:col-span-5 space-y-6">
                {/* Live Bayesian Identity Bridge Card */}
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">
                        Live Identity-to-Wallet Attribution Matrix
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Real-time Bayesian fusion of scraped OSINT markers and Markov flow centrality
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('latency')}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Tune Model</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {correlations.map((corr) => {
                      const isFrozen = frozenWalletIds.includes(corr.targetWalletId);
                      return (
                        <div
                          key={corr.suspectId}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-mono text-slate-100">
                                {corr.suspectHandle}
                              </span>
                              <span className="text-xs text-slate-400 truncate">
                                · {corr.realNameHint}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                              <span>Exit: {corr.targetWalletAddress.slice(0, 8)}..{corr.targetWalletAddress.slice(-4)}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>Δt = {corr.meanTimeDeltaSec.toFixed(2)}s</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>${(corr.atRiskVolumeUsd / 1_000_000).toFixed(2)}M</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right font-mono tabular-nums">
                              <div
                                className={`text-sm font-bold ${
                                  corr.posteriorProbability >= 80
                                    ? 'text-rose-400'
                                    : corr.posteriorProbability >= 55
                                    ? 'text-amber-300'
                                    : 'text-slate-300'
                                }`}
                              >
                                {corr.posteriorProbability.toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Posterior
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleIssueFreeze(corr.targetWalletId)}
                              disabled={isFrozen}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                                isFrozen
                                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-default'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white'
                              }`}
                            >
                              {isFrozen ? 'Frozen' : 'Freeze'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live OSINT Threat Feed Scraper Panel */}
                <OsintScraperPanel
                  artifacts={artifacts}
                  onAddArtifact={handleAddArtifact}
                  onScrapePresetFeed={handleScrapePresetFeed}
                  remainingPresetsCount={
                    PRESET_SCRAPE_FEEDS.length - presetIndex
                  }
                  compact
                />
              </div>
            </div>

            {/* Full Statistical Latency & Attribution Section Below */}
            <LatencyAnalysisView
              correlations={correlations}
              bandwidthSigmaSec={bandwidthSigmaSec}
              onChangeBandwidthSigma={setBandwidthSigmaSec}
              mixerEntropyWeight={mixerEntropyWeight}
              onChangeMixerEntropyWeight={setMixerEntropyWeight}
              edges={edges}
              artifacts={artifacts}
              nodes={nodes}
              frozenWalletIds={frozenWalletIds}
              onIssueFreeze={handleIssueFreeze}
              selectedSuspectId={selectedSuspectId}
              onSelectSuspect={setSelectedSuspectId}
            />
          </div>
        )}

        {activeSection === 'osint' && (
          <OsintScraperPanel
            artifacts={artifacts}
            onAddArtifact={handleAddArtifact}
            onScrapePresetFeed={handleScrapePresetFeed}
            remainingPresetsCount={PRESET_SCRAPE_FEEDS.length - presetIndex}
          />
        )}

        {activeSection === 'latency' && (
          <LatencyAnalysisView
            correlations={correlations}
            bandwidthSigmaSec={bandwidthSigmaSec}
            onChangeBandwidthSigma={setBandwidthSigmaSec}
            mixerEntropyWeight={mixerEntropyWeight}
            onChangeMixerEntropyWeight={setMixerEntropyWeight}
            edges={edges}
            artifacts={artifacts}
            nodes={nodes}
            frozenWalletIds={frozenWalletIds}
            onIssueFreeze={handleIssueFreeze}
            selectedSuspectId={selectedSuspectId}
            onSelectSuspect={setSelectedSuspectId}
          />
        )}

        {activeSection === 'warrants' && (
          <FreezeWarrantsView
            warrants={warrants}
            correlations={correlations}
            nodes={nodes}
            frozenWalletIds={frozenWalletIds}
            onIssueFreeze={handleIssueFreeze}
            onExportJson={handleExportDossier}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 mt-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1440px] w-full mx-auto">
        <div>
          AetherTrace Quantitative Forensic Engine · Case Reference #AT-42M-0214
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExportDossier}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            Download JSON Dossier
          </button>
        </div>
      </footer>
    </div>
  );
}
