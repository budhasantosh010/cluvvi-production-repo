# C1-J.2 Reddit Keyless Community Intelligence — Project B

## Status

Implemented on `feature/c1-j2-reddit-community-intelligence` as the Project B consumer of Project A's published C1-J.2 community artifact family.

Project A remains a separate executable repository. Project B does not import Project A source code or create a package dependency on it. The bridge remains a versioned JSON/process boundary.

## Runtime shape

```text
Mission + source plan
        ↓
search_results.v2
        ↓
optional C1-I / C1-I.5 / C1-J.1 stages
        ↓
community_planning
  → community_source_plan.v1
        ↓
community_retrieval
  → thread_manifest.v1
        ↓
community_thread_context
  → community_thread_context.v1 + validated thread.v1 files
        ↓
community_comment_retrieval
  → comment_collection_manifest.v1
        ↓
community_comment_context
  → community_comment_context.v1 + validated comment_collection.v1 files
        ↓
community_analysis
  → community_signals.v1
        ↓
community_source_telemetry
  → community_source_run_telemetry.v1
        ↓
Evidence → Identity → Ranking → Buyer Map
```

All seven community stages are independently durable and resumable. If a later community artifact is invalid, previously valid discovery, extraction, structured parsing, hiring, and earlier community stages remain reusable on the same run when their fingerprints still match.

## Validation boundary

Project B independently validates:

- exact artifact kind and schema version;
- request-ID agreement;
- deterministic artifact IDs and content digests;
- thread/comment manifest membership;
- run-relative path confinement;
- Reddit/public-source URL restrictions;
- orphan thread/comment/signal references;
- cross-artifact companion IDs;
- summary and telemetry reconciliation;
- zero paid requests and credits for the keyless Reddit family;
- forbidden secret/request material such as authorization, cookies, OAuth tokens, raw HTML, request/response headers, API keys, passwords, and complete environments.

Manifest paths cannot traverse outside their approved per-run thread/comment directories.

## Evidence and identity rules

Reddit thread, comment, and derived signal material is always classified as `untrusted_public_content`.

Community material attaches downstream only when the selected community query names a primary entity that conservatively and uniquely matches an already-known discovery candidate. There is no arbitrary first-result fallback. Ambiguous or unmatched community material remains unqualified and contributes nothing downstream.

Public Reddit author names and handles are source metadata only. They are never converted into:

- company identity;
- buyer identity;
- contact records;
- email/phone guesses;
- verified-person claims.

`communityIdentityEvidence.userIdentityUsed` is permanently `false`.

## Engagement semantics

Engagement is represented as an observation, not a permanent property:

- RSS-only evidence: `unknown`;
- live public Shreddit observation: `live`;
- Arctic Shift observation: `archived`, with stale-possible metadata.

Missing engagement never becomes zero engagement.

## Ranking boundary

Normal pain, recency, workaround, identity, route, exclusion, and stale-evidence ranking components ignore community findings.

Community has one separate capped contribution:

```text
maximum community points = 1
maximumShareOfPositiveScore = 0.08
```

The one point is permitted only for a qualifying deterministic community signal with:

- an allowed pain/friction/switching/competitor-dissatisfaction type;
- mission relevance at least 0.70;
- signal confidence at least 0.70;
- at least two independent supporting threads;
- a conservative unique link to an existing discovery entity.

Single posts, single comments, weak signals, ambiguous entity links, and duplicate-route observations contribute zero.

## Security and Reddit boundary

C1-J.2 does not add:

- Reddit OAuth;
- Reddit login;
- cookies;
- paid Reddit API access;
- challenge/interstitial bypass;
- browser automation intended to defeat Reddit access controls;
- private/community-member-only access.

When Reddit challenges or rate-limits the public keyless routes, Project A records the bounded failure/degradation. Project B never fabricates missing community evidence.

## Verification

Controlled Project B verification covers:

- complete artifact-family import;
- exact durable failure stage attribution;
- malformed JSON and strict-contract rejection;
- digest/path/orphan/security failures;
- RSS-only unknown engagement;
- Arctic archived/stale engagement;
- partial and unavailable routes;
- prompt-injection content remaining inert public data;
- ambiguous entity links producing zero downstream effect;
- single-thread evidence producing zero community ranking points;
- repeated qualifying evidence producing exactly one capped point;
- same-run invalid-signal repair and resume with earlier stages reused;
- reuse across discovery/extraction/structured/hiring/community boundaries;
- Buyer Map provenance and UI presentation;
- absence of Reddit usernames/handles from identity/contact outputs.

Published Project A C1-J.2 live verification previously succeeded with 7 real Reddit threads, 3 deterministic signals, zero paid usage, and zero authenticated Reddit usage. A fresh Project A → Project B proof attempted during this Project B release was blocked by current Reddit anti-abuse state with `REDDIT_ALL_KEYLESS_ROUTES_FAILED` after bounded retries. No bypass was attempted; this remains an external live-availability limitation rather than a contract or Project B validation failure.
