import { z } from "zod";

export const RUN_STATUSES = [
  "draft",
  "compiling",
  "awaiting_interpretation_approval",
  "planning",
  "awaiting_plan_approval",
  "discovering",
  "normalizing",
  "investigating",
  "resolving_buyers",
  "enriching",
  "scoring",
  "reviewing",
  "completed",
  "paused",
  "cancelled",
  "budget_exhausted",
  "provider_blocked",
  "needs_user_input",
  "failed",
] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RUN_EVENT_TYPES = [
  "run_created",
  "compilation_started",
  "interpretation_generated",
  "interpretation_approved",
  "source_plan_generated",
  "source_plan_approved",
  "search_started",
  "search_completed",
  "candidate_created",
  "candidate_rejected",
  "investigation_started",
  "investigation_completed",
  "buyer_resolved",
  "contact_enriched",
  "opportunity_scored",
  "review_failed",
  "run_paused",
  "run_resumed",
  "budget_exhausted",
  "run_cancelled",
  "run_completed",
  "run_failed",
] as const;

export const RunEventTypeSchema = z.enum(RUN_EVENT_TYPES);
export type RunEventType = z.infer<typeof RunEventTypeSchema>;

const TERMINAL_RUN_STATUSES = new Set<RunStatus>(["cancelled", "completed", "failed"]);

const transitionEntries: ReadonlyArray<readonly [RunStatus, readonly RunStatus[]]> = [
  ["draft", ["compiling", "cancelled", "failed"]],
  ["compiling", ["awaiting_interpretation_approval", "needs_user_input", "failed", "cancelled"]],
  ["awaiting_interpretation_approval", ["planning", "cancelled", "failed"]],
  ["planning", ["awaiting_plan_approval", "needs_user_input", "failed", "cancelled"]],
  ["awaiting_plan_approval", ["discovering", "cancelled", "failed"]],
  [
    "discovering",
    ["normalizing", "paused", "budget_exhausted", "provider_blocked", "failed", "cancelled"],
  ],
  ["normalizing", ["investigating", "paused", "budget_exhausted", "failed", "cancelled"]],
  [
    "investigating",
    ["resolving_buyers", "paused", "budget_exhausted", "provider_blocked", "failed", "cancelled"],
  ],
  [
    "resolving_buyers",
    ["enriching", "paused", "budget_exhausted", "provider_blocked", "failed", "cancelled"],
  ],
  [
    "enriching",
    ["scoring", "paused", "budget_exhausted", "provider_blocked", "failed", "cancelled"],
  ],
  ["scoring", ["reviewing", "failed", "cancelled"]],
  ["reviewing", ["completed", "needs_user_input", "failed", "cancelled"]],
  [
    "paused",
    [
      "discovering",
      "normalizing",
      "investigating",
      "resolving_buyers",
      "enriching",
      "cancelled",
      "failed",
    ],
  ],
  [
    "budget_exhausted",
    ["discovering", "normalizing", "investigating", "resolving_buyers", "enriching", "cancelled"],
  ],
  [
    "provider_blocked",
    ["discovering", "investigating", "resolving_buyers", "enriching", "cancelled", "failed"],
  ],
  ["needs_user_input", ["compiling", "planning", "reviewing", "cancelled", "failed"]],
];

export const RUN_TRANSITIONS: ReadonlyMap<RunStatus, ReadonlySet<RunStatus>> = new Map(
  transitionEntries.map(([from, to]) => [from, new Set(to)]),
);

export class InvalidRunTransitionError extends Error {
  readonly current: RunStatus;
  readonly next: RunStatus;

  constructor(current: RunStatus, next: RunStatus) {
    super(`Invalid run transition: ${current} -> ${next}`);
    this.name = "InvalidRunTransitionError";
    this.current = current;
    this.next = next;
  }
}

export function canTransitionRun(current: RunStatus, next: RunStatus): boolean {
  if (current === next || TERMINAL_RUN_STATUSES.has(current)) {
    return false;
  }

  return RUN_TRANSITIONS.get(current)?.has(next) ?? false;
}

export function assertRunTransition(current: RunStatus, next: RunStatus): void {
  if (!canTransitionRun(current, next)) {
    throw new InvalidRunTransitionError(current, next);
  }
}
