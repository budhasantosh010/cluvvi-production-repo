import type {
  ArtifactRecord,
  ArtifactType,
  DiscoveryRuntimeMode,
  LocalMission,
  LocalRun,
  LocalRunEvent,
  LocalRunPhase,
  MissionInputV1,
  RunRequest,
  RunnerHeartbeat,
} from "@cluvvi/core";

export type PresentedStageStatus =
  "pending" | "running" | "completed" | "failed" | "reused" | "skipped";

export interface RunStageView {
  name: LocalRunPhase;
  status: PresentedStageStatus;
  attempt?: number;
  startedAt?: string;
  completedAt?: string;
  failureCode?: string;
}

export interface RunView {
  run: LocalRun;
  mission: LocalMission;
  stages: RunStageView[];
  events: LocalRunEvent[];
  artifacts: ArtifactRecord[];
  requests: RunRequest[];
  fixture: true;
}

export interface CreateRunResult {
  view: RunView;
  request: RunRequest;
  created: boolean;
}

export interface CapabilityReport {
  mode: "fixture";
  discoveryRuntimeMode: DiscoveryRuntimeMode;
  capabilities: {
    localEngine: true;
    missionCompiler: false;
    webSearch: false;
    webFetch: false;
    enrichment: false;
    youtube: false;
    outreach: false;
  };
  warnings: string[];
}

export interface LocalDiagnostics {
  projectRoot: string;
  databasePath: string;
  runsDirectory: string;
  databaseInstanceId: string;
  migrationVersion: string | null;
  engineVersion: string;
  mode: "fixture";
  discoveryRuntimeMode: DiscoveryRuntimeMode;
  runner: {
    available: boolean;
    heartbeat: RunnerHeartbeat | null;
  };
}

export interface CluvviApplicationService {
  createRun(input: MissionInputV1, idempotencyKey: string): Promise<CreateRunResult>;
  getRun(runId: string): Promise<RunView | null>;
  listRuns(input?: { limit?: number; status?: LocalRun["status"] }): Promise<LocalRun[]>;
  getRunEvents(runId: string, input?: { afterTimestamp?: string }): Promise<LocalRunEvent[]>;
  getRunArtifact(runId: string, artifactType: ArtifactType): Promise<ArtifactRecord | null>;
  requestResume(runId: string): Promise<RunRequest>;
  requestCancel(runId: string): Promise<RunRequest>;
  getCapabilities(): Promise<CapabilityReport>;
  getDiagnostics(): Promise<LocalDiagnostics>;
}
