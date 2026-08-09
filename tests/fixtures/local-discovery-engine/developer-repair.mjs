import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
function artifactId(value) {
  return `artifact_${createHash("sha256")
    .update(`${value.requestId}\n${value.artifactKind}\n${canonicalJson(value)}`)
    .digest("hex")}`;
}
function withId(value) {
  return { ...value, artifactId: artifactId(value) };
}

export async function repairControlledDeveloperSignals(signalsPath, telemetryPath) {
  const currentSignals = JSON.parse(await readFile(signalsPath, "utf8"));
  const signalsWithoutId = { ...currentSignals };
  delete signalsWithoutId.artifactId;
  const repairedSignals = withId({
    ...signalsWithoutId,
    rulesVersion: "c1-j3.developer-signals.v1",
  });
  await writeFile(signalsPath, `${JSON.stringify(repairedSignals, null, 2)}\n`, "utf8");

  const currentTelemetry = JSON.parse(await readFile(telemetryPath, "utf8"));
  const telemetryWithoutId = { ...currentTelemetry };
  delete telemetryWithoutId.artifactId;
  const repairedTelemetry = withId({
    ...telemetryWithoutId,
    developerSignalsArtifactId: repairedSignals.artifactId,
  });
  await writeFile(telemetryPath, `${JSON.stringify(repairedTelemetry, null, 2)}\n`, "utf8");
}
