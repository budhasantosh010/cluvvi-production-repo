#!/usr/bin/env node
import { parseArguments } from "./arguments";
import { doctorCommand } from "./commands/doctor";
import { evaluateCommand } from "./commands/evaluate";
import { initCommand } from "./commands/init";
import { inspectCommand } from "./commands/inspect";
import { resumeCommand } from "./commands/resume";
import { runCommand } from "./commands/run";
import { statusCommand } from "./commands/status";

function usage(): void {
  console.log(
    `Cluvvi Local Core Engine C0\n\nCommands:\n  pnpm cluvvi init\n  pnpm cluvvi run <mission.json>\n  pnpm cluvvi resume <run-id>\n  pnpm cluvvi status <run-id>\n  pnpm cluvvi inspect <run-id> [--stage <phase> | --errors]\n  pnpm cluvvi evaluate <run-id>\n  pnpm cluvvi doctor\n`,
  );
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  switch (arguments_.command) {
    case "init":
      await initCommand();
      break;
    case "run":
      await runCommand(arguments_);
      break;
    case "resume":
      await resumeCommand(arguments_);
      break;
    case "status":
      await statusCommand(arguments_);
      break;
    case "inspect":
      await inspectCommand(arguments_);
      break;
    case "evaluate":
      evaluateCommand();
      break;
    case "doctor":
      await doctorCommand();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      usage();
      break;
    default:
      usage();
      throw new Error(`Unknown command: ${arguments_.command}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error.";
  console.error(`\nCluvvi failed: ${message}`);
  process.exitCode = 1;
});
