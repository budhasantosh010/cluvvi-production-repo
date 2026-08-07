# C1-J.1 Public Hiring and ATS Intelligence

C1-J.1 adds bounded public hiring evidence to the existing Cluvvi pipeline without turning job postings into proof of budget, expansion, replacement hiring, approved projects, purchase intent, buyer identity, or purchasing authority.

## Implemented public providers

Project A owns provider execution. Project B owns independent validation and downstream interpretation.

- Greenhouse public jobs — `keyless_free`
- Ashby public jobs — `keyless_free`
- Lever public jobs, global and EU — `keyless_free`
- Workable public jobs — `keyless_free`
- SmartRecruiters Posting API — optional `authenticated_free`; missing authentication is an honest non-fatal outcome
- JobPosting JSON-LD fallback
- conservative generic public careers-page fallback

No candidate, application, recruiter, employee, resume, cover-letter, private ATS, or login-gated data is collected.

## Targeting and board validation

Hiring targets are deterministic hypotheses derived from validated discovery evidence and cautious public hints. A public ATS URL is not accepted as company evidence by itself. Candidate boards must pass the relationship validator using strong public evidence such as official-site linkage, same registrable domain where applicable, JobPosting organization evidence, or observed board/company metadata. Weak slug matching remains weak.

## Normalized job evidence

Accepted public jobs preserve bounded provenance including target, board, provider, access category, company, title, role family, seniority, department, workplace type, locations, technology mentions, timestamps, public job URL, and bounded description-derived evidence. Duplicate identities and impossible/orphan references are rejected or reconciled deterministically.

## Hiring signals

Hiring signals are deterministic, cautious inferences from observed public jobs. They include explicit confidence and limitations. The signal layer never states that a company definitely has budget, is expanding, is replacing a worker, has approved a project, intends to purchase, or has a verified buyer.

## Evidence, identity, ranking, and Buyer Map

Project B converts public jobs and hiring signals into untrusted evidence materials with exact job/signal/provider provenance. Identity enrichment may link a company hypothesis conservatively but does not identify or enrich a person.

Hiring contributes at most **one point** to the deterministic opportunity score. More jobs or richer parsing cannot compound beyond that cap.

Buyer Map citations distinguish:

- public job postings
- derived hiring signals
- provider/access category
- target, board, and job IDs
- confidence and limitations

Buyer Map warnings explicitly state that hiring evidence does not prove budget or purchase intent.

## Resume behavior

The four hiring stages have an independent source-adapter configuration fingerprint. Invalid hiring artifacts can be repaired and resumed on the same run while prior discovery, extraction, and structured-content stages are reused when their fingerprints remain valid.

## Real cross-project proof

The release integration pins Project A and executes a real keyless Greenhouse request through Project A, then validates the four Project A sidecars with Project B's independent schemas before carrying jobs and hiring signals into Evidence, Ranking, and Buyer Map.

The final pinned Project A SHA is documented by the release test and release notes.

## Scope boundary

Not implemented: candidate/application ingestion, private ATS endpoints, recruiter or employee scraping, personal contact enrichment, outreach, monitoring, recursive crawling, browser automation, job application automation, applicant scoring, or hiring decisions.
