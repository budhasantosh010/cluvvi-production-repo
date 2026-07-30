import {
  findCluvviProjectRoot,
  resolveLocalCluvviPaths,
  type LocalCluvviPaths,
} from "@cluvvi/storage";

export interface LocalProjectPaths {
  root: string;
  stateDirectory: string;
  databasePath: string;
  runsDirectory: string;
}

export function findProjectRoot(startDirectory = process.cwd()): string {
  return findCluvviProjectRoot(startDirectory);
}

export function localProjectPaths(root = findProjectRoot()): LocalProjectPaths {
  const paths: LocalCluvviPaths = resolveLocalCluvviPaths({ startDirectory: root });
  return {
    root: paths.projectRoot,
    stateDirectory: paths.cluvviDirectory,
    databasePath: paths.databasePath,
    runsDirectory: paths.runsDirectory,
  };
}
