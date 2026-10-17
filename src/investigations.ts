import {
  INITIAL_LEDGER_EDGES,
  INITIAL_OSINT_ARTIFACTS,
  INITIAL_SUSPECTS,
  INITIAL_WALLET_NODES,
  type FreezeWarrant,
  type LedgerEdge,
  type OsintArtifact,
  type SuspectEntity,
  type WalletNode,
} from './engine/forensicEngine';

export interface Investigation {
  id: string;
  title: string;
  reference: string;
  description: string;
  createdAtUtc: string;
  mode: 'replay' | 'custom';
  drainedUsd: number;
  exploitLabel: string;
  nodes: WalletNode[];
  edges: LedgerEdge[];
  suspects: SuspectEntity[];
  artifacts: OsintArtifact[];
  warrants: FreezeWarrant[];
  presetIndex: number;
  selectedNodeId: string;
  selectedSuspectId: string;
  bandwidthSigmaSec: number;
  mixerEntropyWeight: number;
}

export interface InvestigationStore {
  version: 1;
  activeInvestigationId: string;
  investigations: Investigation[];
}

export const INVESTIGATION_STORAGE_KEY = 'qobe-investigations-v1';

const DEFAULT_INVESTIGATION_ID = 'ghost-attacks';

function defaultInvestigation(): Investigation {
  return {
    id: DEFAULT_INVESTIGATION_ID,
    title: 'Ghost Attacks',
    reference: 'AT-42M-0214',
    description: 'Trace the $42 million exploit through on-chain fund movements and off-chain identity evidence.',
    createdAtUtc: '2026-10-13T02:14:00.000Z',
    mode: 'replay',
    drainedUsd: 42_000_000,
    exploitLabel: 'Tuesday, 02:14 UTC',
    nodes: structuredClone(INITIAL_WALLET_NODES),
    edges: structuredClone(INITIAL_LEDGER_EDGES),
    suspects: structuredClone(INITIAL_SUSPECTS),
    artifacts: structuredClone(INITIAL_OSINT_ARTIFACTS),
    warrants: [{
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
    }],
    presetIndex: 0,
    selectedNodeId: 'w-cex-offshore-1',
    selectedSuspectId: 'susp-kestrel',
    bandwidthSigmaSec: 4.5,
    mixerEntropyWeight: 0.35,
  };
}

function defaultStore(): InvestigationStore {
  return {
    version: 1,
    activeInvestigationId: DEFAULT_INVESTIGATION_ID,
    investigations: [defaultInvestigation()],
  };
}

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNonemptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const fieldsAre = (value: RecordValue, fields: string[], check: (item: unknown) => boolean) =>
  fields.every((field) => check(value[field]));
const optionalNumber = (value: unknown) => value === undefined || isNumber(value);
const optionalString = (value: unknown) => value === undefined || isString(value);

function isWalletNode(value: unknown): value is WalletNode {
  return isRecord(value)
    && fieldsAre(value, ['id', 'address', 'label', 'clusterId'], isNonemptyString)
    && ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Solana-Wormhole'].includes(value.chain as string)
    && ['exploit_origin', 'splitter_bot', 'privacy_mixer', 'cross_chain_bridge', 'staging_wallet', 'offshore_exchange'].includes(value.role as string)
    && fieldsAre(value, ['balanceUsd', 'inflowUsd', 'outflowUsd', 'txCount', 'firstSeenSec', 'lastSeenSec', 'gasFingerprintGwei', 'botJitterMs', 'x', 'y'], isNumber);
}

function isLedgerEdge(value: unknown): value is LedgerEdge {
  return isRecord(value)
    && fieldsAre(value, ['id', 'sourceId', 'targetId', 'txHash'], isNonemptyString)
    && fieldsAre(value, ['amountUsd', 'txCount', 'timestampSec', 'timeDeltaFromParentSec'], isNumber)
    && optionalString(value.bridgeOrMixerTag);
}

function isSuspect(value: unknown): value is SuspectEntity {
  return isRecord(value)
    && fieldsAre(value, ['id', 'handle', 'targetExchangeWalletId'], isNonemptyString)
    && fieldsAre(value, ['realNameHint', 'primaryOrigin', 'timezone', 'signatureQuirk'], isString)
    && fieldsAre(value, ['characteristicGasGwei', 'typicalReactionLagSec', 'priorConfidence'], isNumber)
    && stringArray(value.knownIps) && stringArray(value.associatedWallets);
}

function isArtifact(value: unknown): value is OsintArtifact {
  return isRecord(value)
    && isNonemptyString(value.id)
    && ['GitHub Commit', 'Telegram Channel', 'Dark Web Forum', 'Paste / Gist'].includes(value.sourceType as string)
    && fieldsAre(value, ['sourceOrigin', 'timestampUtc', 'authorAlias', 'rawText', 'timezoneOffset', 'linkedSuspectId'], isString)
    && isNumber(value.timestampSec)
    && stringArray(value.extractedIps) && stringArray(value.extractedWallets)
    && optionalNumber(value.extractedGasQuirk) && optionalString(value.pgpfingerprint)
    && typeof value.verifiedMatch === 'boolean';
}

function isWarrant(value: unknown): value is FreezeWarrant {
  return isRecord(value)
    && fieldsAre(value, ['warrantId', 'createdAtUtc', 'suspectHandle', 'targetWalletAddress', 'exchangeEndpoint', 'primaryEvidenceHash'], isString)
    && fieldsAre(value, ['frozenAmountUsd', 'posteriorConfidence', 'meanLatencyDeltaSec'], isNumber)
    && ['ENFORCED_FREEZE', 'PENDING_RELAY'].includes(value.status as string);
}

function hasUniqueIds(values: { id: string }[]) {
  return new Set(values.map((value) => value.id)).size === values.length;
}

function isInvestigation(value: unknown): value is Investigation {
  if (!isRecord(value)
    || !fieldsAre(value, ['id', 'title', 'reference', 'createdAtUtc'], isNonemptyString)
    || !fieldsAre(value, ['description', 'exploitLabel', 'selectedNodeId', 'selectedSuspectId'], isString)
    || !Number.isFinite(Date.parse(value.createdAtUtc as string))
    || !['replay', 'custom'].includes(value.mode as string)
    || !isNumber(value.drainedUsd) || value.drainedUsd < 0
    || !Number.isInteger(value.presetIndex) || (value.presetIndex as number) < 0
    || !isNumber(value.bandwidthSigmaSec) || value.bandwidthSigmaSec <= 0
    || !isNumber(value.mixerEntropyWeight) || value.mixerEntropyWeight < 0 || value.mixerEntropyWeight > 1
    || !Array.isArray(value.nodes) || !value.nodes.every(isWalletNode)
    || !Array.isArray(value.edges) || !value.edges.every(isLedgerEdge)
    || !Array.isArray(value.suspects) || !value.suspects.every(isSuspect)
    || !Array.isArray(value.artifacts) || !value.artifacts.every(isArtifact)
    || !Array.isArray(value.warrants) || !value.warrants.every(isWarrant)) return false;

  const nodes = value.nodes as WalletNode[];
  const edges = value.edges as LedgerEdge[];
  const suspects = value.suspects as SuspectEntity[];
  const nodeIds = new Set(nodes.map((node) => node.id));
  // Broken graph references and suspects without a wallet would crash the correlation engine.
  return hasUniqueIds(nodes) && hasUniqueIds(edges) && hasUniqueIds(suspects)
    && hasUniqueIds(value.artifacts as OsintArtifact[])
    && edges.every((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
    && suspects.every((suspect) => nodeIds.has(suspect.targetExchangeWalletId));
}

/** Reads local cases without allowing an unavailable or damaged browser store to break the app. */
export function loadInvestigationStore(storage?: Pick<Storage, 'getItem'>): InvestigationStore {
  try {
    const source = storage ?? globalThis.localStorage;
    const raw = source?.getItem(INVESTIGATION_STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.investigations)) return defaultStore();

    const ids = new Set<string>();
    const references = new Set<string>();
    const investigations = parsed.investigations.filter((value): value is Investigation => {
      if (!isInvestigation(value) || ids.has(value.id) || references.has(value.reference)) return false;
      ids.add(value.id);
      references.add(value.reference);
      return true;
    }).map((investigation) => ({
      ...investigation,
      title: investigation.title.trim(),
      selectedNodeId: investigation.nodes.some((node) => node.id === investigation.selectedNodeId)
        ? investigation.selectedNodeId : investigation.nodes[0]?.id ?? '',
      selectedSuspectId: investigation.suspects.some((suspect) => suspect.id === investigation.selectedSuspectId)
        ? investigation.selectedSuspectId : investigation.suspects[0]?.id ?? '',
    }));

    if (!ids.has(DEFAULT_INVESTIGATION_ID)) investigations.unshift(defaultInvestigation());
    const activeInvestigationId = investigations.some((investigation) => investigation.id === parsed.activeInvestigationId)
      ? parsed.activeInvestigationId as string : DEFAULT_INVESTIGATION_ID;
    return { version: 1, activeInvestigationId, investigations };
  } catch {
    return defaultStore();
  }
}

/** Returns false when browser storage is unavailable or full; the in-memory case remains usable. */
export function saveInvestigationStore(store: InvestigationStore, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(INVESTIGATION_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** Creates an independent, empty case. Replay evidence belongs only to Ghost Attacks. */
export function createInvestigation(
  input: { title: string; description?: string },
  existing: Investigation[],
): Investigation {
  const title = input.title.trim();
  if (!title) throw new Error('Enter an investigation name.');

  const createdAtUtc = new Date().toISOString();
  const prefix = `CASE-${new Date(createdAtUtc).getUTCFullYear()}-`;
  let sequence = existing.reduce((highest, investigation) => {
    if (!investigation.reference.startsWith(prefix)) return highest;
    const suffix = investigation.reference.slice(prefix.length);
    const number = /^\d+$/.test(suffix) ? Number(suffix) : 0;
    return Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
  }, existing.length) + 1;
  let reference = `${prefix}${String(sequence).padStart(4, '0')}`;
  while (existing.some((investigation) => investigation.reference === reference)) {
    reference = `${prefix}${String(++sequence).padStart(4, '0')}`;
  }

  const identity = globalThis.crypto?.randomUUID?.()
    ?? `investigation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let id = identity;
  let collision = 0;
  while (existing.some((investigation) => investigation.id === id)) id = `${identity}-${++collision}`;

  return {
    id,
    title,
    reference,
    description: input.description?.trim() ?? '',
    createdAtUtc,
    mode: 'custom',
    drainedUsd: 0,
    exploitLabel: 'No incident timestamp indexed',
    nodes: [],
    edges: [],
    suspects: [],
    artifacts: [],
    warrants: [],
    presetIndex: 0,
    selectedNodeId: '',
    selectedSuspectId: '',
    bandwidthSigmaSec: 4.5,
    mixerEntropyWeight: 0.35,
  };
}
