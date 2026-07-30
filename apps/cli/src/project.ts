import { existsSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";

export interface LocalProjectPaths {
  root: string;
  stateDirectory: string;
  databasePath: string;
  runsDirectory: string;
}

function hasProjectMarkers(directory: string): boolean {
  return (
    existsSync(resolve(directory, "pnpm-workspace.yaml")) &&
    existsSync(resolve(directory, "package.json"))
  );
}

export function findProjectRoot(startDirectory = process.cwd()): string {
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
  throw new Error("Cluvvi project root was not found. Run this command inside the repository.");
}

export function localProjectPaths(root = findProjectRoot()): LocalProjectPaths {
  const stateDirectory = resolve(root, ".cluvvi");
  return {
    root,
    stateDirectory,
    databasePath: resolve(stateDirectory, "cluvvi.sqlite"),
    runsDirectory: resolve(stateDirectory, "runs"),
  };
}
