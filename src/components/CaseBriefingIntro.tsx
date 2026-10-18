import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Radar,
  Network,
  Link2,
  X,
  FileText,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Investigation } from "../investigations";
import type { CorrelationBreakdown, WalletNode, OsintArtifact } from "../engine/forensicEngine";
import "./CaseBriefingIntro.css";

interface CaseBriefingIntroProps {
  investigation: Pick<Investigation, "title" | "reference" | "description" | "drainedUsd" | "exploitLabel" | "mode">;
  correlations: CorrelationBreakdown[];
  nodes: WalletNode[];
  artifacts: OsintArtifact[];
  totalFrozenUsd: number;
  isOpen: boolean;
  onEnterWarRoom: () => void;
  onOpenOperations: () => void;
  onClose: () => void;
}

export const CaseBriefingIntro: React.FC<CaseBriefingIntroProps> = ({
  investigation,
  correlations,
  nodes,
  artifacts,
  totalFrozenUsd,
  isOpen,
  onEnterWarRoom,
  onOpenOperations,
  onClose,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Counter animation state
  const [counts, setCounts] = useState({
    latency: 0,
    confidence: 0,
    clusters: 0,
    capital: 0,
  });

  const topSuspect = correlations[0];
  const targetConfidence = topSuspect ? topSuspect.posteriorProbability : 96.9;
  const targetLatency = topSuspect ? Math.abs(topSuspect.meanTimeDeltaSec) : 1.48;
  const targetClusters = nodes.length > 0 ? nodes.length : 9;
  const targetCapital = investigation.drainedUsd > 0 ? investigation.drainedUsd / 1_000_000 : 42.0;

  useEffect(() => {
    if (!isOpen) {
      setIsExiting(false);
      return;
    }

    // Run progressive count-up animation like in new-folder(5) main.js
    const duration = 1400;
    const startTime = performance.now();

    const frameId = requestAnimationFrame(function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      setCounts({
        latency: targetLatency * eased,
        confidence: targetConfidence * eased,
        clusters: Math.round(targetClusters * eased),
        capital: targetCapital * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [isOpen, targetLatency, targetConfidence, targetClusters, targetCapital]);

  // Handle smooth transition into War Room
  const handleLaunchWarRoom = () => {
    setIsExiting(true);
    setTimeout(() => {
      onEnterWarRoom();
      setIsExiting(false);
    }, 420);
  };

  const handleLaunchOperations = () => {
    setIsExiting(true);
    setTimeout(() => {
      onOpenOperations();
      setIsExiting(false);
    }, 420);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`intro-viewport ${isExiting ? "is-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Intelligence Briefing and Dual-Front Architecture Prelude"
    >
      {/* Background Loop Video from new-folder(5) */}
      <div className="intro-bg" aria-hidden="true">
        <video
          ref={videoRef}
          className="intro-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
        <div className="intro-bg-overlay" />
      </div>

      {/* Floating Pill Header - Signature from new-folder(5) */}
      <header className="intro-header">
        <div className="intro-brand-col">
          <div className="intro-logo" title="QOBE Quantitative OSINT Blockchain Engine">
            <img src="/logo.webp" alt="QOBE Orbital Logo" width={34} height={34} />
          </div>
          <div className="intro-brand-text">
            <span className="intro-brand-title">Quantitative OSINT</span>
            <span className="intro-brand-sub">Blockchain Engine</span>
          </div>
        </div>

        {/* Floating Pill Nav */}
        <nav className="intro-desktop-nav" aria-label="Investigation quick launch">
          <button
            type="button"
            className="intro-nav-link active"
            onClick={handleLaunchWarRoom}
          >
            Evidence Bridge
          </button>
          <button
            type="button"
            className="intro-nav-link"
            onClick={() => {
              setIsExiting(true);
              setTimeout(() => {
                onEnterWarRoom();
                window.location.hash = "#/matrix";
              }, 400);
            }}
          >
            Forensic Matrix
          </button>
          <button
            type="button"
            className="intro-nav-link"
            onClick={() => {
              setIsExiting(true);
              setTimeout(() => {
                onEnterWarRoom();
                window.location.hash = "#/osint";
              }, 400);
            }}
          >
            OSINT Evidence
          </button>
          <button
            type="button"
            className="intro-nav-link"
            onClick={handleLaunchOperations}
          >
            Case Operations
          </button>
        </nav>

        {/* Header Actions */}
        <div className="intro-header-actions">
          <div className="intro-case-pill">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>#{investigation.reference}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="intro-close-btn"
            aria-label="Skip intro and open workspace"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Hero Content Area */}
      <main className="intro-hero">
        <div className="intro-hero-content">
          {/* Overlapping Avatars Threat Pill from new-folder(5) */}
          <div className="intro-trust" aria-label="Tactical Intelligence Fusion">
            <span className="intro-avatar intro-avatar-one" aria-hidden="true">
              <span className="intro-avatar-inner">
                <Radar size={15} />
              </span>
            </span>
            <span className="intro-avatar intro-avatar-two" aria-hidden="true">
              <span className="intro-avatar-inner">
                <Link2 size={15} />
              </span>
            </span>
            <span className="intro-avatar intro-avatar-three" aria-hidden="true">
              <span className="intro-avatar-inner">
                <Network size={15} />
              </span>
            </span>
            <span className="intro-trust-pill">
              <span>Tactical Intelligence Fusion</span>
              <span className="text-iris font-mono">·</span>
              <span>Case #{investigation.reference}</span>
              <span className="text-iris font-mono">·</span>
              <span className="text-amber-300 font-mono">${targetCapital.toFixed(0)}M Exploit</span>
            </span>
          </div>

          {/* Monumental Kinetic Headline */}
          <h1 className="intro-headline">
            <span>Quantitative OSINT</span>
            <span>Attribution Engine</span>
          </h1>

          {/* Subhead */}
          <p className="intro-subhead">
            Two investigation teams. One connected trail. We fuse unstructured off-chain developer signals with on-chain transaction velocity to unmask anonymous exploiters in real time.
          </p>

          {/* Action Row with Glowing Pill CTA from new-folder(5) */}
          <div className="intro-cta-row">
            <button
              type="button"
              className="intro-cta-primary"
              onClick={handleLaunchWarRoom}
            >
              <Sparkles size={16} className="text-iris" />
              <span>Launch Evidence Bridge &amp; War Room</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="intro-cta-secondary"
              onClick={handleLaunchOperations}
            >
              <FileText size={15} />
              <span>Case Operations Dossier</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Performance Stats Deck with Count-Up & Glyphs from new-folder(5) */}
      <footer className="intro-stats" aria-label="Forensic correlation performance">
        <div className="intro-stat">
          <span className="intro-stat-icon" aria-hidden="true">&lt;</span>
          <span className="intro-stat-value">
            {counts.latency.toFixed(2)}s
          </span>
          <span className="intro-stat-label">Temporal Hawkes Δt</span>
        </div>
        <div className="intro-stat">
          <span className="intro-stat-icon" aria-hidden="true">%</span>
          <span className="intro-stat-value">
            {counts.confidence.toFixed(1)}%
          </span>
          <span className="intro-stat-label">Bayesian Confidence</span>
        </div>
        <div className="intro-stat">
          <span className="intro-stat-icon" aria-hidden="true">*</span>
          <span className="intro-stat-value">
            ${counts.capital.toFixed(2)}M
          </span>
          <span className="intro-stat-label">Exploit Outflow Traced</span>
        </div>
        <div className="intro-stat">
          <span className="intro-stat-icon" aria-hidden="true">#</span>
          <span className="intro-stat-value">
            {counts.clusters} Clusters
          </span>
          <span className="intro-stat-label">Interception Nodes</span>
        </div>
      </footer>
    </div>
  );
};
