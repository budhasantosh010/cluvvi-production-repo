import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [requestPath, outputFlag, outputPath] = process.argv.slice(2);
if (!requestPath || outputFlag !== "--output" || !outputPath) {
  console.error("Usage: pnpm discover <request.json> --output <artifact.json>");
  process.exit(2);
}

const behavior = JSON.parse(await readFile(resolve("behavior.json"), "utf8"));
if (behavior.mode === "nonzero") {
  console.error("Controlled local Discovery Engine failure.");
  process.exit(7);
}
if (behavior.mode === "invalid-json") {
  await writeFile(outputPath, "{invalid-json", "utf8");
  process.exit(0);
}
if (behavior.mode === "timeout") {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120_000));
}

const request = JSON.parse(await readFile(requestPath, "utf8"));
const templatePath = resolve(
  process.cwd(),
  "../../../packages/engine/src/fixtures/video-editing-pipeline.search-results.v2.json",
);
const template = JSON.parse(await readFile(templatePath, "utf8"));
const artifact = { ...template, requestId: request.requestId };
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote fixture search_results.v2 for ${request.requestId}.`);
