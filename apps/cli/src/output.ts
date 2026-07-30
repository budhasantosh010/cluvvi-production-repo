import type { LocalRunEvent } from "@cluvvi/core";

export function printEvent(event: LocalRunEvent): void {
  const labels: Partial<Record<LocalRunEvent["eventType"], string>> = {
    run_created: "Run created",
    run_started: "Run started",
    run_resumed: "Run resumed",
    stage_started: `Starting ${event.phase}`,
    stage_reused: `Reusing ${event.phase}`,
    stage_completed: `Completed ${event.phase}`,
    stage_failed: `Failed ${event.phase}`,
    run_completed: "Run completed",
  };
  console.log(labels[event.eventType] ?? event.eventType);
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
