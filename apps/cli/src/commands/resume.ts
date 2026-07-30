import type { ParsedArguments } from "../arguments";
import { printEvent } from "../output";
import { createLocalRuntime } from "../runtime";

export async function resumeCommand(arguments_: ParsedArguments): Promise<void> {
  const runId = arguments_.positionals[0];
  if (runId === undefined) {
    throw new Error("Usage: pnpm cluvvi resume <run-id>");
  }
  const { store, engine } = createLocalRuntime({ emit: printEvent });
  try {
    const result = await engine.resume(runId);
    console.log(`\nRun ${result.run.id}: ${result.run.status}`);
  } finally {
    await store.close();
  }
}
