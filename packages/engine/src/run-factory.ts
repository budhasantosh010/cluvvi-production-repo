import {
  DEFAULT_RUN_BUDGET,
  EMPTY_RUN_USAGE,
  LocalMissionSchema,
  LocalRunEventSchema,
  LocalRunSchema,
  createOpaqueId,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalMission,
  type LocalRun,
  type LocalRunEvent,
  type MissionInputV1,
  type RunBudget,
} from "@cluvvi/core";
import { LOCAL_ENGINE_VERSION } from "./version";

export interface RunCreationRecords {
  mission: LocalMission;
  run: LocalRun;
  event: LocalRunEvent;
}

export function createRunCreationRecords(input: {
  mission: MissionInputV1;
  sourceFile: string;
  now?: string;
  budget?: RunBudget;
  discoveryRuntimeMode?: DiscoveryRuntimeMode;
  discoveryProviderMode?: DiscoveryProviderMode;
  discoveryProviderPolicy?: DiscoveryProviderPolicy;
}): RunCreationRecords {
  const now = input.now ?? new Date().toISOString();
  const mission = LocalMissionSchema.parse({
    id: createOpaqueId("mission"),
    input: input.mission,
    sourceFile: input.sourceFile,
    createdAt: now,
  });
  const run = LocalRunSchema.parse({
    id: createOpaqueId("run"),
    missionId: mission.id,
    missionName: mission.input.name,
    status: "created",
    phase: "mission",
    config: {
      engineVersion: LOCAL_ENGINE_VERSION,
      fixtureMode: true,
      discoveryRuntimeMode: input.discoveryRuntimeMode ?? "fixture",
      discoveryProviderMode: input.discoveryProviderMode ?? "fixture_only",
      discoveryProviderPolicy: input.discoveryProviderPolicy ?? "free_only",
    },
    budget: input.budget ?? DEFAULT_RUN_BUDGET,
    usage: EMPTY_RUN_USAGE,
    startedAt: now,
    updatedAt: now,
  });
  const event = LocalRunEventSchema.parse({
    id: createOpaqueId("event"),
    runId: run.id,
    eventType: "run_created",
    phase: run.phase,
    data: {
      sourceFile: input.sourceFile,
      discoveryRuntimeMode: run.config.discoveryRuntimeMode,
      discoveryProviderMode: run.config.discoveryProviderMode,
      discoveryProviderPolicy: run.config.discoveryProviderPolicy,
    },
    createdAt: now,
  });
  return { mission, run, event };
}
