import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PRESET_SCRAPE_FEEDS,
  OsintArtifact,
  FreezeWarrant,
  correlateIdentities,
} from "./engine/forensicEngine";
import { MatrixGraphCanvas } from "./components/MatrixGraphCanvas";
import { OsintScraperPanel } from "./components/OsintScraperPanel";
import { LatencyAnalysisView } from "./components/LatencyAnalysisView";
import { FreezeWarrantsView } from "./components/FreezeWarrantsView";
import { CaseOverview } from "./components/CaseOverview";
import { AlertsPanel } from "./components/AlertsPanel";
import { AnalystCopilot } from "./components/AnalystCopilot";
import { WarRoomLanding } from "./components/WarRoomLanding";
import { InvestigationSelector } from "./components/InvestigationSelector";
import { AnalysisControlPanel } from "./components/AnalysisControlPanel";
import { createInvestigation, loadInvestigationStore, saveInvestigationStore, type Investigation } from "./investigations";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  LayoutDashboard,
  Menu,
  Network,
  Radar,
  ShieldAlert,
  X,
} from "lucide-react";


const workspaces = [
  {
    id: "home",
    title: "Home",
    description: "Two investigation teams, connected by evidence.",
    icon: LayoutDashboard,
  },
  {
    id: "matrix",
    title: "Forensic matrix",
    description: "Trace the movement of funds across nine wallet clusters.",
    icon: Network,
  },
  {
    id: "osint",
    title: "OSINT evidence",
    description: "Collect, inspect, and correlate off-chain identity markers.",
    icon: Radar,
  },
  {
    id: "latency",
    title: "Latency model",
    description:
      "Test attribution through timing, behavior, and graph affinity.",
    icon: Activity,
  },
  {
    id: "warrants",
    title: "Freeze warrants",
    description: "Manage cash-out interception and the supporting evidence.",
    icon: FileCheck2,
  },
] as const;
type ActiveSection = (typeof workspaces)[number]["id"];
const readSection = (): ActiveSection => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return workspaces.find((workspace) => workspace.id === id)?.id ?? "home";
};

export default function App() {
  const [store, setStore] = useState(loadInvestigationStore);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [focusInvestigation, setFocusInvestigation] = useState(false);
  const investigation = store.investigations.find((item) => item.id === store.activeInvestigationId)!;

  useEffect(() => {
    setStorageUnavailable(!saveInvestigationStore(store));
  }, [store]);

  const handleSelectInvestigation = useCallback((id: string) => {
    setFocusInvestigation(true);
    window.location.hash = "#/";
    setStore((previous) => previous.investigations.some((item) => item.id === id)
      ? { ...previous, activeInvestigationId: id } : previous);
  }, []);

  const handleCreateInvestigation = useCallback((details: { title: string; description: string }) => {
    setFocusInvestigation(true);
    window.location.hash = "#/";
    setStore((previous) => {
      const created = createInvestigation(details, previous.investigations);
      return { ...previous, activeInvestigationId: created.id, investigations: [...previous.investigations, created] };
    });
  }, []);

  const handleUpdateInvestigation = useCallback((id: string, patch: Partial<Investigation>) => {
    setStore((previous) => {
      const current = previous.investigations.find((item) => item.id === id);
      if (!current || Object.entries(patch).every(([key, value]) => current[key as keyof Investigation] === value)) return previous;
      return { ...previous, investigations: previous.investigations.map((item) => item.id === id ? { ...item, ...patch } : item) };
    });
  }, []);

  return <InvestigationWorkspace key={investigation.id} investigation={investigation}
    investigations={store.investigations} onSelectInvestigation={handleSelectInvestigation}
    onCreateInvestigation={handleCreateInvestigation} onUpdateInvestigation={handleUpdateInvestigation}
    storageUnavailable={storageUnavailable} focusInvestigation={focusInvestigation} />;
}

function InvestigationWorkspace({ investigation, investigations, onSelectInvestigation, onCreateInvestigation, onUpdateInvestigation, storageUnavailable, focusInvestigation }: {
  investigation: Investigation;
  investigations: Investigation[];
  onSelectInvestigation: (id: string) => void;
  onCreateInvestigation: (details: { title: string; description: string }) => void;
  onUpdateInvestigation: (id: string, patch: Partial<Investigation>) => void;
  storageUnavailable: boolean;
  focusInvestigation: boolean;
}) {
  const [activeSection, setActiveSection] =
    useState<ActiveSection>(readSection);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const previousSection = useRef(activeSection);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const page = workspaces.find((workspace) => workspace.id === activeSection)!;
  useEffect(() => {
    if (focusInvestigation) titleRef.current?.focus({ preventScroll: true });
  }, [investigation.id, focusInvestigation]);
  const closeNavigation = () => {
    setNavigationOpen(false);
    window.requestAnimationFrame(() => menuRef.current?.focus());
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const onResize = () => {
      setIsMobile(query.matches);
      if (!query.matches) setNavigationOpen(false);
    };
    query.addEventListener("change", onResize);
    return () => query.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      if (/^#\/?(?:overview|home)$/.test(window.location.hash)) window.history.replaceState(null, "", "#/");
      setActiveSection(readSection());
      setNavigationOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash || /^#\/?(?:overview|home)$/.test(window.location.hash))
      window.history.replaceState(null, "", "#/");
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${page.title} | ${investigation.title} | QOBE`;
    if (previousSection.current !== activeSection) {
      titleRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    previousSection.current = activeSection;
  }, [activeSection, page.title, investigation.title]);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNavigation();
      }
      if (event.key === "Tab") {
        const links =
          sidebarRef.current?.querySelectorAll<HTMLElement>("a, button");
        if (!links?.length) return;
        const first = links[0],
          last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigationOpen]);

  const nodes = investigation.nodes;
  const edges = investigation.edges;
  const hasLedger = nodes.length > 0;
  const scrapeFeeds = investigation.mode === "replay" ? PRESET_SCRAPE_FEEDS : [];
  const [artifacts, setArtifacts] = useState<OsintArtifact[]>(
    investigation.artifacts,
  );
  const [presetIndex, setPresetIndex] = useState(investigation.presetIndex);

  // Selected wallet cluster & suspect
  const [selectedNodeId, setSelectedNodeId] =
    useState(investigation.selectedNodeId);
  const [selectedSuspectId, setSelectedSuspectId] =
    useState(investigation.selectedSuspectId);

  // Statistical modeling parameters
  const [bandwidthSigmaSec, setBandwidthSigmaSec] = useState(investigation.bandwidthSigmaSec);
  const [mixerEntropyWeight, setMixerEntropyWeight] = useState(investigation.mixerEntropyWeight);

  // Enforced Freeze Warrants
  const [warrants, setWarrants] = useState<FreezeWarrant[]>(investigation.warrants);

  useEffect(() => {
    onUpdateInvestigation(investigation.id, {
      artifacts, warrants, presetIndex, selectedNodeId, selectedSuspectId, bandwidthSigmaSec, mixerEntropyWeight,
    });
  }, [investigation.id, artifacts, warrants, presetIndex, selectedNodeId, selectedSuspectId, bandwidthSigmaSec, mixerEntropyWeight, onUpdateInvestigation]);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const frozenWalletIds = useMemo(() => {
    return warrants.map((w) => {
      const found = nodes.find((n) => n.address === w.targetWalletAddress);
      return found ? found.id : "";
    });
  }, [warrants, nodes]);

  // Real-time Bayesian correlation computation
  const correlations = useMemo(() => {
    return correlateIdentities(
      nodes,
      edges,
      artifacts,
      investigation.suspects,
      bandwidthSigmaSec,
      mixerEntropyWeight,
    );
  }, [nodes, edges, artifacts, investigation.suspects, bandwidthSigmaSec, mixerEntropyWeight]);

  const topSuspect = correlations[0];

  const totalFrozenUsd = useMemo(
    () => warrants.reduce((sum, w) => sum + w.frozenAmountUsd, 0),
    [warrants],
  );

  // Handler: Scrape next queued live threat feed
  const handleScrapePresetFeed = () => {
    if (presetIndex >= scrapeFeeds.length) return;
    const rawPreset = scrapeFeeds[presetIndex];
    const newArtifact: OsintArtifact = {
      ...rawPreset,
      id: `osint-scraped-${Date.now()}`,
    };
    setArtifacts((prev) => [newArtifact, ...prev]);
    setPresetIndex((prev) => prev + 1);
    setStatusBanner(
      `Scraped new ${newArtifact.sourceType} from ${newArtifact.authorAlias} — Extracted IP ${newArtifact.extractedIps.join(", ")} and updated Bayesian posterior matrix.`,
    );
  };

  // Handler: Add custom OSINT artifact
  const handleAddArtifact = (newArt: OsintArtifact) => {
    setArtifacts((prev) => [newArt, ...prev]);
    setStatusBanner(
      `Fused custom ${newArt.sourceType} artifact (${newArt.authorAlias}) into the blockchain correlation tensor.`,
    );
  };

  // Handler: Issue Freeze Warrant on a wallet cluster
  const handleIssueFreeze = (walletId: string) => {
    const targetNode = nodes.find((n) => n.id === walletId);
    if (!targetNode) return;
    if (frozenWalletIds.includes(walletId)) return;

    const matchedCorr =
      correlations.find((c) => c.targetWalletId === walletId) || topSuspect;
    if (!matchedCorr) return;

    const newWarrant: FreezeWarrant = {
      warrantId: `WRN-2026-0${892 + warrants.length}`,
      createdAtUtc: "08:14:22 UTC",
      suspectHandle: matchedCorr.suspectHandle,
      targetWalletAddress: targetNode.address,
      exchangeEndpoint: targetNode.label,
      frozenAmountUsd: targetNode.inflowUsd,
      posteriorConfidence: matchedCorr.posteriorProbability,
      primaryEvidenceHash: `0x${targetNode.address.slice(2, 10)}...c108`,
      meanLatencyDeltaSec: matchedCorr.meanTimeDeltaSec,
      status: "ENFORCED_FREEZE",
    };

    setWarrants((prev) => [newWarrant, ...prev]);
    setStatusBanner(
      `Emergency Freeze Warrant ${newWarrant.warrantId} enforced on ${targetNode.label} ($${(
        targetNode.inflowUsd / 1_000_000
      ).toFixed(2)}M intercepted).`,
    );
  };

  // Alert system state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertThreshold, setAlertThreshold] = useState<number>(1_000_000);
  const [clusterHeatmap, setClusterHeatmap] = useState<Record<string, number>>({});
  const [warRoomKpis, setWarRoomKpis] = useState<any>(null);

  useEffect(() => {
    if (investigation.mode !== "replay") return;
    const fetchAlertsAndHeatmap = async () => {
      try {
        const [alertsRes, heatmapRes, kpiRes] = await Promise.all([
          fetch("/alerts"),
          fetch("/heatmap"),
          fetch("/war-room/kpis")
        ]);
        const alertsData = await alertsRes.json();
        const heatmapData = await heatmapRes.json();
        const kpiData = await kpiRes.json();
        setAlerts(alertsData);
        setClusterHeatmap(heatmapData);
        setWarRoomKpis(kpiData);
      } catch (e) {
        console.error("Failed to fetch alert data", e);
      }
    };

    fetchAlertsAndHeatmap();
    const interval = setInterval(fetchAlertsAndHeatmap, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [investigation.mode]);

  const handleUpdateThreshold = async (val: number) => {
    try {
      await fetch("/alerts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: val }),
      });
      setAlertThreshold(val);
      // Refresh alerts after updating threshold
      const res = await fetch("/alerts");
      const data = await res.json();
      setAlerts(data);
      setStatusBanner(`Alert threshold updated to $${val.toLocaleString()}.`);
    } catch (e) {
      setStatusBanner("Failed to update alert settings.");
    }
  };

  const handleExportDossier = () => {
    const payload = {
      investigation: { id: investigation.id, title: investigation.title, reference: investigation.reference, description: investigation.description },
      incident: investigation.mode === "replay" ? "Tuesday 02:14 UTC DeFi Protocol Exploit ($42,000,000)" : investigation.title,
      generatedAtUtc: new Date().toISOString(),
      topAttribution: topSuspect ?? null,
      correlations,
      enforcedWarrants: warrants,
      osintArtifactCount: artifacts.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = investigation.mode === "replay" ? "aethertrace-forensic-dossier.json" : `${investigation.reference.toLowerCase()}-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner(
      `Exported ${investigation.title} dossier (${a.download}).`
    );
  };

  const primaryCashOutFrozen = frozenWalletIds.includes("w-cex-offshore-1");
  const canFreezePrimary = nodes.some((node) => node.id === "w-cex-offshore-1") && !primaryCashOutFrozen;
  const selectorProps = { investigations, activeInvestigationId: investigation.id, onSelect: onSelectInvestigation, onCreate: onCreateInvestigation };

  return (
    <div className={`app-shell${activeSection === "home" ? " is-home" : ""}`}>
      <a
        className="skip-link"
        href="#workspace-title"
        onClick={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        Skip to workspace
      </a>
      {navigationOpen && (
        <button
          className="navigation-backdrop"
          aria-label="Close navigation"
          onClick={closeNavigation}
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${navigationOpen ? "is-open" : ""}`}
        aria-label="Workspace navigation"
        inert={isMobile && !navigationOpen}
      >
        <div className="brand-row">
          <a
            href="#/"
            className="brand"
            aria-label="QOBE home"
            onClick={() => setNavigationOpen(false)}
          >
            <span>
              <span className="brand-name">
                Quantitative <span>OSINT</span>
              </span>
              <span className="brand-caption">Blockchain Engine</span>
            </span>
          </a>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={closeNavigation}
          >
            <X size={19} />
          </button>
        </div>
        <InvestigationSelector {...selectorProps} variant="sidebar" />
        <nav aria-label="Primary workspace navigation">
          <span className="navigation-label">Investigation workspace</span>
          {workspaces.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              data-workspace={id}
              href={id === "home" ? "#/" : `#/${id}`}
              aria-current={activeSection === id ? "page" : undefined}
              className={`navigation-link ${activeSection === id ? "is-active" : ""}`}
              onClick={() => {
                setNavigationOpen(false);
                if (id === activeSection) titleRef.current?.focus();
              }}
            >
              <Icon size={18} strokeWidth={1.65} />
              <span>{title}</span>
              {id === "osint" && (
                <span className="navigation-count">{artifacts.length}</span>
              )}
              {id === "warrants" && (
                <span className="navigation-count">{warrants.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="case-status">
            <span className="status-dot" />
            <span>{investigation.mode === "replay" ? "Active interception" : "Evidence collection"}</span>
            <span className="font-mono">{investigation.mode === "replay" ? "06:00" : "Collecting"}</span>
          </div>
          <p>
            Case reference <span className="font-mono">#{investigation.reference}</span>
          </p>
          <div className="sidebar-signature">
            <span>
              Quantitative forensic engine<small>Amethyst Observatory</small>
            </span>
          </div>
        </div>
      </aside>

      <div
        className="workspace-shell"
        data-workspace={activeSection}
        inert={isMobile && navigationOpen}
      >
        <header className="workspace-topbar">
          {activeSection === "home" ? <>
            <a className="home-brand" href="#/" aria-label="QOBE home"><span>QOBE</span><small>Quantitative OSINT<br />Blockchain Engine</small></a>
            <InvestigationSelector {...selectorProps} variant="header" />
          </> : <>
          <div className="topbar-context">
            <button
              ref={menuRef}
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={navigationOpen}
              aria-controls="workspace-navigation"
              onClick={() => setNavigationOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-case">{investigation.title} <span className="font-mono">#{investigation.reference}</span></span>
            <ChevronRight size={14} />
            <span>{page.title}</span>
          </div>
          <div className="topbar-actions">
            <span className="live-status">
              <span className="status-dot" />
              Active case
            </span>
            <button
              type="button"
              className={
                canFreezePrimary ? "button button-danger" : "button button-primary"
              }
              onClick={() =>
                canFreezePrimary ? handleIssueFreeze("w-cex-offshore-1") : handleExportDossier()
              }
            >
              {!canFreezePrimary ? (
                <ArrowDownToLine size={15} />
              ) : (
                <ShieldAlert size={15} />
              )}
              <span>
                {canFreezePrimary ? "Freeze $27.28M cash-out" : "Export forensic dossier"}
              </span>
            </button>
          </div>
          </>}
        </header>
        <main className={`workspace-content workspace-${activeSection}`}>
          {activeSection !== "home" && <div className="page-heading">
            <div>
              <h1 ref={titleRef} id="workspace-title" tabIndex={-1}>
                {page.title}
              </h1>
              <p>{page.description}</p>
            </div>
            <span className="page-reference">
              <span className="reference-symbol">#</span>{investigation.reference}
            </span>
          </div>}
          {storageUnavailable && <p className="feedback-banner" role="alert">Browser storage is unavailable. Changes will remain available for this session.</p>}
          {statusBanner && (
            <div className="feedback-banner" role="status">
              <CheckCircle2 size={18} />
              <span>{statusBanner}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setStatusBanner(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}

          {/* Keep workspaces mounted so drafts, filters, and visualization modes survive navigation. */}
          <section
            hidden={activeSection !== "home"}
            aria-label="War room"
          >
            <AnalysisControlPanel />
            <WarRoomLanding
              investigation={investigation}
              headingRef={activeSection === "home" ? titleRef : undefined}
              correlations={correlations}
              artifacts={artifacts}
              nodes={nodes}
              edges={edges}
              totalFrozenUsd={totalFrozenUsd}
            />
            <details id="case-operations" className="war-room-archive">

              <summary>
                <span>Case operations</span>
                <span>Incident summary, attribution &amp; analyst copilot</span>
              </summary>
              <div className="war-room-existing-layout">
                {hasLedger && correlations.length > 0 ? <CaseOverview
                  correlations={correlations}
                  artifacts={artifacts}
                  warrants={warrants}
                  bandwidthSigmaSec={bandwidthSigmaSec}
                  totalFrozenUsd={totalFrozenUsd}
                  frozenWalletIds={frozenWalletIds}
                  onIssueFreeze={handleIssueFreeze}
                  warRoomKpis={warRoomKpis}
                /> : <div className="empty-case-summary"><h2>{investigation.title}</h2><p>{investigation.description || "A new investigation, ready for evidence."}</p><dl><div><dt>Case reference</dt><dd>{investigation.reference}</dd></div><div><dt>Indexed sources</dt><dd>{artifacts.length}</dd></div><div><dt>Wallet clusters</dt><dd>{nodes.length}</dd></div></dl><a className="text-link" href="#/osint">Collect OSINT evidence <ArrowUpRight size={14} /></a></div>}
                {investigation.mode === "replay" ? <AnalystCopilot
                  suspectId={selectedNodeId}
                /> : <EmptyWorkspace title="Build the evidence trail" description="Add source material to this investigation. Its evidence and case records stay separate from your other investigations." />}
              </div>
            </details>
          </section>
          <section
            hidden={activeSection !== "matrix"}
            aria-label="Forensic matrix"
          >
            {hasLedger ? <div className="flex gap-4 h-full">
              <div className="flex-1 relative">
                <MatrixGraphCanvas
                  nodes={nodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  frozenWalletIds={frozenWalletIds}
                  onIssueFreeze={handleIssueFreeze}
                  clusterHeatmap={clusterHeatmap}
                />
              </div >
              <div className="w-80 shrink-0">
                <AlertsPanel
                  alerts={alerts}
                  currentThreshold={alertThreshold}
                  onUpdateThreshold={handleUpdateThreshold}
                />
              </div >
            </div > : <EmptyWorkspace title="No ledger data indexed" description="No ledger has been added to this investigation. Its graph will appear when wallet and transaction data is available." />}
          </section>
          <section
            hidden={activeSection !== "osint"}
            aria-label="OSINT evidence"
          >
            <OsintScraperPanel
              artifacts={artifacts}
              onAddArtifact={handleAddArtifact}
              onScrapePresetFeed={handleScrapePresetFeed}
              remainingPresetsCount={scrapeFeeds.length - presetIndex}
              initialSourceOrigin={investigation.mode === "custom" ? "" : undefined}
              initialTimestampSec={investigation.mode === "custom" ? 0 : undefined}
              knownSuspects={investigation.mode === "custom" ? investigation.suspects : undefined}
              replayControls={investigation.mode === "replay"}
              eventBaselineUtc={investigation.mode === "custom" ? investigation.createdAtUtc : undefined}
            />
          </section>
          <section
            hidden={activeSection !== "latency"}
            aria-label="Latency model"
          >
            {correlations.length > 0 ? <LatencyAnalysisView
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
            /> : <EmptyWorkspace title="No correlations to model yet" description="Timing, behavioral, and graph models become available when this investigation has indexed evidence and wallet data." />}
          </section>
          <section
            hidden={activeSection !== "warrants"}
            aria-label="Freeze warrants"
          >
            {hasLedger && correlations.length > 0 ? <FreezeWarrantsView
              warrants={warrants}
              correlations={correlations}
              nodes={nodes}
              frozenWalletIds={frozenWalletIds}
              onIssueFreeze={handleIssueFreeze}
              onExportJson={handleExportDossier}
            /> : <EmptyWorkspace title="No intervention records yet" description="This investigation has no linked cash-out endpoints or freeze warrants. Its case records will appear here as evidence is connected." />}
          </section>
          <footer className="workspace-footer">
            <span>
              Quantitative OSINT Blockchain Engine{" "}
              <span className="footer-case"> / {investigation.title} #{investigation.reference}</span>
            </span>
            <button onClick={handleExportDossier}>
              Download JSON dossier <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function EmptyWorkspace({ title, description }: { title: string; description: string }) {
  return <div className="investigation-empty-state"><Radar size={27} aria-hidden="true" /><h2>{title}</h2><p>{description}</p><a href="#/osint">Open OSINT evidence <ArrowUpRight size={14} /></a></div>;
}
