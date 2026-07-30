export interface ParsedArguments {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string | true>;
}

export function parseArguments(argv: readonly string[]): ParsedArguments {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === undefined) {
      continue;
    }
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { command, positionals, flags };
}

export function stringFlag(arguments_: ParsedArguments, name: string): string | undefined {
  const value = arguments_.flags.get(name);
  return typeof value === "string" ? value : undefined;
}
