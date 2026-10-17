import React, { useState } from 'react';
import {
  OsintArtifact,
  extractOsintMarkers,
} from '../engine/forensicEngine';
import { Search, PlusCircle, Radar, Terminal, AlertCircle } from 'lucide-react';

interface OsintScraperPanelProps {
  artifacts: OsintArtifact[];
  onAddArtifact: (artifact: OsintArtifact) => void;
  onScrapePresetFeed: () => void;
  remainingPresetsCount: number;
  compact?: boolean;
}

export const OsintScraperPanel: React.FC<OsintScraperPanelProps> = ({
  artifacts,
  onAddArtifact,
  onScrapePresetFeed,
  remainingPresetsCount,
  compact = false,
}) => {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showIngestForm, setShowIngestForm] = useState<boolean>(false);

  // Form states
  const [sourceType, setSourceType] = useState<OsintArtifact['sourceType']>('GitHub Commit');
  const [sourceOrigin, setSourceOrigin] = useState<string>('github.com/kestrel-labs/mev-bundler');
  const [timestampSecInput, setTimestampSecInput] = useState<string>('19798.5');
  const [rawTextInput, setRawTextInput] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const livePreview = extractOsintMarkers(rawTextInput);

  const filteredArtifacts = artifacts.filter((art) => {
    const matchesSource =
      sourceFilter === 'all' || art.sourceType === sourceFilter;
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
        'Raw OSINT payload is required. Paste a commit diff, forum post, or chat log to extract identity markers.'
      );
      return;
    }
    if (!sourceOrigin.trim()) {
      setValidationError('Source origin URL or channel identifier is required.');
      return;
    }

    const parsedSec = parseFloat(timestampSecInput);
    if (Number.isNaN(parsedSec)) {
      setValidationError('Valid numeric timestamp offset (seconds since 02:14 UTC) is required.');
      return;
    }

    setValidationError(null);
    const extracted = extractOsintMarkers(rawTextInput);
    const detectedAlias = extracted.handles[0] || '@kestrel_0x';

    const linkedSuspectId =
      detectedAlias.toLowerCase().includes('v0id')
        ? 'susp-v0id'
        : detectedAlias.toLowerCase().includes('lynx')
        ? 'susp-lynx'
        : 'susp-kestrel';

    const hours = Math.floor(parsedSec / 3600) + 2;
    const mins = Math.floor((parsedSec % 3600) / 60) + 14;
    const secs = (parsedSec % 60).toFixed(1);
    const formattedUtc = `0${hours % 24}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(4, '0')} UTC`;

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
    setRawTextInput('');
    setShowIngestForm(false);
  };

  const handleLoadSamplePayload = () => {
    setValidationError(null);
    setSourceType('GitHub Commit');
    setSourceOrigin('github.com/kestrel-labs/offshore-sweeper (commit 441b09c)');
    setTimestampSecInput('19798.8');
    setRawTextInput(
      'fix(sweeper): @kestrel_0x route final $27.28M tranche from 0xc409e881 to 0x99e4b108 via node 185.220.101.44; lock priority fee 3.14159 gwei (UTC+03:00)'
    );
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            02. OSINT Threat Feed &amp; Repository Scraper
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <span>{artifacts.length} Indexed Artifacts</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Automated Regex &amp; Heuristic Marker Extraction</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onScrapePresetFeed}
            disabled={remainingPresetsCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              remainingPresetsCount > 0
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>
              {remainingPresetsCount > 0
                ? `Scrape Live Threat Feed (${remainingPresetsCount})`
                : 'All Threat Feeds Scraped'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowIngestForm((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{showIngestForm ? 'Close Ingestor' : 'Ingest Custom Snippet'}</span>
          </button>
        </div>
      </div>

      {/* Custom Unstructured OSINT Ingestor Form */}
      {showIngestForm && (
        <form
          onSubmit={handleIngestSubmit}
          className="p-4 bg-[#0B0F19] border-b border-slate-800 space-y-3"
          aria-label="Ingest Custom OSINT Snippet Form"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>Unstructured OSINT Payload Parser</span>
            </span>
            <button
              type="button"
              onClick={handleLoadSamplePayload}
              className="text-xs text-sky-400 hover:text-sky-300 underline whitespace-nowrap shrink-0"
            >
              Load Sample Leaked Commit Diff
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="osint-source-type"
                className="block text-xs text-slate-400 mb-1"
              >
                Feed Channel Type
              </label>
              <select
                id="osint-source-type"
                value={sourceType}
                onChange={(e) =>
                  setSourceType(e.target.value as OsintArtifact['sourceType'])
                }
                className="w-full px-2.5 py-1.5 text-xs bg-[#111827] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="GitHub Commit">GitHub Commit</option>
                <option value="Telegram Channel">Telegram Channel</option>
                <option value="Dark Web Forum">Dark Web Forum</option>
                <option value="Paste / Gist">Paste / Gist</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="osint-origin-input"
                className="block text-xs text-slate-400 mb-1"
              >
                Repository / Forum URI
              </label>
              <input
                id="osint-origin-input"
                type="text"
                value={sourceOrigin}
                onChange={(e) => setSourceOrigin(e.target.value)}
                placeholder="e.g. github.com/user/repo"
                className="w-full px-2.5 py-1.5 text-xs bg-[#111827] border border-slate-700 rounded text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="osint-timestamp-sec"
                className="block text-xs text-slate-400 mb-1"
              >
                Event Offset (sec post-02:14 UTC)
              </label>
              <input
                id="osint-timestamp-sec"
                type="number"
                step="0.1"
                value={timestampSecInput}
                onChange={(e) => setTimestampSecInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#111827] border border-slate-700 rounded text-slate-100 font-mono tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="osint-raw-payload"
              className="block text-xs text-slate-400 mb-1"
            >
              Raw Unstructured Text (IPv4s, 0x Wallets, @Handles, and Gas Gwei Constants auto-extracted)
            </label>
            <textarea
              id="osint-raw-payload"
              rows={3}
              value={rawTextInput}
              onChange={(e) => {
                setRawTextInput(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Paste raw dark web post, Telegram chat log, or GitHub commit message..."
              className="w-full p-2.5 text-xs bg-[#111827] border border-slate-700 rounded text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Live Marker Extraction Telemetry Preview */}
          <div className="p-2.5 bg-[#111827] border border-slate-800 rounded text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="text-slate-400 font-mono">
              <span>Extracted IPs: {livePreview.ips.join(', ') || 'None'}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>Wallets: {livePreview.wallets.join(', ') || 'None'}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>Handles: {livePreview.handles.join(', ') || 'None'}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>
                Gas Constant: {livePreview.gasGwei ? `${livePreview.gasGwei} gwei` : 'None'}
              </span>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0"
            >
              Extract &amp; Fuse into Matrix
            </button>
          </div>

          {validationError && (
            <div
              role="alert"
              className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-800/50 px-3 py-2 rounded"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </form>
      )}

      {/* Search & Filter Controls */}
      <div className="px-5 py-3 border-b border-slate-800 space-y-2.5">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Filter OSINT artifacts by IP, handle, wallet prefix, or keyword"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search IP (185.220...), handle (@kestrel_0x), wallet (0x7a1b)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0B0F19] border border-slate-800 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0F19] border border-slate-800 rounded-md">
          {(
            [
              { id: 'all', label: 'All Feeds' },
              { id: 'GitHub Commit', label: 'GitHub' },
              { id: 'Telegram Channel', label: 'Telegram' },
              { id: 'Dark Web Forum', label: 'Dark Web' },
              { id: 'Paste / Gist', label: 'Paste / Gist' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                sourceFilter === tab.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scraped OSINT Artifacts List */}
      <div
        className={`divide-y divide-slate-800/80 overflow-y-auto ${
          compact ? 'max-h-[420px]' : 'max-h-[620px]'
        }`}
        data-testid="osint-artifact-list"
      >
        {filteredArtifacts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-300 font-medium">
              No OSINT threat artifacts match your current filter
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Clear your search query or ingest a new threat snippet to populate identity markers.
            </p>
            <button
              type="button"
              onClick={() => {
                setSourceFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded hover:bg-slate-700 transition-colors"
            >
              Reset Feed Filters
            </button>
          </div>
        ) : (
          filteredArtifacts.map((art) => (
            <article
              key={art.id}
              className="p-4 hover:bg-slate-900/40 transition-colors space-y-2"
            >
              {/* Clean Unboxed Metadata Line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-sky-400">
                    {art.authorAlias}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">{art.sourceType}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-400">
                    {art.sourceOrigin}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-slate-400">
                  {art.timestampUtc} (T+{art.timestampSec.toFixed(1)}s)
                </span>
              </div>

              {/* Raw Scraped Unstructured Snippet */}
              <p className="text-xs font-mono text-slate-200 bg-[#0B0F19] p-2.5 rounded border border-slate-800/90 leading-relaxed break-words">
                {art.rawText}
              </p>

              {/* Extracted Identity Markers (Zero-Pill Unboxed Format) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono tabular-nums">
                <span>
                  IPs:{' '}
                  <strong className="text-slate-200 font-normal">
                    {art.extractedIps.join(', ') || 'None'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Wallets:{' '}
                  <strong className="text-sky-300 font-normal">
                    {art.extractedWallets.join(', ') || 'None'}
                  </strong>
                </span>
                {art.extractedGasQuirk !== undefined && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Gas Constant:{' '}
                      <strong className="text-amber-300 font-normal">
                        {art.extractedGasQuirk} gwei
                      </strong>
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>TZ: {art.timezoneOffset}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
