import type { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteTransaction } from "./transactions";

function defaultMigrationDirectories(): string[] {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  return [
    resolve(moduleDirectory, "../../migrations"),
    resolve(moduleDirectory, "../migrations"),
    resolve(process.cwd(), "packages/storage/migrations"),
  ];
}

export function resolveMigrationsDirectory(explicitDirectory?: string): string {
  const candidates =
    explicitDirectory === undefined ? defaultMigrationDirectories() : [explicitDirectory];
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (selected === undefined) {
    throw new Error(`SQLite migrations directory was not found. Checked: ${candidates.join(", ")}`);
  }
  return selected;
}

export function applySqliteMigrations(
  database: DatabaseSync,
  explicitDirectory?: string,
): string[] {
  const migrationsDirectory = resolveMigrationsDirectory(explicitDirectory);
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const files = readdirSync(migrationsDirectory)
    .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));
  const applied: string[] = [];

  for (const fileName of files) {
    const id = fileName.slice(0, fileName.indexOf("_"));
    const existing = database.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(id) as
      { id: string } | undefined;
    if (existing !== undefined) {
      continue;
    }

    const sql = readFileSync(resolve(migrationsDirectory, fileName), "utf8");
    sqliteTransaction(database, () => {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations(id, name, applied_at) VALUES (?, ?, ?)")
        .run(id, fileName, new Date().toISOString());
    });
    applied.push(fileName);
  }

  return applied;
}
