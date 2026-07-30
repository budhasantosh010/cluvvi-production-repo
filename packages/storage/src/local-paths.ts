import { existsSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";

export interface LocalCluvviPaths {
  projectRoot: string;
  cluvviDirectory: string;
  databasePath: string;
  runsDirectory: string;
  visualQaDirectory: string;
}

function hasProjectMarkers(directory: string): boolean {
  return (
    existsSync(resolve(directory, "pnpm-workspace.yaml")) &&
    existsSync(resolve(directory, "package.json"))
  );
}

export function findCluvviProjectRoot(startDirectory = process.cwd()): string {
  let current = resolve(startDirectory);
  const filesystemRoot = parse(current).root;

  while (current !== filesystemRoot) {
    if (hasProjectMarkers(current)) {
      return current;
    }
    current = dirname(current);
  }

  if (hasProjectMarkers(filesystemRoot)) {
    return filesystemRoot;
  }
  throw new Error(
    "Cluvvi project root was not found. Run inside the repository or set CLUVVI_HOME.",
  );
}

export function resolveLocalCluvviPaths(
  input: {
    startDirectory?: string;
    environment?: NodeJS.ProcessEnv;
  } = {},
): LocalCluvviPaths {
  const environment = input.environment ?? process.env;
  const projectRoot = findCluvviProjectRoot(input.startDirectory);
  const configuredHome = environment["CLUVVI_HOME"]?.trim();
  const cluvviDirectory =
    configuredHome === undefined || configuredHome.length === 0
      ? resolve(projectRoot, ".cluvvi")
      : resolve(configuredHome);

  return {
    projectRoot,
    cluvviDirectory,
    databasePath: resolve(cluvviDirectory, "cluvvi.sqlite"),
    runsDirectory: resolve(cluvviDirectory, "runs"),
    visualQaDirectory: resolve(projectRoot, "visual_qa"),
  };
}
