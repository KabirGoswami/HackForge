import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInvestigation,
  INVESTIGATION_STORAGE_KEY,
  loadInvestigationStore,
  saveInvestigationStore,
  type InvestigationStore,
} from './investigations.ts';
import {
  INITIAL_LEDGER_EDGES,
  INITIAL_OSINT_ARTIFACTS,
  INITIAL_SUSPECTS,
  INITIAL_WALLET_NODES,
} from './engine/forensicEngine.ts';

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(INVESTIGATION_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('first visit preserves the Ghost Attacks replay fixture and original staging freeze', () => {
  const store = loadInvestigationStore(memoryStorage());
  const investigation = store.investigations[0];
  assert.equal(store.version, 1);
  assert.equal(store.activeInvestigationId, investigation.id);
  assert.equal(investigation.title, 'Ghost Attacks');
  assert.equal(investigation.reference, 'AT-42M-0214');
  assert.equal(investigation.mode, 'replay');
  assert.equal(investigation.drainedUsd, 42_000_000);
  assert.deepEqual(investigation.nodes, INITIAL_WALLET_NODES);
  assert.deepEqual(investigation.edges, INITIAL_LEDGER_EDGES);
  assert.deepEqual(investigation.suspects, INITIAL_SUSPECTS);
  assert.deepEqual(investigation.artifacts, INITIAL_OSINT_ARTIFACTS);
  assert.equal(investigation.warrants[0].frozenAmountUsd, 1_120_000);
  assert.equal(investigation.warrants[0].targetWalletAddress, '0xc409e881b27a4401f932d110e87a5502b991f312');
  assert.equal(investigation.selectedNodeId, 'w-cex-offshore-1');
  assert.equal(investigation.selectedSuspectId, 'susp-kestrel');
  assert.equal(investigation.bandwidthSigmaSec, 4.5);
  assert.equal(investigation.mixerEntropyWeight, 0.35);
});

test('fresh stores do not share mutable seed data', () => {
  const first = loadInvestigationStore(memoryStorage()).investigations[0];
  const second = loadInvestigationStore(memoryStorage()).investigations[0];
  first.nodes[0].label = 'Local edit';
  first.suspects[0].knownIps.push('127.0.0.1');
  first.artifacts[0].extractedIps.length = 0;
  assert.equal(second.nodes[0].label, INITIAL_WALLET_NODES[0].label);
  assert.deepEqual(second.suspects, INITIAL_SUSPECTS);
  assert.deepEqual(second.artifacts, INITIAL_OSINT_ARTIFACTS);
});

test('new investigations have unique identities, sequential references and independent empty case data', () => {
  const existing = loadInvestigationStore(memoryStorage()).investigations;
  const first = createInvestigation({ title: '  Blackwater  ', description: '  Follow the bridge relay.  ' }, existing);
  const second = createInvestigation({ title: 'Blackwater' }, [...existing, first]);
  assert.equal(first.title, 'Blackwater');
  assert.equal(first.description, 'Follow the bridge relay.');
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.reference, second.reference);
  assert.match(first.reference, /^CASE-\d{4}-0002$/);
  assert.match(second.reference, /^CASE-\d{4}-0003$/);
  assert.equal(first.mode, 'custom');
  assert.equal(first.drainedUsd, 0);
  assert.equal(first.exploitLabel, 'No incident timestamp indexed');
  assert.equal(first.selectedNodeId, '');
  assert.equal(first.selectedSuspectId, '');
  assert.ok(Number.isFinite(Date.parse(first.createdAtUtc)));
  for (const field of ['nodes', 'edges', 'suspects', 'artifacts', 'warrants'] as const) {
    assert.deepEqual(first[field], []);
    assert.notEqual(first[field], second[field]);
    assert.notEqual(first[field], existing[0][field]);
  }
  assert.throws(() => createInvestigation({ title: ' \n\t ' }, existing), /Enter an investigation name/);
});

test('saving and loading preserves the active case and changes without leaking replay data to a new case', () => {
  const storage = memoryStorage();
  const store = loadInvestigationStore(storage);
  const investigation = createInvestigation({ title: 'Bridge Relay' }, store.investigations);
  investigation.artifacts = [{ ...structuredClone(INITIAL_OSINT_ARTIFACTS[0]), id: 'relay-evidence', linkedSuspectId: '' }];
  investigation.bandwidthSigmaSec = 6;
  store.investigations.push(investigation);
  store.activeInvestigationId = investigation.id;
  store.investigations[0].presetIndex = 1;
  store.investigations[0].selectedNodeId = 'w-origin';
  assert.equal(saveInvestigationStore(store, storage), true);

  const restored = loadInvestigationStore(storage);
  assert.deepEqual(restored, store);
  assert.equal(restored.activeInvestigationId, investigation.id);
  const custom = restored.investigations[1];
  assert.equal(custom.artifacts[0].id, 'relay-evidence');
  assert.deepEqual(custom.nodes, []);
  assert.deepEqual(custom.suspects, []);
  assert.deepEqual(custom.warrants, []);
  assert.equal(restored.investigations[0].artifacts.length, INITIAL_OSINT_ARTIFACTS.length);
});

test('malformed stores and broken graph records fall back safely while retaining other valid investigations', () => {
  for (const raw of ['{broken', 'null', '[]', '{}', '{"version":2,"investigations":[]}', '{"version":1,"investigations":[null,{}]}']) {
    const restored = loadInvestigationStore(memoryStorage(raw));
    assert.equal(restored.investigations.length, 1);
    assert.equal(restored.investigations[0].title, 'Ghost Attacks');
  }

  const store = loadInvestigationStore(memoryStorage());
  const custom = createInvestigation({ title: 'Keep this case' }, store.investigations);
  store.investigations.push(custom);
  store.activeInvestigationId = custom.id;
  store.investigations[0].nodes = [];
  const restored = loadInvestigationStore(memoryStorage(JSON.stringify(store)));
  assert.equal(restored.activeInvestigationId, custom.id);
  assert.equal(restored.investigations[0].nodes.length, INITIAL_WALLET_NODES.length);
  assert.deepEqual(restored.investigations[1], custom);

  const invalidArtifact = loadInvestigationStore(memoryStorage());
  (invalidArtifact.investigations[0].artifacts[0] as unknown as { extractedIps: null }).extractedIps = null;
  const safelyRestored = loadInvestigationStore(memoryStorage(JSON.stringify(invalidArtifact)));
  assert.deepEqual(safelyRestored.investigations[0].artifacts, INITIAL_OSINT_ARTIFACTS);
});

test('unknown active cases and stale selections recover to usable existing values', () => {
  const store = loadInvestigationStore(memoryStorage());
  store.activeInvestigationId = 'missing';
  store.investigations[0].selectedNodeId = 'missing-wallet';
  store.investigations[0].selectedSuspectId = 'missing-suspect';
  const restored = loadInvestigationStore(memoryStorage(JSON.stringify(store)));
  assert.equal(restored.activeInvestigationId, 'ghost-attacks');
  assert.equal(restored.investigations[0].selectedNodeId, INITIAL_WALLET_NODES[0].id);
  assert.equal(restored.investigations[0].selectedSuspectId, INITIAL_SUSPECTS[0].id);
});

test('storage access and quota errors keep default cases usable and report save failure', () => {
  const throwingStorage = {
    getItem: () => { throw new Error('Storage disabled'); },
    setItem: () => { throw new Error('Quota exceeded'); },
  };
  const store: InvestigationStore = loadInvestigationStore(throwingStorage);
  assert.equal(store.investigations[0].title, 'Ghost Attacks');
  assert.equal(saveInvestigationStore(store, throwingStorage), false);
  assert.equal(store.investigations[0].nodes.length, INITIAL_WALLET_NODES.length);
});
