# Discovery Provider Research Template

## Purpose

Use this template before selecting any free, paid, manual, or fixture discovery provider. Do not integrate a provider based on marketing claims, memory, popularity, or a single successful request.

## Research table

| Provider name | Provider URL | Category: free / paid / manual / fixture | Source types supported | Platforms covered | API available? yes/no | Requires login? yes/no | Pricing | Free tier limits | Rate limits | Terms/platform risk | Data freshness | Result quality expectation | Can return URL? | Can return snippet? | Can return date? | Can return author/company? | Implementation difficulty: 1–5 | MVP usefulness: 1–5 | Long-term usefulness: 1–5 | Notes | Decision: use now / use later / reject / unknown |
| ------------- | ------------ | ---------------------------------------- | ---------------------- | ----------------- | --------------------- | ---------------------- | ------- | ---------------- | ----------- | ------------------- | -------------- | -------------------------- | --------------- | ------------------- | ---------------- | -------------------------- | ------------------------------ | ------------------- | ------------------------- | ----- | ------------------------------------------------ |
|               |              |                                          |                        |                   |                       |                        |         |                  |             |                     |                |                            |                 |                     |                  |                            |                                |                     |                           |       |                                                  |

Add one row per provider or manual workflow. Preserve links to official documentation, pricing, terms, and representative sample outputs in the Notes field or a companion research document.

## Provider scoring model

Normalize every factor to a 1–5 score.

```text
Provider Score =
  MVP usefulness × 0.30
+ result quality × 0.25
+ implementation ease × 0.20
+ low risk × 0.15
+ long-term usefulness × 0.10
```

For implementation ease, convert difficulty into an ease score:

```text
implementation ease = 6 - implementation difficulty
```

Example: difficulty 2 becomes ease 4.

## Risk scoring

| Risk score | Meaning                                        |
| ---------- | ---------------------------------------------- |
| 5          | Official/stable API, low risk                  |
| 4          | Public API or public search endpoint, low risk |
| 3          | Unclear but common usage; verify carefully     |
| 2          | Scraping-sensitive; use carefully              |
| 1          | High risk; avoid for now                       |

Risk scoring must consider terms, platform rules, authentication requirements, rate limits, personal-data exposure, login walls, and the likelihood of account or legal problems.

## Decision rules

### Use now

Choose **use now** only when:

- the score is high;
- legal and platform risk are low;
- integration is straightforward;
- the source is useful for customer discovery;
- output can map cleanly into `search_results.v1`;
- pricing and rate limits fit the current MVP.

### Use later

Choose **use later** when:

- the source is useful but paid;
- integration is complex;
- an API key, contract, or commercial review is required;
- it is not necessary for the first MVP;
- free providers should prove the workflow first.

### Reject

Choose **reject** when the provider or method involves:

- login bypass;
- high platform risk;
- unreliable or unverifiable data;
- unacceptable terms;
- poor discovery results;
- no stable URLs or provenance;
- output that cannot be normalized safely.

### Unknown

Choose **unknown** when deeper research, sample calls, legal review, pricing confirmation, or output-quality evaluation is still required.

## Research procedure

For each candidate:

1. Read official API documentation.
2. Read current pricing and free-tier limits.
3. Read terms, acceptable-use rules, and platform restrictions.
4. Confirm authentication requirements.
5. Confirm supported source types and freshness.
6. Inspect representative result payloads.
7. Confirm URLs, snippets, dates, and author/company fields.
8. Test normalization into `search_results.v1` using saved sample payloads.
9. Estimate implementation difficulty and operational maintenance.
10. Score the provider and record the decision.

## Known candidate providers to research later

These are research placeholders only. They are not approved, integrated, or claimed to be reliable.

### Free / low-cost

- Hacker News / Algolia
- Reddit public/search options
- Google/Bing search API options
- Job board search options
- Company website fetch/parsing
- Product Hunt discovery options
- Review-site discovery options

### Paid

- SocialCrawl
- Firecrawl
- Tavily
- SerpAPI
- Apify
- People/company enrichment providers
- Job data providers
- Review/social-listening providers

### Manual

- LinkedIn manual research
- Google manual review
- Company website manual review

## Warning

> Do not assume a provider is allowed or reliable until its documentation, pricing, terms, and output quality are checked.

No candidate provider in this document is an implementation decision.
