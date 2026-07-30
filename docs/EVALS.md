# Evaluation system

Evaluation is mandatory because fluent output is not proof of buyer quality.

## V0 quality targets

- Precision@20: at least 70%; stretch 80%.
- Evidence coverage: 100%.
- Unsupported factual claims: below 2%.
- Duplicate rate: below 3%.
- Buyer correctness: at least 80%.
- Initial usable verified contactability: at least 50%.

## Gold dataset

Create 100 manually labeled examples: 25 excellent, 25 reasonable, 25 weak, and 25 clearly unsuitable. Keep 70 for development/calibration and 30 as a holdout set.

## Phase 0 engineering evaluation

Before model work begins, verify:

- run creation is atomic;
- duplicate queue delivery is harmless;
- invalid state transitions are rejected;
- cross-workspace access is denied;
- missing capabilities fail clearly;
- worker restarts do not lose queued work;
- secrets do not appear in browser bundles or health output;
- local and CI commands produce reproducible results.
