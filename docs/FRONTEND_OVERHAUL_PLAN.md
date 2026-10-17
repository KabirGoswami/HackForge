# QOBE frontend overhaul: The Evidence Bridge

## Direction

Make QOBE feel like a precise forensic instrument built for two disciplines working on the same incident. The signature screen puts human evidence on the left, financial movement on the right, and an inspectable correlation bridge between them. The impressive moment is seeing a source excerpt illuminate its corresponding transaction path.

Keep QOBE as the product name. Use **Ghost Attacks** as the case/demo title and **Evidence Bridge** as the shared workspace name. This avoids confusing the evidence bridge with an actual cross-chain bridge in the ledger.

## What the current project already supports

- React, Vite, TypeScript, Tailwind, Lucide, and Motion are installed.
- `App.tsx` owns artifacts, wallet selection, suspect selection, correlation parameters, case actions, and JSON export.
- `OsintScraperPanel.tsx` supports source filters, text search, manual ingestion, marker extraction, and queued fixture ingestion.
- `MatrixGraphCanvas.tsx` already supports an SVG transaction graph, volume matrix, transition matrix, and wallet inspection.
- `LatencyAnalysisView.tsx` exposes timing, behavior, graph scores, and model controls.
- `CaseOverview.tsx` and `FreezeWarrantsView.tsx` contain the incident summary, attribution list, and case actions.
- The current interface has a consistent amethyst theme, but large colored summary blocks and repeated panels compete for attention. Its default screen gives results before showing how the two disciplines connect.
- The React experience currently uses local fixtures and a weighted scoring function. The Python/FastAPI implementation is separate; the React app does not currently call its endpoints. “Live,” “scrape,” mathematical proof, calibrated identity probability, and enforced asset freezes must not be implied by a visual redesign alone.

## Visual system

Use a dark graphite-blue work surface, quieter than the current purple panels. Preserve violet as the semantic color for fused evidence.

| Token | Value | Use |
| --- | --- | --- |
| Deep slate | `#101924` | Application canvas |
| Raised slate | `#192534` | Inspector and selected surfaces |
| Chalk | `#E6EDF4` | Primary text |
| Brass | `#D5AD73` | OSINT evidence marks |
| Glacier | `#78B5D2` | Ledger marks |
| Iris | `#A49BD0` | Correlation links and selection |

Derive borders and secondary text from neutral slate, with readable contrast. Reserve semantic red for an actionable warning and green for a confirmed system state; neither represents attribution confidence. A large score is not a danger indicator.

Use **IBM Plex Sans** for headings, body, controls, and numeric summaries. Retain the installed **JetBrains Mono** for wallet strings, code excerpts, transaction hashes, and time deltas. Keep typography largely left aligned: 28–32px page titles, 18–20px section titles, 14px body, and 12px secondary annotations. Use tabular figures for aligned amounts and changing values.

Use an 8px spacing rhythm, 24–32px workspace padding, 6px control radii, and 10–12px inspector radii. Group related rows with spacing and subtle rules. Most of the canvas stays unboxed; selected evidence and inspectors get bounded surfaces.

## Signature desktop composition

```text
QOBE     Bridge   Evidence   Ledger   Models   Case        Case AT-42M-0214
Ghost Attacks                              Replay data · 02:14 UTC exploit
42.00M drained       9 wallet clusters       5 indexed sources

OSINT investigators         Evidence Bridge          Blockchain analysts
-------------------         ---------------          -------------------
GitHub commit               Source marker             Origin
@kestrel_0x                 |                         /     \
                            Fee match                Splitter clusters
Source excerpt              3.14159 gwei               |        |
with marked entities        |                         Bridge   Mixer
                            Timing match               \       /
Other evidence              +1.40 seconds              Staging wallet
Telegram · Forum            |                              |
                            Candidate link             Cash-out endpoint

Synchronized evidence / ledger timeline and selected-link explanation
```

At wide desktop sizes, give roughly 30% to OSINT, 22% to the bridge, and 48% to ledger activity. The graph needs the most space. Align the three lane headings and relevant evidence anchors. Do not draw a web of connectors across paragraphs: use dedicated connection gutters and stable anchor points.

The two team labels identify professional lenses. They do not imply implemented membership, presence, permissions, or multi-user collaboration. Both disciplines inspect the same selected evidence and case state.

## The bridge interaction

1. Select a GitHub commit, public message, or other source artifact.
2. Highlight extracted handles, wallet fragments, timestamps, and fee constants inside the original excerpt.
3. Show explicit matching reasons in the center: fee match, wallet reference, timing association, or graph proximity. Display only reasons actually supported by this candidate's data.
4. Illuminate the corresponding wallet cluster and transaction path. Unrelated graph structure remains visible at reduced emphasis.
5. Select a reason to inspect its underlying artifact and transaction IDs, signed timestamp difference, observed value, and matching method.
6. Open the model inspector for aggregate timing, behavior, and graph contributions. Keep per-event latency distinct from the aggregate mean.
7. Add a reviewed finding to the case packet. Preserve the source IDs, selected wallet, model parameters, and data timestamp in the export.

Reverse selection works too: choosing a wallet surfaces related source artifacts, with an explicit empty state if no supported off-chain evidence exists. Never silently substitute the top suspect for an unmatched wallet.

Use solid lines for observed ledger transfers, dashed lines for inferred source-to-wallet associations, and a separate labeled review state. Line thickness encodes transfer volume only on ledger edges. Confidence remains a numeric model score, rather than an ambiguous glowing line.

## Supporting screens

| Screen | Purpose and change |
| --- | --- |
| Bridge | Default workspace. Shared evidence, correlation explanation, ledger view, and synchronized timeline. Replaces the current results-heavy first impression. |
| Evidence | Expand the existing OSINT panel into a source list plus excerpt inspector. Keep search, filters, extraction preview, ingestion validation, and provenance visible. Show source-fetch status only when backed by a real connector. |
| Ledger | Preserve graph / volume / transition views, with stable node positions, labeled chain groupings, aggregated clusters, and a wallet inspector. Expand a cluster on demand rather than simulating hundreds of moving dots. |
| Models | Refine the existing latency view into aligned OSINT and ledger event lanes on one UTC axis, score contributions, and a collapsible parameter inspector. Show statistical tests only when their actual results are available. |
| Case | Consolidate incident overview, findings, case export, and intervention records. Present intervention as a simulated workflow until a real integration returns a verified result. |

Keep incident context compact in the header. Show data provenance, replay/live mode, and freshness. Use a real elapsed duration only when derived from a known incident clock. Do not invent a countdown to cash-out.

## Motion and restraint

Make the selected source-to-wallet connection the one memorable visual event: reveal the matching path once, in approximately 300–450ms, after a user action. Use 150–200ms state transitions elsewhere. Keep the graph still during reading, and preserve positions across updates.

Use a thin static bridge spine, gentle selected marks, and small source icons. Avoid continuous particle streams, simulated terminal logs, scanlines, spinning globes, 3D bridge sculptures, full-panel gradients, and broad neon glows. These compete with evidence and make the instrument harder to trust.

## Responsive and accessible behavior

- At 1280px and above, show all three lanes. Fit the primary interaction into the first screen at typical laptop heights; let deeper evidence continue below.
- At 900–1279px, narrow the bridge into a compact explanation rail and open long source/transaction detail in a drawer.
- Below 900px, stack Source → Match → Ledger around the same selected connection. Keep concise team labels and a persistent selection summary.
- At phone widths, provide a readable transaction list alongside the graph. Never shrink graph labels or a desktop triptych to fit.
- Make source rows, graph nodes, and model controls keyboard accessible, with clear focus and descriptive labels. Supply a list alternative for graph relationships.
- Pair colors with team labels, source icons, node shapes, and line styles. Respect reduced motion. Maintain text contrast and touch targets of approximately 44px.
- Cover loading, empty, stale data, connector failure, no match, partial match, and rejected finding states. Low-evidence candidates should look incomplete, not broken.

## Implementation plan

### Pass 1: Foundation and shell

Update tokens in `src/index.css`, import the chosen typeface in `src/main.tsx`, and simplify the shell in `src/App.tsx`. Keep existing deep links working, including a deliberate redirect from the old overview route to the new Bridge. Preserve draft/filter state, keyboard navigation, mobile behavior, and JSON export. Add an explicit replay-data state.

### Pass 2: Build the Evidence Bridge

Add `BridgeWorkspace`, `EvidenceSourceList`, `SourceExcerpt`, `CorrelationSpine`, and `WalletInspector` under `src/components/`. Refactor the current graph into a reusable visualization with a compact and an expanded mode; keep `MatrixGraphCanvas` as the Ledger screen wrapper.

Introduce shared `selectedArtifactId`, `selectedWalletId`, `selectedCorrelationId`, and an optional selected time range in the existing top-level state. A small typed selection object and derived selectors are sufficient; a state library is not needed for the current scope.

### Pass 3: Make the displayed connections inspectable

Add a typed candidate-evidence record containing artifact ID, transaction IDs, wallet IDs, reason type, observed values, signed delta, and method. Derive these records from the same matching logic used by the engine. Return them with the correlation result rather than independently approximating matches in each component.

The current temporal score searches across all ledger edges and returns an aggregate score; it does not expose the specific pairs as evidence. Resolve this before presenting a precise source-to-wallet bridge. A wallet fragment, a nearby timestamp, and an IP observation need distinct reason labels; temporal proximity alone must not produce a claimed identity or ownership link.

Display the current `posteriorProbability` as **Model score** while the frontend uses its existing heuristic. Do not fabricate p-values, uncertainty intervals, live throughput, or reviewer approvals. Preserve unknown values as unknown.

### Pass 4: Refine the supporting tools

Apply the same typography, team cues, selection behavior, and inspector pattern to the existing Evidence, Ledger, and Models views. Consolidate case reporting and replace automatic “enforced” language with accurate workflow states. Keep the current simulated intervention available as an explicitly labeled demo action.

Store review state separately from model score. If review functionality is implemented, include candidate/proposed, analyst-reviewed, dismissed, and exported states with provenance. A review label must reflect a real local action or stored record.

### Pass 5: Verify the complete demonstration

Run TypeScript checking and the production build. Verify the meaningful flows in the browser: source selection updates the bridge and graph; reverse wallet selection returns the right artifacts; an unmatched wallet stays unmatched; new evidence updates only supported candidates; model changes update the explanation; filters and drafts survive navigation; export contains the selected evidence; simulated intervention remains labeled.

Add focused tests for candidate-to-evidence pairing and synchronized selection, since those are the core new behavior. Verify desktop, laptop, and phone layouts, keyboard operation, readable data labels, empty/error states, and reduced motion. Avoid writing tests for static visual decoration.

## Scope and order

Prioritize the Bridge screen, reusable graph, candidate evidence contract, and shared selection. Then refine the existing tools. Backend connectivity, automatic scraping, actual intervention delivery, authentication, and team presence are separate integration work; they must not be implied by frontend chrome.

The first review should show this complete path using the existing fixture: select `@kestrel_0x`'s GitHub excerpt → inspect the `3.14159 gwei` marker → inspect the associated transaction and its timing → follow the wallet path → add the finding to a case packet. A second, weaker candidate should demonstrate how the interface handles uncertainty.

## Design critique

An initial “cyber war room” direction would repeat familiar security-dashboard styling without expressing the problem. The revised design spends its visual emphasis on an inspectable evidence-to-ledger connection. Team identity belongs in the marks and lane labels, while the surrounding work surface stays neutral. The bridge earns its place through synchronized selection and explainable evidence.

This is a planning deliverable. Application source files have not been changed for this proposal.
