# Standalone Discovery Engine Plan

## Frozen decision

Discovery Engine will be developed later as a separate standalone project inside:

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine
```

It must remain reusable infrastructure, not Cluvvi-specific business logic.

## Generic job

```text
queries + source types + budget mode
→ route to providers
→ collect results
→ normalize
→ dedupe
→ return search_results.v1
```

The standalone engine should not know whether a result is a buyer. It discovers raw public, social, company, job, review, and web signals. Cluvvi decides later whether those signals represent buyer intent, active pain, timing, ability to pay, or a worthwhile opportunity.

## Why it is separate

- Discovery is reusable infrastructure that can serve Cluvvi and future products.
- Provider churn should not force changes inside Cluvvi's intelligence layer.
- Provider-specific rate limits, retries, credentials, and normalization belong outside the product domain.
- A standalone boundary makes free, paid, manual, and fixture providers replaceable.
- Cluvvi should consume one stable artifact rather than know every provider contract.

## Target standalone folder structure

```text
Separate Discovery engine/
├─ package.json
├─ src/
│  ├─ contracts/
│  │  ├─ discovery-query.ts
│  │  └─ search-results.ts
│  ├─ providers/
│  │  ├─ provider.ts
│  │  ├─ registry.ts
│  │  ├─ fixture/
│  │  │  └─ fixture-provider.ts
│  │  ├─ free/
│  │  │  ├─ hacker-news-provider.ts
│  │  │  ├─ search-web-provider.ts
│  │  │  ├─ reddit-provider.ts
│  │  │  ├─ job-post-provider.ts
│  │  │  ├─ company-website-provider.ts
│  │  │  ├─ reviews-provider.ts
│  │  │  └─ product-hunt-provider.ts
│  │  ├─ paid/
│  │  │  ├─ socialcrawl-provider-stub.ts
│  │  │  ├─ firecrawl-provider-stub.ts
│  │  │  ├─ tavily-provider-stub.ts
│  │  │  ├─ serpapi-provider-stub.ts
│  │  │  └─ apify-provider-stub.ts
│  │  └─ manual/
│  │     └─ linkedin-manual-provider.ts
│  ├─ dedupe/
│  │  ├─ normalize-url.ts
│  │  └─ dedupe-results.ts
│  ├─ runner/
│  │  └─ discovery-runner.ts
│  └─ cli/
│     └─ index.ts
├─ examples/
│  ├─ video-editing-queries.json
│  └─ sales-gtm-queries.json
├─ tests/
└─ README.md
```

This is a target architecture, not implemented code.

## Provider categories

### Free

- `hacker_news`
- `search_web`
- `reddit_public_or_search_web`
- `job_posts_search`
- `company_website_fetch`
- `reviews_search`
- `product_hunt_search`

### Paid

- `socialcrawl`
- `firecrawl`
- `tavily`
- `serpapi`
- `apify`
- `people_data_provider`
- `job_data_provider`
- `review_data_provider`

### Manual

- `linkedin_manual`
- `manual_google_search`
- `manual_company_lookup`

### Fixture

- `fixture_search_provider`

The names above are categories or candidate adapters, not claims that a provider is approved, legal for every use, reliable, available, or selected.

## Discovery modes

### `free_only`

Use only free or low-cost providers. If a required source is unavailable, record a warning rather than silently using a paid provider.

### `balanced`

Use free providers first. Use paid providers only when configured, explicitly enabled, and within budget.

### `paid_deep`

Use paid providers aggressively for premium reports, while preserving limits, provenance, provider breakdowns, and credit usage.

## Provider interface responsibilities

Every provider adapter should:

- declare a stable provider ID and provider category;
- declare supported source types;
- validate configuration before execution;
- accept normalized discovery queries;
- enforce timeouts, retries, rate limits, and budgets;
- return provider-neutral normalized results;
- preserve optional raw payloads only for debugging or later adapters;
- emit structured errors and warnings;
- never leak provider-specific assumptions into downstream Cluvvi contracts.

## Normalization and dedupe

The standalone engine should normalize before returning results:

- canonicalize URLs where safe;
- remove tracking parameters when deterministic and non-destructive;
- normalize domains and whitespace;
- preserve original title and snippet meaning;
- dedupe exact canonical URLs;
- optionally dedupe near-identical provider results using deterministic rules;
- retain query and provider provenance;
- count raw and deduped results separately.

## Boundary rules

- No LinkedIn scraping.
- No login-wall bypassing.
- No automated messaging.
- No email sending.
- No contact enrichment until the Identity + Enrichment phase.
- Paid providers are optional adapters, not the core product.
- Providers are replaceable pipes.
- Cluvvi's intelligence layer is the moat.
- Discovery does not score payment intent.
- Discovery does not decide whether a result is a customer.
- Discovery does not identify decision-makers.
- Discovery does not rank final opportunities.

## First standalone milestone

The first milestone is architecture and contract scaffolding only:

```text
contracts
→ provider registry
→ fixture provider
→ deterministic normalization
→ deterministic dedupe
→ CLI
→ tests
→ search_results.v1 output
```

No live provider belongs in the first scaffold milestone.

## Integration with Cluvvi

Cluvvi should integrate through a file, service, or future API boundary that returns `search_results.v1`. Cluvvi must never import standalone provider implementations directly.

```text
Cluvvi Source Planner
→ versioned discovery request
→ standalone Discovery Engine
→ search_results.v1
→ Cluvvi Evidence Engine
```

The exact transport is intentionally not frozen yet. The artifact contract is frozen first.
