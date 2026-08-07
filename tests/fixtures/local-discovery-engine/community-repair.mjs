import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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

function artifactId(requestId, kind, data) {
  return `artifact_${createHash("sha256")
    .update(`${requestId}\n${kind}\n${canonicalJson(data)}`)
    .digest("hex")}`;
}

function withId(value) {
  return { ...value, artifactId: artifactId(value.requestId, value.artifactKind, value) };
}

export async function repairControlledCommunitySignals(signalsPath, telemetryPath) {
  const exchangeDirectory = dirname(signalsPath);
  const threadManifest = JSON.parse(
    await readFile(resolve(exchangeDirectory, "thread-manifest.v1.json"), "utf8"),
  );
  const validThreadIds = threadManifest.threadArtifacts.map((entry) => entry.threadArtifactId);
  if (validThreadIds.length < 2) {
    throw new Error("Controlled repair requires at least two persisted thread artifacts.");
  }

  const currentSignals = JSON.parse(await readFile(signalsPath, "utf8"));
  const repairedSignals = currentSignals.signals
    .filter((signal) => signal.signalId !== "community_signal_invalid_orphan")
    .map((signal) => ({
      ...signal,
      supportingThreadArtifactIds: validThreadIds.slice(0, 2),
      independentThreadCount: 2,
    }));
  const signalsWithoutId = { ...currentSignals };
  delete signalsWithoutId.artifactId;
  const repairedSignalsArtifact = withId({
    ...signalsWithoutId,
    signals: repairedSignals,
    summary: {
      ...currentSignals.summary,
      painSignals: repairedSignals.filter((signal) => signal.type === "pain").length,
      independentThreadCount: validThreadIds.length,
    },
  });
  await writeFile(signalsPath, `${JSON.stringify(repairedSignalsArtifact, null, 2)}\n`, "utf8");

  const currentTelemetry = JSON.parse(await readFile(telemetryPath, "utf8"));
  const telemetryWithoutId = { ...currentTelemetry };
  delete telemetryWithoutId.artifactId;
  const repairedTelemetry = withId({
    ...telemetryWithoutId,
    communitySignalsArtifactId: repairedSignalsArtifact.artifactId,
    totals: { ...currentTelemetry.totals, signalsGenerated: repairedSignals.length },
  });
  await writeFile(telemetryPath, `${JSON.stringify(repairedTelemetry, null, 2)}\n`, "utf8");
}
