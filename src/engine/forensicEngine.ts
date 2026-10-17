export interface WalletNode {
  id: string;
  address: string;
  label: string;
  chain: 'Ethereum' | 'Arbitrum' | 'Optimism' | 'Polygon' | 'Solana-Wormhole';
  role: 'exploit_origin' | 'splitter_bot' | 'privacy_mixer' | 'cross_chain_bridge' | 'staging_wallet' | 'offshore_exchange';
  balanceUsd: number;
  inflowUsd: number;
  outflowUsd: number;
  txCount: number;
  firstSeenSec: number; // Seconds after 02:14:00 UTC Tuesday
  lastSeenSec: number;
  gasFingerprintGwei: number;
  botJitterMs: number;
  clusterId: string;
  x: number; // Normalized layout coordinate 0..1000
  y: number; // Normalized layout coordinate 0..560
}

export interface LedgerEdge {
  id: string;
  sourceId: string;
  targetId: string;
  amountUsd: number;
  txCount: number;
  timestampSec: number; // Seconds after 02:14:00 UTC
  txHash: string;
  bridgeOrMixerTag?: string;
  timeDeltaFromParentSec: number;
}

export interface OsintArtifact {
  id: string;
  sourceType: 'GitHub Commit' | 'Telegram Channel' | 'Dark Web Forum' | 'Paste / Gist';
  sourceOrigin: string;
  timestampUtc: string;
  timestampSec: number; // Seconds relative to 02:14:00 UTC (can be negative for pre-exploit recon)
  authorAlias: string;
  rawText: string;
  extractedIps: string[];
  extractedWallets: string[];
  extractedGasQuirk?: number;
  timezoneOffset: string;
  pgpfingerprint?: string;
  linkedSuspectId: string;
  verifiedMatch: boolean;
}

export interface SuspectEntity {
  id: string;
  handle: string;
  realNameHint: string;
  primaryOrigin: string;
  knownIps: string[];
  timezone: string;
  signatureQuirk: string;
  characteristicGasGwei: number;
  typicalReactionLagSec: number;
  associatedWallets: string[];
  targetExchangeWalletId: string;
  priorConfidence: number;
}

export interface CorrelationBreakdown {
  suspectId: string;
  suspectHandle: string;
  realNameHint: string;
  targetWalletId: string;
  targetWalletAddress: string;
  offshoreExchangeWallet: string;
  temporalScore: number;       // 0..1
  behavioralScore: number;     // 0..1
  graphClusterScore: number;   // 0..1
  posteriorProbability: number; // 0..100 percentage
  meanTimeDeltaSec: number;
  matchedEventCount: number;
  matchedArtifacts: OsintArtifact[];
  atRiskVolumeUsd: number;
  status: 'Active Cash-Out Threat' | 'Mixer Transit' | 'Secondary Accomplice' | 'Low Probability Noise';
}

export interface FreezeWarrant {
  warrantId: string;
  createdAtUtc: string;
  suspectHandle: string;
  targetWalletAddress: string;
  exchangeEndpoint: string;
  frozenAmountUsd: number;
  posteriorConfidence: number;
  primaryEvidenceHash: string;
  meanLatencyDeltaSec: number;
  status: 'ENFORCED_FREEZE' | 'PENDING_RELAY';
}

export interface ExtractedOsintResult {
  ips: string[];
  wallets: string[];
  handles: string[];
  gasGwei: number | null;
  timezone: string;
  confidenceScore: number;
}

/**
 * Extracts structured identity markers from raw unstructured OSINT text
 * (Dark Web posts, GitHub commit diffs, Telegram logs).
 */
export function extractOsintMarkers(rawText: string): ExtractedOsintResult {
  if (!rawText || !rawText.trim()) {
    return {
      ips: [],
      wallets: [],
      handles: [],
      gasGwei: null,
      timezone: 'UTC+00:00',
      confidenceScore: 0,
    };
  }

  // Extract IPv4 addresses
  const ipRegex = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  const ips = Array.from(new Set(rawText.match(ipRegex) || []));

  // Extract Ethereum/EVM style wallet addresses or prefixes (0x followed by 4+ hex chars)
  const walletRegex = /\b0x[a-fA-F0-9]{4,40}(?:\.{2,3}[a-fA-F0-9]{2,8})?\b/g;
  const wallets = Array.from(new Set(rawText.match(walletRegex) || []));

  // Extract @handles
  const handleRegex = /@([a-zA-Z0-9_.-]{3,24})/g;
  const handles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = handleRegex.exec(rawText)) !== null) {
    if (!handles.includes(`@${match[1]}`)) {
      handles.push(`@${match[1]}`);
    }
  }

  // Extract gas price quirk in gwei (e.g., "3.14159 gwei" or "maxPriorityFeePerGas: 3.14159")
  const gasRegex = /(\d+\.\d+)\s*(?:gwei|GWEI)/i;
  const gasMatch = rawText.match(gasRegex);
  const gasGwei = gasMatch ? parseFloat(gasMatch[1]) : null;

  // Extract timezone offset (e.g., UTC+3, +03:00, GMT+8)
  const tzRegex = /\b(?:UTC|GMT)?([+-]\d{1,2}(?::\d{2})?)\b/i;
  const tzMatch = rawText.match(tzRegex);
  const timezone = tzMatch ? `UTC${tzMatch[1]}` : 'UTC+03:00';

  const markerCount =
    ips.length * 28 +
    wallets.length * 32 +
    handles.length * 20 +
    (gasGwei !== null ? 20 : 0);

  const confidenceScore = Math.min(99, Math.max(15, markerCount));

  return {
    ips,
    wallets,
    handles,
    gasGwei,
    timezone,
    confidenceScore,
  };
}

/**
 * Builds the N x N directed adjacency matrix A where A[i][j] is the total USD (in millions)
 * transferred from wallet nodes[i] to nodes[j], plus row-normalized stochastic Markov matrix P[i][j]
 * and Shannon flow entropy per wallet node.
 */
export function buildAdjacencyMatrix(
  nodes: WalletNode[],
  edges: LedgerEdge[]
): {
  volumeMatrix: number[][];
  transitionMatrix: number[][];
  nodeEntropies: number[];
  totalFlowUsd: number;
} {
  const n = nodes.length;
  const indexMap = new Map<string, number>();
  nodes.forEach((node, idx) => indexMap.set(node.id, idx));

  const volumeMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let totalFlowUsd = 0;

  for (const edge of edges) {
    const u = indexMap.get(edge.sourceId);
    const v = indexMap.get(edge.targetId);
    if (u !== undefined && v !== undefined) {
      volumeMatrix[u][v] += edge.amountUsd;
      totalFlowUsd += edge.amountUsd;
    }
  }

  const transitionMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const nodeEntropies: number[] = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const rowSum = volumeMatrix[i].reduce((acc, val) => acc + val, 0);
    if (rowSum > 0) {
      let entropy = 0;
      for (let j = 0; j < n; j++) {
        const p = volumeMatrix[i][j] / rowSum;
        transitionMatrix[i][j] = Number(p.toFixed(4));
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
      }
      nodeEntropies[i] = Number(entropy.toFixed(3));
    }
  }

  return {
    volumeMatrix,
    transitionMatrix,
    nodeEntropies,
    totalFlowUsd,
  };
}

/**
 * Computes the Gaussian / Hawkes time-delta latency correlation score between
 * an OSINT event timestamp and an on-chain transaction timestamp.
 *
 * @param deltaSec Observed time delta (t_tx - t_osint) in seconds
 * @param expectedLagSec Expected automation / operator latency in seconds
 * @param bandwidthSigmaSec Bandwidth parameter sigma in seconds
 */
export function computeLatencyScore(
  deltaSec: number,
  expectedLagSec: number,
  bandwidthSigmaSec: number
): number {
  if (bandwidthSigmaSec <= 0) {
    return deltaSec === expectedLagSec ? 1 : 0;
  }
  const diff = Math.abs(deltaSec) - expectedLagSec;
  const exponent = -(diff * diff) / (2 * bandwidthSigmaSec * bandwidthSigmaSec);
  const raw = Math.exp(exponent);
  return Number(Math.max(0, Math.min(1, raw)).toFixed(4));
}

/**
 * Computes Behavioral Cosine Similarity between a suspect's known gas/script signature
 * and a target wallet cluster's observed parameters.
 */
export function computeBehavioralSimilarity(
  suspectGasGwei: number,
  walletGasGwei: number,
  hasIpMatch: boolean,
  hasDirectWalletFragment: boolean
): number {
  const gasDiff = Math.abs(suspectGasGwei - walletGasGwei);
  const gasSim = Math.exp(-(gasDiff * gasDiff) / 0.5); // High precision match when gas constants match (e.g. 3.14159 gwei)
  const ipBoost = hasIpMatch ? 0.22 : 0;
  const walletBoost = hasDirectWalletFragment ? 0.28 : 0;
  const combined = Math.min(0.995, gasSim * 0.58 + ipBoost + walletBoost);
  return Number(combined.toFixed(4));
}

/**
 * Fuses unstructured OSINT artifacts with the live blockchain ledger matrix
 * to compute Bayesian Posterior Attribution Probabilities for each suspect.
 */
export function correlateIdentities(
  nodes: WalletNode[],
  edges: LedgerEdge[],
  artifacts: OsintArtifact[],
  suspects: SuspectEntity[],
  bandwidthSigmaSec: number = 4.5,
  mixerEntropyWeight: number = 0.35
): CorrelationBreakdown[] {
  const { transitionMatrix } = buildAdjacencyMatrix(nodes, edges);
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

  const results: CorrelationBreakdown[] = suspects.map((suspect) => {
    const matchedArtifacts = artifacts.filter(
      (a) =>
        a.linkedSuspectId === suspect.id ||
        a.authorAlias.toLowerCase() === suspect.handle.toLowerCase() ||
        a.extractedIps.some((ip) => suspect.knownIps.includes(ip))
    );

    const targetNode =
      nodes.find((n) => n.id === suspect.targetExchangeWalletId) ||
      nodes[nodes.length - 1];

    // Find edges associated with suspect's target cluster or staging path
    const relevantEdges = edges.filter(
      (e) =>
        e.targetId === targetNode.id ||
        e.sourceId === targetNode.id ||
        suspect.associatedWallets.some((w) =>
          nodes.find((n) => n.id === e.sourceId)?.address.startsWith(w.slice(0, 6))
        )
    );

    // 1. Temporal Latency Score across matched OSINT events and ledger transactions
    let bestDeltaSum = 0;
    let deltaCount = 0;
    let temporalScoreAccum = 0;

    for (const art of matchedArtifacts) {
      // Find closest ledger transaction after or around the OSINT timestamp
      let minDelta = 999;
      for (const edge of edges) {
        const dt = Math.abs(edge.timestampSec - art.timestampSec);
        if (dt < minDelta) {
          minDelta = dt;
        }
      }
      if (minDelta < 999) {
        const score = computeLatencyScore(
          minDelta,
          suspect.typicalReactionLagSec,
          bandwidthSigmaSec
        );
        temporalScoreAccum += score;
        bestDeltaSum += minDelta;
        deltaCount++;
      }
    }

    const meanTimeDeltaSec =
      deltaCount > 0 ? Number((bestDeltaSum / deltaCount).toFixed(2)) : 48.5;
    const temporalScore =
      deltaCount > 0
        ? Number(Math.min(0.99, temporalScoreAccum / Math.max(1, deltaCount * 0.78)).toFixed(4))
        : 0.18;

    // 2. Behavioral Fingerprint Score
    const hasIpMatch = matchedArtifacts.some((a) =>
      a.extractedIps.some((ip) => suspect.knownIps.includes(ip))
    );
    const hasWalletFragment = matchedArtifacts.some((a) =>
      a.extractedWallets.length > 0
    );
    const behavioralScore = computeBehavioralSimilarity(
      suspect.characteristicGasGwei,
      targetNode.gasFingerprintGwei,
      hasIpMatch,
      hasWalletFragment
    );

    // 3. Graph Cluster Affinity Score (from Markov transition connectivity + volume concentration)
    const targetIdx = nodeIndexMap.get(targetNode.id) ?? 0;
    let inboundProbSum = 0;
    for (let i = 0; i < nodes.length; i++) {
      inboundProbSum += transitionMatrix[i][targetIdx] || 0;
    }
    const baseGraphAffinity = Math.min(
      0.98,
      0.35 + inboundProbSum * 0.42 + (relevantEdges.length / Math.max(1, edges.length)) * 0.65
    );
    const graphClusterScore = Number(
      Math.min(
        0.99,
        baseGraphAffinity * (1 - mixerEntropyWeight * 0.25) +
          (hasWalletFragment ? 0.18 : 0)
      ).toFixed(4)
    );

    // Combine via Bayesian Log-Odds / Weighted Fusion
    const rawLikelihood =
      temporalScore * 0.42 +
      behavioralScore * 0.33 +
      graphClusterScore * 0.25;

    const posteriorRaw =
      (suspect.priorConfidence * 0.2 + rawLikelihood * 0.8) * 100;
    const posteriorProbability = Number(
      Math.min(99.4, Math.max(4.2, posteriorRaw)).toFixed(1)
    );

    let status: CorrelationBreakdown['status'] = 'Low Probability Noise';
    if (posteriorProbability >= 80) {
      status = 'Active Cash-Out Threat';
    } else if (posteriorProbability >= 55) {
      status = 'Mixer Transit';
    } else if (posteriorProbability >= 35) {
      status = 'Secondary Accomplice';
    }

    return {
      suspectId: suspect.id,
      suspectHandle: suspect.handle,
      realNameHint: suspect.realNameHint,
      targetWalletId: targetNode.id,
      targetWalletAddress: targetNode.address,
      offshoreExchangeWallet: targetNode.label,
      temporalScore,
      behavioralScore,
      graphClusterScore,
      posteriorProbability,
      meanTimeDeltaSec,
      matchedEventCount: matchedArtifacts.length,
      matchedArtifacts,
      atRiskVolumeUsd: targetNode.inflowUsd,
      status,
    };
  });

  return results.sort((a, b) => b.posteriorProbability - a.posteriorProbability);
}

// ============================================================================
// DETERMINISTIC INITIAL INCIDENT DATASET ($42,000,000 TUESDAY 02:14 AM EXPLOIT)
// ============================================================================

export const INITIAL_WALLET_NODES: WalletNode[] = [
  {
    id: 'w-origin',
    address: '0x7a1b9c44d82e10f3a90b77c2019f88e3310a4f92',
    label: 'Primary Exploit Drainer (0x7a1b...4f92)',
    chain: 'Ethereum',
    role: 'exploit_origin',
    balanceUsd: 420_000,
    inflowUsd: 42_000_000,
    outflowUsd: 41_580_000,
    txCount: 142,
    firstSeenSec: 180, // 02:17:00 AM (3 mins after 02:14:00 AM alert)
    lastSeenSec: 640,
    gasFingerprintGwei: 3.14159,
    botJitterMs: 18,
    clusterId: 'CL-ALPHA-01',
    x: 90,
    y: 280,
  },
  {
    id: 'w-split-1',
    address: '0x3f8c12a9b044e711d29c8810a55e67c9012b8d14',
    label: 'Peel-Chain Bot Alpha (0x3f8c...8d14)',
    chain: 'Ethereum',
    role: 'splitter_bot',
    balanceUsd: 180_000,
    inflowUsd: 19_400_000,
    outflowUsd: 19_220_000,
    txCount: 318,
    firstSeenSec: 295,
    lastSeenSec: 1840,
    gasFingerprintGwei: 3.14159,
    botJitterMs: 12,
    clusterId: 'CL-ALPHA-01',
    x: 310,
    y: 135,
  },
  {
    id: 'w-split-2',
    address: '0x88d1e4f00219c34a77b51209f83c0192a44e2b07',
    label: 'Peel-Chain Bot Beta (0x88d1...2b07)',
    chain: 'Ethereum',
    role: 'splitter_bot',
    balanceUsd: 250_000,
    inflowUsd: 14_800_000,
    outflowUsd: 14_550_000,
    txCount: 276,
    firstSeenSec: 310,
    lastSeenSec: 2190,
    gasFingerprintGwei: 3.14159,
    botJitterMs: 15,
    clusterId: 'CL-ALPHA-01',
    x: 310,
    y: 280,
  },
  {
    id: 'w-bridge-arb',
    address: '0x51c9a003e847b210d994f12c8300e1187f66c930',
    label: 'Arbitrum Fast-Bridge Relay (0x51c9...c930)',
    chain: 'Arbitrum',
    role: 'cross_chain_bridge',
    balanceUsd: 310_000,
    inflowUsd: 7_380_000,
    outflowUsd: 7_070_000,
    txCount: 94,
    firstSeenSec: 412,
    lastSeenSec: 3600,
    gasFingerprintGwei: 1.50001,
    botJitterMs: 42,
    clusterId: 'CL-GAMMA-03',
    x: 310,
    y: 430,
  },
  {
    id: 'w-mixer-zk',
    address: '0x19f0b77c4312e88a9011d45f6620c1098a77e501',
    label: 'ZK-Nullifier Pool 100 ETH (0x19f0...e501)',
    chain: 'Ethereum',
    role: 'privacy_mixer',
    balanceUsd: 1_850_000,
    inflowUsd: 26_100_000,
    outflowUsd: 24_250_000,
    txCount: 412,
    firstSeenSec: 890,
    lastSeenSec: 11400,
    gasFingerprintGwei: 3.14159,
    botJitterMs: 19,
    clusterId: 'CL-ALPHA-01',
    x: 560,
    y: 165,
  },
  {
    id: 'w-bridge-sol',
    address: '0x64e2d901a338f710c209b44e1823d0049c11a884',
    label: 'Wormhole Cross-Chain Router (0x64e2...a884)',
    chain: 'Solana-Wormhole',
    role: 'cross_chain_bridge',
    balanceUsd: 640_000,
    inflowUsd: 11_420_000,
    outflowUsd: 10_780_000,
    txCount: 164,
    firstSeenSec: 1420,
    lastSeenSec: 14800,
    gasFingerprintGwei: 2.71828,
    botJitterMs: 31,
    clusterId: 'CL-BETA-02',
    x: 560,
    y: 385,
  },
  {
    id: 'w-staging-kestrel',
    address: '0xc409e881b27a4401f932d110e87a5502b991f312',
    label: 'Consolidation Staging Vault (0xc409...f312)',
    chain: 'Arbitrum',
    role: 'staging_wallet',
    balanceUsd: 1_120_000,
    inflowUsd: 28_400_000,
    outflowUsd: 27_280_000,
    txCount: 88,
    firstSeenSec: 12600,
    lastSeenSec: 19800,
    gasFingerprintGwei: 3.14159,
    botJitterMs: 14,
    clusterId: 'CL-ALPHA-01',
    x: 760,
    y: 195,
  },
  {
    id: 'w-cex-offshore-1',
    address: '0x99e4b108c772d409a115e630f882c4190d22c108',
    label: 'Garantex / Sinbad Offshore Desk (0x99e4...c108)',
    chain: 'Ethereum',
    role: 'offshore_exchange',
    balanceUsd: 27_280_000,
    inflowUsd: 27_280_000,
    outflowUsd: 0,
    txCount: 64,
    firstSeenSec: 16200, // Hour 4.5 - Active cash-out staging
    lastSeenSec: 21400, // Hour 5.95
    gasFingerprintGwei: 3.14159,
    botJitterMs: 14,
    clusterId: 'CL-ALPHA-01',
    x: 920,
    y: 155,
  },
  {
    id: 'w-cex-offshore-2',
    address: '0x42b7f903e118c640d290a712b551e803c719d409',
    label: 'No-KYC OTC Liquidity Pool (0x42b7...d409)',
    chain: 'Solana-Wormhole',
    role: 'offshore_exchange',
    balanceUsd: 10_780_000,
    inflowUsd: 10_780_000,
    outflowUsd: 0,
    txCount: 39,
    firstSeenSec: 17100,
    lastSeenSec: 21100,
    gasFingerprintGwei: 2.71828,
    botJitterMs: 33,
    clusterId: 'CL-BETA-02',
    x: 920,
    y: 395,
  },
];

export const INITIAL_LEDGER_EDGES: LedgerEdge[] = [
  {
    id: 'e-1',
    sourceId: 'w-origin',
    targetId: 'w-split-1',
    amountUsd: 19_400_000,
    txCount: 68,
    timestampSec: 295, // 02:18:55 UTC
    txHash: '0x94a1f08e2c77b319d401a88e3310a4f92c11b08d',
    bridgeOrMixerTag: 'Automated Peel Script v4',
    timeDeltaFromParentSec: 1.4,
  },
  {
    id: 'e-2',
    sourceId: 'w-origin',
    targetId: 'w-split-2',
    amountUsd: 14_800_000,
    txCount: 52,
    timestampSec: 310, // 02:19:10 UTC
    txHash: '0x31b8c409e211f77a8092d14c9920e11b7a03f412',
    bridgeOrMixerTag: 'Automated Peel Script v4',
    timeDeltaFromParentSec: 1.6,
  },
  {
    id: 'e-3',
    sourceId: 'w-origin',
    targetId: 'w-bridge-arb',
    amountUsd: 7_380_000,
    txCount: 22,
    timestampSec: 412, // 02:20:52 UTC
    txHash: '0x77e2d109a443c812b009f65e1280c934d811e209',
    bridgeOrMixerTag: 'Arbitrum Canonical Bridge',
    timeDeltaFromParentSec: 2.1,
  },
  {
    id: 'e-4',
    sourceId: 'w-split-1',
    targetId: 'w-mixer-zk',
    amountUsd: 19_220_000,
    txCount: 240,
    timestampSec: 890, // 02:28:50 UTC
    txHash: '0x55c0a918e332d701f449b21a8830c612e904d771',
    bridgeOrMixerTag: 'ZK-Nullifier 100 ETH Batch',
    timeDeltaFromParentSec: 1.5,
  },
  {
    id: 'e-5',
    sourceId: 'w-split-2',
    targetId: 'w-mixer-zk',
    amountUsd: 6_880_000,
    txCount: 96,
    timestampSec: 1120,
    txHash: '0x18f4b209c771e304d992a11f6630b819c402e518',
    bridgeOrMixerTag: 'ZK-Nullifier 100 ETH Batch',
    timeDeltaFromParentSec: 1.7,
  },
  {
    id: 'e-6',
    sourceId: 'w-split-2',
    targetId: 'w-bridge-sol',
    amountUsd: 7_670_000,
    txCount: 110,
    timestampSec: 1420,
    txHash: '0x62d9e104a883f219c004b77e5190d328a710c642',
    bridgeOrMixerTag: 'Wormhole Token Bridge',
    timeDeltaFromParentSec: 3.8,
  },
  {
    id: 'e-7',
    sourceId: 'w-bridge-arb',
    targetId: 'w-staging-kestrel',
    amountUsd: 3_320_000,
    txCount: 41,
    timestampSec: 12600,
    txHash: '0x80a3c719e442b108d993f21c7740e512b809a114',
    bridgeOrMixerTag: 'L2 Rapid Hop',
    timeDeltaFromParentSec: 1.4,
  },
  {
    id: 'e-8',
    sourceId: 'w-bridge-arb',
    targetId: 'w-bridge-sol',
    amountUsd: 3_750_000,
    txCount: 38,
    timestampSec: 4980,
    txHash: '0x29f1d803c664e210a775b90e1130c428f901d330',
    bridgeOrMixerTag: 'Portal Cross-Chain Swap',
    timeDeltaFromParentSec: 4.2,
  },
  {
    id: 'e-9',
    sourceId: 'w-mixer-zk',
    targetId: 'w-staging-kestrel',
    amountUsd: 25_080_000,
    txCount: 185,
    timestampSec: 14400, // Hour 4.0
    txHash: '0x44b8e201f993c710d228a65e8810b309c712f904',
    bridgeOrMixerTag: 'Relayer Exit Unshield',
    timeDeltaFromParentSec: 1.3,
  },
  {
    id: 'e-10',
    sourceId: 'w-staging-kestrel',
    targetId: 'w-cex-offshore-1',
    amountUsd: 27_280_000,
    txCount: 64,
    timestampSec: 19800, // Hour 5.5 - Cash-out consolidation
    txHash: '0xe719a402c883d109f662b40e9910c528a310d882',
    bridgeOrMixerTag: 'Offshore OTC Settlement',
    timeDeltaFromParentSec: 1.4,
  },
  {
    id: 'e-11',
    sourceId: 'w-bridge-sol',
    targetId: 'w-cex-offshore-2',
    amountUsd: 10_780_000,
    txCount: 39,
    timestampSec: 20400, // Hour 5.66
    txHash: '0xb104d992e771c308a554f19e2280b619c401e773',
    bridgeOrMixerTag: 'USDT TRC/SPL Settlement',
    timeDeltaFromParentSec: 4.1,
  },
];

export const INITIAL_SUSPECTS: SuspectEntity[] = [
  {
    id: 'susp-kestrel',
    handle: '@kestrel_0x',
    realNameHint: 'Aleksei V. ("Kestrel" / MEV & Solidity Auditor)',
    primaryOrigin: 'GitHub / Dread / Telegram #dark-mev-core',
    knownIps: ['185.220.101.44', '91.219.236.174'],
    timezone: 'UTC+03:00',
    signatureQuirk: 'Hardcodes maxPriorityFeePerGas = 3.14159 gwei & 1400ms RPC cron jitter',
    characteristicGasGwei: 3.14159,
    typicalReactionLagSec: 1.5,
    associatedWallets: ['0x7a1b9c', '0x3f8c12', '0xc409e8', '0x99e4b1'],
    targetExchangeWalletId: 'w-cex-offshore-1',
    priorConfidence: 0.88,
  },
  {
    id: 'susp-v0id',
    handle: '@v0id_rust',
    realNameHint: 'M. Lindqvist (Cross-Chain Bridge Relayer Dev)',
    primaryOrigin: 'GitHub Gist / Wormhole Fork Commit Logs',
    knownIps: ['45.142.214.89'],
    timezone: 'UTC+02:00',
    signatureQuirk: 'Uses Euler constant 2.71828 gwei gas fee in Solana-Wormhole relay scripts',
    characteristicGasGwei: 2.71828,
    typicalReactionLagSec: 4.0,
    associatedWallets: ['0x64e2d9', '0x42b7f9'],
    targetExchangeWalletId: 'w-cex-offshore-2',
    priorConfidence: 0.64,
  },
  {
    id: 'susp-lynx',
    handle: '@cipher_lynx',
    realNameHint: 'Unverified Broker ("Lynx OTC Syndicate")',
    primaryOrigin: 'Telegram #otc-fiat-rails',
    knownIps: ['103.152.118.21'],
    timezone: 'UTC+08:00',
    signatureQuirk: 'Manual L2 batch bridge transfers with 1.50001 gwei priority fee',
    characteristicGasGwei: 1.50001,
    typicalReactionLagSec: 9.5,
    associatedWallets: ['0x51c9a0'],
    targetExchangeWalletId: 'w-bridge-arb',
    priorConfidence: 0.34,
  },
];

export const INITIAL_OSINT_ARTIFACTS: OsintArtifact[] = [
  {
    id: 'osint-1',
    sourceType: 'GitHub Commit',
    sourceOrigin: 'github.com/kestrel-labs/evm-peel-router (commit 8f3a91d)',
    timestampUtc: '02:18:53.600 UTC',
    timestampSec: 293.6, // 1.4s before e-1 (295s)
    authorAlias: '@kestrel_0x',
    rawText:
      'feat(peel): trigger split batch from 0x7a1b9c44 to 0x3f8c12a9 via RPC 185.220.101.44; set maxPriorityFeePerGas: 3.14159 gwei (+03:00)',
    extractedIps: ['185.220.101.44'],
    extractedWallets: ['0x7a1b9c44', '0x3f8c12a9'],
    extractedGasQuirk: 3.14159,
    timezoneOffset: 'UTC+03:00',
    pgpfingerprint: '4F92 88E3 C108 7A1B',
    linkedSuspectId: 'susp-kestrel',
    verifiedMatch: true,
  },
  {
    id: 'osint-2',
    sourceType: 'Telegram Channel',
    sourceOrigin: 't.me/defi_zero_day_ops (#48192)',
    timestampUtc: '02:28:48.500 UTC',
    timestampSec: 888.5, // 1.5s before e-4 (890s)
    authorAlias: '@kestrel_0x',
    rawText:
      '@kestrel_0x: "zk-nullifier batch queued on 0x19f0b77c from egress node 91.219.236.174 — priority fee locked at 3.14159 gwei, unshielding to 0xc409e881 in 3.5h"',
    extractedIps: ['91.219.236.174'],
    extractedWallets: ['0x19f0b77c', '0xc409e881'],
    extractedGasQuirk: 3.14159,
    timezoneOffset: 'UTC+03:00',
    linkedSuspectId: 'susp-kestrel',
    verifiedMatch: true,
  },
  {
    id: 'osint-3',
    sourceType: 'Dark Web Forum',
    sourceOrigin: 'exploit.in/threads/offshore-settlement-rails.99412',
    timestampUtc: '07:43:58.600 UTC',
    timestampSec: 19798.6, // 1.4s before e-10 (19800s)
    authorAlias: '@kestrel_0x',
    rawText:
      'Escrow ready by @kestrel_0x (session IP 185.220.101.44, UTC+03:00): routing $27.28M tranche into offshore desk 0x99e4b108c772 with 3.14159 gwei tip.',
    extractedIps: ['185.220.101.44'],
    extractedWallets: ['0x99e4b108c772'],
    extractedGasQuirk: 3.14159,
    timezoneOffset: 'UTC+03:00',
    linkedSuspectId: 'susp-kestrel',
    verifiedMatch: true,
  },
  {
    id: 'osint-4',
    sourceType: 'Paste / Gist',
    sourceOrigin: 'gist.github.com/v0id_rust/72b19a04 (unlisted)',
    timestampUtc: '02:37:36.200 UTC',
    timestampSec: 1416.2, // 3.8s before e-6 (1420s)
    authorAlias: '@v0id_rust',
    rawText:
      '// @v0id_rust Wormhole VAA relay config from 45.142.214.89 (UTC+02:00)\nconst TARGET_BRIDGE = "0x64e2d901"; const DEST_OTC = "0x42b7f903"; // 2.71828 gwei',
    extractedIps: ['45.142.214.89'],
    extractedWallets: ['0x64e2d901', '0x42b7f903'],
    extractedGasQuirk: 2.71828,
    timezoneOffset: 'UTC+02:00',
    linkedSuspectId: 'susp-v0id',
    verifiedMatch: true,
  },
  {
    id: 'osint-5',
    sourceType: 'Telegram Channel',
    sourceOrigin: 't.me/otc_fiat_rails (#11048)',
    timestampUtc: '02:20:42.500 UTC',
    timestampSec: 402.5, // 9.5s before e-3 (412s)
    authorAlias: '@cipher_lynx',
    rawText:
      '@cipher_lynx: L2 bridge liquidity ready at 0x51c9a003 via proxy 103.152.118.21 (UTC+08:00), gas 1.50001 gwei',
    extractedIps: ['103.152.118.21'],
    extractedWallets: ['0x51c9a003'],
    extractedGasQuirk: 1.50001,
    timezoneOffset: 'UTC+08:00',
    linkedSuspectId: 'susp-lynx',
    verifiedMatch: false,
  },
];

export const PRESET_SCRAPE_FEEDS: Omit<OsintArtifact, 'id'>[] = [
  {
    sourceType: 'GitHub Commit',
    sourceOrigin: 'github.com/kestrel-labs/flash-drain-v4 (commit e49c02a)',
    timestampUtc: '06:13:58.700 UTC',
    timestampSec: 14398.7, // 1.3s before e-9 (14400s)
    authorAlias: '@kestrel_0x',
    rawText:
      'chore(relayer): unshield $25.08M batch from 0x19f0b77c to vault 0xc409e881 via 185.220.101.44; fee 3.14159 gwei (UTC+03:00)',
    extractedIps: ['185.220.101.44'],
    extractedWallets: ['0x19f0b77c', '0xc409e881'],
    extractedGasQuirk: 3.14159,
    timezoneOffset: 'UTC+03:00',
    pgpfingerprint: '4F92 88E3 C108 7A1B',
    linkedSuspectId: 'susp-kestrel',
    verifiedMatch: true,
  },
  {
    sourceType: 'Dark Web Forum',
    sourceOrigin: 'dread.onion/d/DeFiExploits/comments/882a1',
    timestampUtc: '07:53:55.900 UTC',
    timestampSec: 20395.9, // 4.1s before e-11 (20400s)
    authorAlias: '@v0id_rust',
    rawText:
      'Signed by @v0id_rust (node 45.142.214.89, UTC+02:00): Wormhole tranche settled to 0x42b7f903e118 with 2.71828 gwei priority constant.',
    extractedIps: ['45.142.214.89'],
    extractedWallets: ['0x42b7f903e118'],
    extractedGasQuirk: 2.71828,
    timezoneOffset: 'UTC+02:00',
    linkedSuspectId: 'susp-v0id',
    verifiedMatch: true,
  },
];
