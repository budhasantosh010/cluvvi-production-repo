import type {
  ArtifactRecord,
  ArtifactType,
  LocalMission,
  LocalRun,
  LocalRunPhase,
  ToolCallRecord,
} from "@cluvvi/core";
import type { CluvviStore } from "@cluvvi/storage";

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export interface StageContext {
  readonly run: LocalRun;
  readonly mission: LocalMission;
  readonly store: CluvviStore;
  readonly now: () => string;
  getLatestArtifact(artifactType: ArtifactType): Promise<ArtifactRecord | null>;
  recordFixtureToolCall(input: {
    toolName: string;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  }): Promise<ToolCallRecord>;
}

export interface EngineStage<TInput, TOutput> {
  readonly name: LocalRunPhase;
  readonly version: string;
  readonly artifactType: ArtifactType;
  readonly inputSchema: RuntimeSchema<TInput>;
  readonly outputSchema: RuntimeSchema<TOutput>;
  loadInput(context: StageContext): Promise<unknown>;
  execute(input: TInput, context: StageContext): Promise<unknown>;
}

export class StageRegistry {
  readonly stages: readonly EngineStage<unknown, unknown>[];

  constructor(stages: readonly EngineStage<unknown, unknown>[]) {
    const names = stages.map((stage) => stage.name);
    if (new Set(names).size !== names.length) {
      throw new Error("Stage registry contains duplicate stage names.");
    }
    this.stages = stages;
  }
}
