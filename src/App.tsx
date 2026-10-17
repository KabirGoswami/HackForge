import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  INITIAL_WALLET_NODES,
  INITIAL_LEDGER_EDGES,
  INITIAL_OSINT_ARTIFACTS,
  INITIAL_SUSPECTS,
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
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Network,
  Radar,
  ShieldAlert,
  X,
} from "lucide-react";

const workspaces = [
  {
    id: "overview",
    title: "Case overview",
    description: "Incident summary and live identity-to-wallet attribution.",
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
  return workspaces.find((workspace) => workspace.id === id)?.id ?? "overview";
};

export default function App() {
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
      setActiveSection(readSection());
      setNavigationOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash)
      window.history.replaceState(null, "", "#/overview");
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = `${page.title} | Quantitative OSINT Blockchain Engine`;
    if (previousSection.current !== activeSection) {
      titleRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    previousSection.current = activeSection;
  }, [activeSection, page.title]);

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

  const [nodes] = useState(INITIAL_WALLET_NODES);
  const [edges] = useState(INITIAL_LEDGER_EDGES);
  const [artifacts, setArtifacts] = useState<OsintArtifact[]>(
    INITIAL_OSINT_ARTIFACTS,
  );
  const [presetIndex, setPresetIndex] = useState<number>(0);

  // Selected wallet cluster & suspect
  const [selectedNodeId, setSelectedNodeId] =
    useState<string>("w-cex-offshore-1");
  const [selectedSuspectId, setSelectedSuspectId] =
    useState<string>("susp-kestrel");

  // Statistical modeling parameters
  const [bandwidthSigmaSec, setBandwidthSigmaSec] = useState<number>(4.5);
  const [mixerEntropyWeight, setMixerEntropyWeight] = useState<number>(0.35);

  // Enforced Freeze Warrants
  const [warrants, setWarrants] = useState<FreezeWarrant[]>([
    {
      warrantId: "WRN-2026-0891",
      createdAtUtc: "08:02:11 UTC",
      suspectHandle: "@kestrel_0x",
      targetWalletAddress: "0xc409e881b27a4401f932d110e87a5502b991f312",
      exchangeEndpoint: "Consolidation Staging Vault (0xc409...f312)",
      frozenAmountUsd: 1_120_000,
      posteriorConfidence: 96.4,
      primaryEvidenceHash: "0x8f3a91d...e719a402",
      meanLatencyDeltaSec: 1.43,
      status: "ENFORCED_FREEZE",
    },
  ]);

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
      INITIAL_SUSPECTS,
      bandwidthSigmaSec,
      mixerEntropyWeight,
    );
  }, [nodes, edges, artifacts, bandwidthSigmaSec, mixerEntropyWeight]);

  const topSuspect = correlations[0];

  const totalFrozenUsd = useMemo(
    () => warrants.reduce((sum, w) => sum + w.frozenAmountUsd, 0),
    [warrants],
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
  }, []);

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
      incident: "Tuesday 02:14 UTC DeFi Protocol Exploit ($42,000,000)",
      generatedAtUtc: new Date().toISOString(),
      topAttribution: topSuspect,
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
    a.download = "aethertrace-forensic-dossier.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner(
      "Exported cryptographic attribution dossier (aethertrace-forensic-dossier.json)."
    );
  };

  const primaryCashOutFrozen = frozenWalletIds.includes("w-cex-offshore-1");

  return (
    <div className="app-shell">
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
            href="#/overview"
            className="brand"
            aria-label="Quantitative OSINT Blockchain Engine case overview"
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
        <div className="case-switcher">
          <FolderOpen size={17} />
          <div>
            <span>Active investigation</span>
            <strong>AT-42M-0214</strong>
          </div>
          <span className="status-dot" aria-label="Active" />
        </div>
        <nav aria-label="Primary workspace navigation">
          <span className="navigation-label">Investigation workspace</span>
          {workspaces.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              data-workspace={id}
              href={`#/${id}`}
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
            <span>Active interception</span>
            <span className="font-mono">06:00</span>
          </div>
          <p>
            Case reference <span className="font-mono">#AT-42M-0214</span>
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
            <span className="breadcrumb-case">Case AT-42M-0214</span>
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
                primaryCashOutFrozen
                  ? "button button-primary"
                  : "button button-danger"
              }
              onClick={() =>
                primaryCashOutFrozen
                  ? handleExportDossier()
                  : handleIssueFreeze("w-cex-offshore-1")
              }
            >
              {primaryCashOutFrozen ? (
                <ArrowDownToLine size={15} />
              ) : (
                <ShieldAlert size={15} />
              )}
              <span>
                {primaryCashOutFrozen
                  ? "Export forensic dossier"
                  : "Freeze $27.28M cash-out"}
              </span>
            </button>
          </div>
        </header>
        <main className={`workspace-content workspace-${activeSection}`}>
          <div className="page-heading">
            <div>
              <h1 ref={titleRef} id="workspace-title" tabIndex={-1}>
                {page.title}
              </h1>
              <p>{page.description}</p>
            </div>
            <span className="page-reference">
              <span className="reference-symbol">#</span>AT-42M-0214
            </span>
          </div>
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
            hidden={activeSection !== "overview"}
            aria-label="Case overview"
          >
            <div className="flex gap-4 h-full">
              <div className="flex-1">
                <CaseOverview
                  correlations={correlations}
                  artifacts={artifacts}
                  warrants={warrants}
                  bandwidthSigmaSec={bandwidthSigmaSec}
                  totalFrozenUsd={totalFrozenUsd}
                  frozenWalletIds={frozenWalletIds}
                  onIssueFreeze={handleIssueFreeze}
                  warRoomKpis={warRoomKpis}
                />
              </div >
              <div className="w-96 shrink-0">
                <AnalystCopilot
                  suspectId={selectedNodeId}
                />
              </div >
            </div >
          </section>
          <section
            hidden={activeSection !== "matrix"}
            aria-label="Forensic matrix"
          >
            <div className="flex gap-4 h-full">
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
            </div >
          </section>
          <section
            hidden={activeSection !== "osint"}
            aria-label="OSINT evidence"
          >
            <OsintScraperPanel
              artifacts={artifacts}
              onAddArtifact={handleAddArtifact}
              onScrapePresetFeed={handleScrapePresetFeed}
              remainingPresetsCount={PRESET_SCRAPE_FEEDS.length - presetIndex}
            />
          </section>
          <section
            hidden={activeSection !== "latency"}
            aria-label="Latency model"
          >
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
          </section>
          <section
            hidden={activeSection !== "warrants"}
            aria-label="Freeze warrants"
          >
            <FreezeWarrantsView
              warrants={warrants}
              correlations={correlations}
              nodes={nodes}
              frozenWalletIds={frozenWalletIds}
              onIssueFreeze={handleIssueFreeze}
              onExportJson={handleExportDossier}
            />
          </section>
          <footer className="workspace-footer">
            <span>
              Quantitative OSINT Blockchain Engine{" "}
              <span className="footer-case"> / Case #AT-42M-0214</span>
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
