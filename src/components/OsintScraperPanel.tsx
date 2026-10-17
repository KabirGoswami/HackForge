import React, { useState } from "react";
import { OsintArtifact, extractOsintMarkers } from "../engine/forensicEngine";
import {
  Search,
  PlusCircle,
  Radar,
  Terminal,
  AlertCircle,
  X,
} from "lucide-react";

interface OsintScraperPanelProps {
  artifacts: OsintArtifact[];
  onAddArtifact: (artifact: OsintArtifact) => void;
  onScrapePresetFeed: () => void;
  remainingPresetsCount: number;
  compact?: boolean;
  initialSourceOrigin?: string;
  initialTimestampSec?: number;
  knownSuspects?: { id: string; handle: string }[];
  replayControls?: boolean;
  eventBaselineUtc?: string;
}

export const OsintScraperPanel: React.FC<OsintScraperPanelProps> = ({
  artifacts,
  onAddArtifact,
  onScrapePresetFeed,
  remainingPresetsCount,
  compact = false,
  initialSourceOrigin = "github.com/kestrel-labs/mev-bundler",
  initialTimestampSec = 19798.5,
  knownSuspects,
  replayControls = true,
  eventBaselineUtc,
}) => {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showIngestForm, setShowIngestForm] = useState<boolean>(false);

  // Form states
  const [sourceType, setSourceType] =
    useState<OsintArtifact["sourceType"]>("GitHub Commit");
  const [sourceOrigin, setSourceOrigin] = useState<string>(
    initialSourceOrigin,
  );
  const [timestampSecInput, setTimestampSecInput] = useState<string>(String(initialTimestampSec));
  const [rawTextInput, setRawTextInput] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const livePreview = extractOsintMarkers(rawTextInput);

  const filteredArtifacts = artifacts.filter((art) => {
    const matchesSource =
      sourceFilter === "all" || art.sourceType === sourceFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      art.rawText.toLowerCase().includes(q) ||
      art.authorAlias.toLowerCase().includes(q) ||
      art.sourceOrigin.toLowerCase().includes(q) ||
      art.extractedIps.some((ip) => ip.includes(q)) ||
      art.extractedWallets.some((w) => w.toLowerCase().includes(q));
    return matchesSource && matchesQuery;
  });

  const handleIngestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTextInput.trim()) {
      setValidationError(
        "Raw OSINT payload is required. Paste a commit diff, forum post, or chat log to extract identity markers.",
      );
      return;
    }
    if (!sourceOrigin.trim()) {
      setValidationError(
        "Source origin URL or channel identifier is required.",
      );
      return;
    }

    const parsedSec = parseFloat(timestampSecInput);
    const eventTime = new Date((eventBaselineUtc ? Date.parse(eventBaselineUtc) : Date.UTC(2026, 0, 1, 2, 14)) + parsedSec * 1000);
    if (!Number.isFinite(parsedSec) || !Number.isFinite(eventTime.getTime())) {
      setValidationError(
        "Enter a valid numeric event offset in seconds.",
      );
      return;
    }

    setValidationError(null);
    const extracted = extractOsintMarkers(rawTextInput);
    const detectedAlias = extracted.handles[0] || (knownSuspects ? "Unknown author" : "@kestrel_0x");

    const linkedSuspectId = knownSuspects
      ? knownSuspects.find((suspect) => suspect.handle.toLowerCase() === detectedAlias.toLowerCase())?.id ?? ""
      : detectedAlias.toLowerCase().includes("v0id")
      ? "susp-v0id"
      : detectedAlias.toLowerCase().includes("lynx")
        ? "susp-lynx"
        : "susp-kestrel";

    const formattedUtc = `${eventTime.toISOString().slice(11, 23)} UTC`;

    const newArtifact: OsintArtifact = {
      id: `osint-custom-${Date.now()}`,
      sourceType,
      sourceOrigin: sourceOrigin.trim(),
      timestampUtc: formattedUtc,
      timestampSec: parsedSec,
      authorAlias: detectedAlias,
      rawText: rawTextInput.trim(),
      extractedIps: extracted.ips,
      extractedWallets: extracted.wallets,
      extractedGasQuirk: extracted.gasGwei ?? undefined,
      timezoneOffset: extracted.timezone,
      linkedSuspectId,
      verifiedMatch: extracted.ips.length > 0 || extracted.wallets.length > 0,
    };

    onAddArtifact(newArtifact);
    setRawTextInput("");
    setShowIngestForm(false);
  };

  const handleLoadSamplePayload = () => {
    setValidationError(null);
    setSourceType("GitHub Commit");
    setSourceOrigin(
      "github.com/kestrel-labs/offshore-sweeper (commit 441b09c)",
    );
    setTimestampSecInput("19798.8");
    setRawTextInput(
      "fix(sweeper): @kestrel_0x route final $27.28M tranche from 0xc409e881 to 0x99e4b108 via node 185.220.101.44; lock priority fee 3.14159 gwei (UTC+03:00)",
    );
  };

  return (
    <div>
      <div className="osint-header">
        <div>
          <h2>Threat feed &amp; repository scraper</h2>
          <p>
            {artifacts.length} indexed artifacts · Automated regex &amp;
            heuristic marker extraction
          </p>
        </div>
        <div className="osint-header-actions">
          {replayControls && <button
            type="button"
            onClick={onScrapePresetFeed}
            disabled={remainingPresetsCount === 0}
            className="button button-secondary disabled:opacity-50"
          >
            <Radar size={15} />
            {remainingPresetsCount > 0
              ? `Scrape live threat feed (${remainingPresetsCount})`
              : "All threat feeds scraped"}
          </button>}
          <button
            type="button"
            aria-expanded={showIngestForm}
            aria-controls="custom-ingestor"
            onClick={() => setShowIngestForm((prev) => !prev)}
            className="button button-primary"
          >
            <PlusCircle size={15} />
            {showIngestForm ? "Close ingestor" : "Ingest custom snippet"}
          </button>
        </div>
      </div>
      <div
        className={`evidence-layout ${showIngestForm ? "with-ingestor" : ""}`}
      >
        {showIngestForm && (
          <form
            id="custom-ingestor"
            onSubmit={handleIngestSubmit}
            className="panel ingest-panel"
            aria-label="Ingest Custom OSINT Snippet Form"
            noValidate
          >
            <div className="ingest-heading">
              <h3>
                <Terminal size={16} className="text-accent" />
                Custom snippet ingestor
              </h3>
              <button
                type="button"
                aria-label="Close custom ingestor"
                className="icon-button"
                onClick={() => setShowIngestForm(false)}
              >
                <X size={15} />
              </button>
            </div>
            <p>
              Parse unstructured text and fuse extracted markers into the
              attribution matrix.
            </p>
            {replayControls && <button
              type="button"
              onClick={handleLoadSamplePayload}
              className="text-link underline"
            >
              Load sample leaked commit diff
            </button>}
            <div className="ingest-fields">
              <div>
                <label htmlFor="osint-source-type">Feed channel type</label>
                <select
                  id="osint-source-type"
                  autoFocus
                  value={sourceType}
                  onChange={(e) =>
                    setSourceType(e.target.value as OsintArtifact["sourceType"])
                  }
                >
                  <option value="GitHub Commit">GitHub Commit</option>
                  <option value="Telegram Channel">Telegram Channel</option>
                  <option value="Dark Web Forum">Dark Web Forum</option>
                  <option value="Paste / Gist">Paste / Gist</option>
                </select>
              </div>
              <div>
                <label htmlFor="osint-origin-input">
                  Repository / forum URI
                </label>
                <input
                  id="osint-origin-input"
                  type="text"
                  value={sourceOrigin}
                  onChange={(e) => setSourceOrigin(e.target.value)}
                  placeholder="e.g. github.com/user/repo"
                />
              </div>
              <div>
                <label htmlFor="osint-timestamp-sec">
                  {eventBaselineUtc ? "Event offset (sec since case creation)" : "Event offset (sec post-02:14 UTC)"}
                </label>
                <input
                  id="osint-timestamp-sec"
                  type="number"
                  step="0.1"
                  value={timestampSecInput}
                  onChange={(e) => setTimestampSecInput(e.target.value)}
                />
                {eventBaselineUtc && <p className="text-[10px] text-slate-400 mt-2">Origin: {eventBaselineUtc}</p>}
              </div>
              <div>
                <label htmlFor="osint-raw-payload">Raw unstructured text</label>
                <textarea
                  id="osint-raw-payload"
                  rows={6}
                  value={rawTextInput}
                  aria-describedby="payload-help"
                  aria-invalid={validationError ? true : undefined}
                  onChange={(e) => {
                    setRawTextInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Paste raw dark web post, Telegram chat log, or GitHub commit message..."
                />
                <p
                  id="payload-help"
                  className="text-[10px] text-slate-400 mt-2"
                >
                  IPv4s, 0x wallets, @handles, and gas gwei constants are
                  extracted automatically.
                </p>
              </div>
            </div>
            <div className="extraction-preview">
              <h4>Live marker extraction</h4>
              <div>
                <span>
                  Extracted IPs: {livePreview.ips.join(", ") || "None"}
                </span>
                <span>Wallets: {livePreview.wallets.join(", ") || "None"}</span>
                <span>Handles: {livePreview.handles.join(", ") || "None"}</span>
                <span>
                  Gas constant:{" "}
                  {livePreview.gasGwei ? `${livePreview.gasGwei} gwei` : "None"}
                </span>
              </div>
            </div>
            {validationError && (
              <div role="alert" className="ingest-error">
                <AlertCircle size={15} />
                <span>{validationError}</span>
              </div>
            )}
            <button type="submit" className="button button-primary w-full">
              Extract &amp; fuse into matrix
            </button>
          </form>
        )}

        <div className="panel evidence-reader">
          <div className="evidence-toolbar">
            <div className="evidence-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Filter OSINT artifacts by IP, handle, wallet prefix, or keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IP, handle, wallet address, or keyword…"
              />
            </div>
            <div
              className="feed-filters"
              role="group"
              aria-label="Filter by source channel"
            >
              {(
                [
                  { id: "all", label: "All feeds" },
                  { id: "GitHub Commit", label: "GitHub" },
                  { id: "Telegram Channel", label: "Telegram" },
                  { id: "Dark Web Forum", label: "Dark web" },
                  { id: "Paste / Gist", label: "Paste / Gist" },
                ] as const
              ).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={sourceFilter === filter.id}
                  onClick={() => setSourceFilter(filter.id)}
                  className={`feed-filter ${sourceFilter === filter.id ? "is-active" : ""}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div
            data-testid="osint-artifact-list"
            className={compact ? "max-h-[620px] overflow-y-auto" : undefined}
          >
            {filteredArtifacts.length === 0 ? (
              <div className="empty-evidence">
                <Radar size={28} className="mx-auto text-accent mb-4" />
                <h3>{artifacts.length === 0 ? "No evidence indexed for this investigation" : "No OSINT threat artifacts match your current filter"}</h3>
                <p>
                  {artifacts.length === 0 ? "Ingest a source snippet to start collecting identity markers." : "Clear your search query or ingest a new threat snippet to populate identity markers."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter("all");
                    setSearchQuery("");
                  }}
                  className="button button-secondary"
                >
                  Reset feed filters
                </button>
              </div>
            ) : (
              filteredArtifacts.map((art) => (
                <article
                  key={art.id}
                  className="evidence-artifact"
                  data-source={art.sourceType}
                >
                  <div className="artifact-heading">
                    <div>
                      <strong>{art.authorAlias}</strong>
                      <div className="artifact-source">
                        <span>{art.sourceType}</span>
                        {art.sourceOrigin}
                      </div>
                    </div>
                    <time>
                      {art.timestampUtc}
                      <br />
                      T+{art.timestampSec.toFixed(1)}s
                    </time>
                  </div>
                  <p className="artifact-text">{art.rawText}</p>
                  <dl className="artifact-markers">
                    <div>
                      <dt>Extracted IPs</dt>
                      <dd>{art.extractedIps.join(", ") || "None"}</dd>
                    </div>
                    <div>
                      <dt>Wallet addresses</dt>
                      <dd>{art.extractedWallets.join(", ") || "None"}</dd>
                    </div>
                    {art.extractedGasQuirk !== undefined && (
                      <div>
                        <dt>Gas constant</dt>
                        <dd className="text-warning">
                          {art.extractedGasQuirk} gwei
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Timezone</dt>
                      <dd>{art.timezoneOffset}</dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
          <div className="panel-footnote">
            <Radar size={13} />
            {filteredArtifacts.length} of {artifacts.length} artifacts shown
          </div>
        </div>
      </div>
    </div>
  );
};
