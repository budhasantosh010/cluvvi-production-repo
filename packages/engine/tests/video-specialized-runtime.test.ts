import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CLUVVI_SPECIALIZED_SIGNAL_RULE_VERSION,
  CLUVVI_VIDEO_SIGNAL_RULE_VERSION,
  allowedDiscoveryProviderEnvironment,
  parseDiscoveryRuntimeConfig,
} from "../src/discovery-runtime-config";
import { discoveryExchangePaths } from "../src/discovery-exchange";

const cleanupDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fakeProject(): Promise<string> {
  const path = resolve(process.cwd(), ".cluvvi-test", `j45-config-${randomUUID()}`);
  cleanupDirectories.push(path);
  await mkdir(path, { recursive: true });
  await writeFile(resolve(path, "package.json"), "{}\n", "utf8");
  return path;
}

describe("C1-J.4/J.5 runtime bridge configuration", () => {
  it("parses all five source families, exposes explicit video/specialized rules, and forwards only safe Project A settings", async () => {
    const projectPath = await fakeProject();
    const config = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
      CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring,community,developer,video,specialized",
      CLUVVI_DISCOVERY_YOUTUBE_DEPTH: "deep",
      DISCOVERY_YOUTUBE_ENABLED: "true",
      DISCOVERY_YOUTUBE_MAX_QUERIES: "3",
      DISCOVERY_YOUTUBE_TRANSCRIPT_DRILL_DEEP: "6",
      DISCOVERY_YOUTUBE_CONTENT_SAFETY_FILTER: "true",
      DISCOVERY_SPECIALIZED_ENABLED: "true",
      DISCOVERY_SPECIALIZED_MODE: "auto",
      DISCOVERY_SPECIALIZED_DYNAMIC_DISCOVERY: "true",
      DISCOVERY_SPECIALIZED_MAX_SELECTED_SOURCES: "7",
      DISCOVERY_SPECIALIZED_ARXIV_ENABLED: "true",
      DISCOVERY_SPECIALIZED_TECHMEME_ENABLED: "true",
      DISCOVERY_SPECIALIZED_DIGG_ENABLED: "false",
      DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH: "C:\\operator\\registry.json",
      DISCOVERY_YOUTUBE_COOKIES_FROM_BROWSER: "must-not-forward",
      DISCOVERY_YOUTUBE_COOKIE_FILE: "must-not-forward",
      DISCOVERY_SPECIALIZED_API_KEY: "must-not-forward",
      DISCOVERY_GITHUB_TOKEN: "must-not-forward",
    });

    expect(config).toMatchObject({
      sourceFamilies: ["hiring", "community", "developer", "video", "specialized"],
      youtubeDepth: "deep",
      videoSignalRuleVersion: CLUVVI_VIDEO_SIGNAL_RULE_VERSION,
      specializedSignalRuleVersion: CLUVVI_SPECIALIZED_SIGNAL_RULE_VERSION,
      local: {
        sourceFamilies: ["hiring", "community", "developer", "video", "specialized"],
        youtubeDepth: "deep",
        videoSignalRuleVersion: CLUVVI_VIDEO_SIGNAL_RULE_VERSION,
        specializedSignalRuleVersion: CLUVVI_SPECIALIZED_SIGNAL_RULE_VERSION,
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).toMatchObject({
      DISCOVERY_YOUTUBE_ENABLED: "true",
      DISCOVERY_YOUTUBE_MAX_QUERIES: "3",
      DISCOVERY_YOUTUBE_TRANSCRIPT_DRILL_DEEP: "6",
      DISCOVERY_YOUTUBE_CONTENT_SAFETY_FILTER: "true",
      DISCOVERY_SPECIALIZED_ENABLED: "true",
      DISCOVERY_SPECIALIZED_MODE: "auto",
      DISCOVERY_SPECIALIZED_DYNAMIC_DISCOVERY: "true",
      DISCOVERY_SPECIALIZED_MAX_SELECTED_SOURCES: "7",
      DISCOVERY_SPECIALIZED_ARXIV_ENABLED: "true",
      DISCOVERY_SPECIALIZED_TECHMEME_ENABLED: "true",
      DISCOVERY_SPECIALIZED_DIGG_ENABLED: "false",
    });
    expect(config.local.providerEnvironment).not.toHaveProperty(
      "DISCOVERY_YOUTUBE_COOKIES_FROM_BROWSER",
    );
    expect(config.local.providerEnvironment).not.toHaveProperty("DISCOVERY_YOUTUBE_COOKIE_FILE");
    expect(config.local.providerEnvironment).not.toHaveProperty("DISCOVERY_SPECIALIZED_API_KEY");
    expect(config.local.providerEnvironment).not.toHaveProperty(
      "DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH",
    );
    expect(config.local.providerEnvironment).not.toHaveProperty("DISCOVERY_GITHUB_TOKEN");
  });

  it("keeps the J.4/J.5 sidecars and atomic child collections in one confined run exchange", () => {
    const paths = discoveryExchangePaths("C:\\cluvvi-runs", "run_test");
    expect(paths.videoSourcePlanPath).toMatch(/video-source-plan\.v1\.json$/u);
    expect(paths.videoCollectionPath).toMatch(/video-collection\.v1\.json$/u);
    expect(paths.transcriptManifestPath).toMatch(/transcript-manifest\.v1\.json$/u);
    expect(paths.videoCommentManifestPath).toMatch(/video-comment-manifest\.v1\.json$/u);
    expect(paths.videoSignalsPath).toMatch(/video-signals\.v1\.json$/u);
    expect(paths.videoSourceTelemetryPath).toMatch(/video-source-run-telemetry\.v1\.json$/u);
    expect(paths.videoTranscriptsDirectory).toMatch(/[\\/]video[\\/]transcripts$/u);
    expect(paths.videoCommentsDirectory).toMatch(/[\\/]video[\\/]comments$/u);
    expect(paths.specializedSourceContextPath).toMatch(/specialized-source-context\.v1\.json$/u);
    expect(paths.specializedSourceCandidatesPath).toMatch(
      /specialized-source-candidates\.v1\.json$/u,
    );
    expect(paths.specializedSourcePlanPath).toMatch(/specialized-source-plan\.v1\.json$/u);
    expect(paths.specializedFindingsPath).toMatch(/specialized-findings\.v1\.json$/u);
    expect(paths.specializedSignalsPath).toMatch(/specialized-signals\.v1\.json$/u);
    expect(paths.specializedSourceTelemetryPath).toMatch(
      /specialized-source-run-telemetry\.v1\.json$/u,
    );
  });

  it("does not add cookies, auth secrets, or unknown specialized credentials to the provider environment allowlist", () => {
    expect(
      allowedDiscoveryProviderEnvironment({
        DISCOVERY_YOUTUBE_ENABLED: "true",
        DISCOVERY_YOUTUBE_COOKIE_FILE: "secret",
        DISCOVERY_YOUTUBE_COOKIES_FROM_BROWSER: "secret",
        DISCOVERY_SPECIALIZED_ENABLED: "true",
        DISCOVERY_SPECIALIZED_API_KEY: "secret",
        DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH: "C:\\operator\\registry.json",
      }),
    ).toEqual({
      DISCOVERY_YOUTUBE_ENABLED: "true",
      DISCOVERY_SPECIALIZED_ENABLED: "true",
    });
  });
});
