# C1-J.3 GitHub Developer Intelligence — Project B

## Status

C1-J.3 is implemented on `feature/c1-j3-github-developer-intelligence` as an opt-in `developer` source family consumed from the independently executable Project A Discovery Engine.

Project A is pinned at published commit:

```text
b9002bff2f56ac20c8db696b3137bda336437b8b
```

Project B does not import Project A source code. The integration remains the existing versioned file/process boundary.

## Product boundary

C1-J.3 adds bounded public GitHub developer evidence only. It does not add private repositories, GitHub Enterprise, repository cloning, source/diff/patch downloads, release-asset downloads, GitHub writes or mutations, workflow execution, developer identity enrichment, contact discovery, GitHub-to-LinkedIn mapping, outreach, monitoring, or later source families.

All imported repository, issue, pull-request, comment, review, discussion, release, and derived-signal content is `untrusted_public_content`. Embedded instructions, code, shell commands, workflow text, prompt injection, or policy claims are evidence data, never commands.

## Cross-project runtime shape

```text
Mission Input
  ↓
Mission Understanding
  ↓
discovery_request.v1
  ↓
Project A process
  ↓
search_results.v2
  + developer_source_plan.v1
  + developer_repository_collection.v1
  + developer_thread_manifest.v1
  + developer_thread_metadata.v1
  + developer/threads/*.thread.v1.json
  + developer_comment_collection_manifest.v1
  + developer_comment_metadata.v1
  + developer/comments/*.comment_collection.v1.json
  + developer_signals.v1
  + developer_source_run_telemetry.v1
  ↓
Project B independent validation
  ↓
Evidence → role-only Identity → transparent Ranking → Buyer Map
```

Project B preserves the frozen universal `thread.v1` and `comment_collection.v1` contracts while using developer-specific companion manifests and metadata for GitHub provenance.

## Independently resumable developer stages

GitHub developer work is persisted through eight durable stages:

1. `developer_planning`
2. `developer_repository_retrieval`
3. `developer_thread_retrieval`
4. `developer_thread_context`
5. `developer_comment_retrieval`
6. `developer_comment_context`
7. `developer_analysis`
8. `developer_source_telemetry`

Each stage has its own durable artifact and fingerprint input. A malformed or missing later developer sidecar fails at that exact stage. Earlier completed discovery, extraction, structured parsing, hiring, community, and developer stages remain reusable on same-run resume.

The controlled release suite proves missing and invalid JSON boundaries independently for the plan, repository collection, thread manifest, thread metadata, comment manifest, comment metadata, developer signals, and developer telemetry. It also proves in-place signal repair followed by same-run resume with earlier stages marked `reused`.

## Configuration

Source adapters remain disabled by default. C1-J.3 is explicit opt-in:

```text
CLUVVI_DISCOVERY_MODE=local_discovery_engine
CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE=selected_sources
CLUVVI_DISCOVERY_SOURCE_FAMILIES=developer
```

Project B exposes only bounded non-secret GitHub controls:

```text
CLUVVI_DISCOVERY_GITHUB_DEPTH=default
CLUVVI_DISCOVERY_MAX_GITHUB_QUERIES=4
CLUVVI_DISCOVERY_MAX_GITHUB_REPOSITORIES=8
CLUVVI_DISCOVERY_MAX_GITHUB_THREAD_DRILL=5
```

`hiring`, `community`, and `developer` may be selected independently or together.

Project A owns any optional GitHub token. Project B never forwards `DISCOVERY_GITHUB_TOKEN`, never accepts a token CLI argument, and never persists, fingerprints, logs, renders, screenshots, or serializes a token value. The Project B environment allowlist contains only non-secret GitHub policy/budget settings.

## Import validation

Project B recursively validates the full developer artifact family before downstream use. Validation includes:

- artifact kind and schema version;
- request-ID coherence;
- deterministic artifact IDs and content digests;
- companion artifact references;
- repository identity and public visibility;
- `github.com` public evidence URLs;
- run-relative path confinement for manifest-referenced thread/comment files;
- thread/comment manifest membership;
- no orphan repository, thread, comment, or signal references;
- bounded content sizes;
- deterministic signal independence counts;
- telemetry/artifact count reconciliation;
- `paidRequests = 0` and `paidCredits = 0`;
- recursive rejection of token, authorization, password, cookie, raw-header, private-repository, environment, email/contact-secret, access-token, and refresh-token shaped fields.

A validation failure is durable and reviewable. Project B never guesses missing fields or silently coerces a malformed GitHub artifact.

## Access and degraded-state semantics

Project B records the safe access category emitted by Project A:

- `anonymous` for keyless public GitHub REST evidence;
- `authenticated_free` only when Project A itself uses its optional configured token.

Authentication never expands Project B into private repository access. GitHub rate-limit exhaustion can produce a degraded but successful developer result when already-valid public evidence exists. Completed repository/thread/comment/signal evidence is preserved; missing coverage stays missing rather than being fabricated.

The UI exposes rate-limit events, access mode, private-resource rejection count, request totals, and paid-credit totals without exposing headers or credentials.

## Evidence integration

Developer evidence enters Evidence as bounded observed or derived public materials, including:

- public GitHub repository metadata;
- public issue or pull-request threads;
- selected public comments/reviews;
- published release metadata;
- deterministic developer signals.

All developer materials retain `untrusted_public_content` classification and exact repository/thread/comment/release/signal provenance.

Developer evidence may strengthen problem and implementation context only when it is conservatively attached to an already-known discovery entity. Developer source data never creates a buyer entity by itself.

## Identity boundary

GitHub usernames, display names, author associations, contributor labels, repository owners, and comment authors remain source attribution only.

Project B does not turn them into people, employees, decision makers, buyers, contacts, email addresses, or purchasing-authority evidence. `developerIdentityEvidence.userIdentityUsed` remains `false`.

A developer evidence link exists only when the selected developer query has an explicit primary entity that conservatively and uniquely matches an existing discovery candidate. Ambiguous or unmatched GitHub evidence is preserved as source evidence but contributes nothing to entity identity or ranking.

## Ranking boundary

Normal deterministic ranking components exclude `developer_signal` findings. Developer intelligence has a separate bounded contribution:

```text
maximum developer contribution = +1 point
maximumShareOfPositiveScore = 0.08
```

The point is applied only when a mission-relevant qualifying deterministic developer signal is sufficiently confident and spans at least two independent repositories. A single repository, duplicate route, weak signal, low relevance, ambiguous entity link, or unmatched entity contributes zero.

The existing hiring and community caps remain independent. GitHub activity, stars, forks, comments, releases, or developer volume do not automatically become demand, budget, authority, or purchase-intent points.

## Buyer Map provenance

Buyer Map preserves developer provenance for every included GitHub citation, including available repository ID/full name, thread ID, comment ID, release ID/tag, developer signal ID/type, query IDs/intents, relevance, confidence, and independence counts.

Buyer Map explicitly states that public GitHub evidence does not prove representative market demand, company or buyer identity, contact identity, budget, purchasing authority, or purchase intent.

## Browser and operations UI

The discovery operations page exposes:

- `developer` as an explicit public source family;
- quick/default/deep GitHub depth;
- maximum GitHub queries;
- maximum public repositories;
- maximum thread drill;
- developer signal-rule version;
- anonymous/default access boundary;
- no private repositories, cloning, mutations, asset downloads, or contact enrichment.

Run views expose selected public repositories, issue/PR context, retained comments/releases, deterministic signals, access mode, rate-limit events, paid usage, identity boundary, and the capped developer contribution. Desktop and 390px mobile layouts are covered by Visual QA with no horizontal overflow.

## Controlled verification

The focused C1-J.3 suite proves:

- full developer artifact-family import;
- public repository/thread/comment/release/signal downstream evidence;
- zero paid usage;
- no developer identity/contact use;
- +1 maximum developer contribution;
- single-repository evidence contributes zero;
- ambiguous/unlinked evidence contributes zero;
- rate-limited public GitHub preserves already-valid evidence without invention;
- missing/invalid sidecars fail at their exact eight-stage durable boundary;
- invalid developer signals can be repaired in place and resumed on the same run;
- forbidden private/secret fields are recursively rejected;
- C1-J.2 community regressions continue to pass.

Latest focused result on August 9, 2026: `developer-bridge.integration.test.ts` passed 22/22 after adding the exact-stage matrix. The combined developer/config/community regression run passed 51/51 before that matrix expansion.

## Browser and real cross-project proof

The production-browser C1-J.3 suite passed 6/6 on August 9, 2026 after rebuilding the current Next.js production bundle. Visual QA includes operations desktop/mobile, successful GitHub intelligence, rate-limited degraded state, same-run resume/reuse, Buyer Map developer provenance, and mobile developer cards.

The fresh env-gated real Project A → Project B proof pinned Project A at `b9002bff2f56ac20c8db696b3137bda336437b8b` and succeeded against public GitHub with:

```text
accessMode: anonymous
repositories: 1
threads: 3
comments: 3
releases: 0
signals: 7
rateLimitEvents: 0
privateRejected: 0
paidRequests: 0
paidCredits: 0
```

The search-result seed in that test is operator-reviewed only to isolate the GitHub source-adapter boundary. The GitHub repository/thread/comment retrieval is real public network I/O.

## Scope stop

C1-J.3 stops here. It does not start YouTube, arXiv, Techmeme, monitoring, cross-source fusion beyond the existing deterministic downstream pipeline, authenticated/private GitHub access in Project B, contact enrichment, or outreach.
