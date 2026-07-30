# Cluvvi C0 Architecture

```text
apps/cli
  ↓ public APIs only
packages/engine
  ↓ CluvviStore contract
packages/storage
  ↓
Node 24 `node:sqlite`
  ↓
.cluvvi/cluvvi.sqlite

packages/engine
  ↓
LocalArtifactWriter
  ↓ atomic mirror files
.cluvvi/runs/<run-id>/
```

## Meaningful boundaries

### Core

Versioned mission/run/artifact schemas, opaque IDs, structured errors, stable JSON, and fingerprints.

### Storage

Owns `CluvviStore`, migrations, transactions, row mapping, WAL configuration, and the only SQLite-specific import.

### Engine

Owns deterministic orchestration, stage registry, budget checks, fixture stages, idempotent reuse, failures, and artifact writing.

### CLI

Owns project-root discovery, argument parsing, human-readable commands, and exit behavior. It never reaches into SQLite directly.

## Parked Phase 0

The Next.js app, worker, Supabase database adapter, migrations, RLS policies, and queue remain available for a later hosted product. They are not imported by the active C0 execution path.

## Durability rule

A stage is considered complete only after its validated artifact file exists and one SQLite transaction records the artifact, completed execution, run update, and completion event.
