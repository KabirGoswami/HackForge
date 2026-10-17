import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOsintMarkers,
  buildAdjacencyMatrix,
  computeLatencyScore,
  computeBehavioralSimilarity,
  correlateIdentities,
  INITIAL_WALLET_NODES,
  INITIAL_LEDGER_EDGES,
  INITIAL_OSINT_ARTIFACTS,
  INITIAL_SUSPECTS,
} from './forensicEngine.ts';

test('extractOsintMarkers parses IPs, wallet hex prefixes, handles, and gas quirks accurately', () => {
  const sample =
    'Commit by @kestrel_0x from 185.220.101.44 routing 0x7a1b9c44 to 0x99e4b108 with 3.14159 gwei (UTC+03:00)';
  const res = extractOsintMarkers(sample);

  assert.deepEqual(res.ips, ['185.220.101.44']);
  assert.deepEqual(res.wallets, ['0x7a1b9c44', '0x99e4b108']);
  assert.deepEqual(res.handles, ['@kestrel_0x']);
  assert.equal(res.gasGwei, 3.14159);
  assert.equal(res.timezone, 'UTC+03:00');
  assert.ok(res.confidenceScore >= 85);
});

test('extractOsintMarkers handles empty input cleanly', () => {
  const res = extractOsintMarkers('   ');
  assert.equal(res.ips.length, 0);
  assert.equal(res.wallets.length, 0);
  assert.equal(res.confidenceScore, 0);
});

test('buildAdjacencyMatrix constructs accurate directed volume and row-stochastic Markov transition matrices', () => {
  const { volumeMatrix, transitionMatrix, nodeEntropies, totalFlowUsd } =
    buildAdjacencyMatrix(INITIAL_WALLET_NODES, INITIAL_LEDGER_EDGES);

  assert.equal(volumeMatrix.length, INITIAL_WALLET_NODES.length);
  // Check primary exploit origin (index 0) outflow sum: 19.4M + 14.8M + 7.38M = 41.58M
  const originOutflow = volumeMatrix[0].reduce((a, b) => a + b, 0);
  assert.equal(originOutflow, 41_580_000);

  // Check Markov row probabilities sum to ~1.0 for active sender nodes
  const probRowSum = transitionMatrix[0].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(probRowSum - 1.0) < 0.002);

  // Origin splits into 3 paths, so Shannon flow entropy must be > 1.3 bits
  assert.ok(nodeEntropies[0] > 1.3);
  assert.ok(totalFlowUsd > 100_000_000);
});

test('computeLatencyScore peaks when observed delta matches expected reaction lag', () => {
  const peak = computeLatencyScore(1.5, 1.5, 4.0);
  const near = computeLatencyScore(2.2, 1.5, 4.0);
  const far = computeLatencyScore(25.0, 1.5, 4.0);

  assert.equal(peak, 1);
  assert.ok(near > 0.95);
  assert.ok(far < 0.01);
});

test('computeBehavioralSimilarity rewards exact gas constant fingerprint and IP/wallet matches', () => {
  const highSim = computeBehavioralSimilarity(3.14159, 3.14159, true, true);
  const lowSim = computeBehavioralSimilarity(3.14159, 1.50001, false, false);

  assert.ok(highSim > 0.95);
  assert.ok(lowSim < 0.1);
});

test('correlateIdentities ranks primary exploit suspect @kestrel_0x highest with >90% posterior probability', () => {
  const rankings = correlateIdentities(
    INITIAL_WALLET_NODES,
    INITIAL_LEDGER_EDGES,
    INITIAL_OSINT_ARTIFACTS,
    INITIAL_SUSPECTS,
    4.5,
    0.35
  );

  assert.equal(rankings.length, 3);
  assert.equal(rankings[0].suspectHandle, '@kestrel_0x');
  assert.ok(rankings[0].posteriorProbability >= 90);
  assert.equal(rankings[0].status, 'Active Cash-Out Threat');
  assert.ok(rankings[0].meanTimeDeltaSec < 2.0);
});
