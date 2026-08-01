import {
  C0_FIXTURE_WARNING,
  FixtureArtifactEnvelopeSchema,
  LocalMissionSchema,
  MissionUnderstandingArtifactV1Schema,
  RunPhaseSchema,
  type ArtifactType,
  type FixtureArtifactEnvelope,
  type LocalMission,
  type LocalRunPhase,
} from "@cluvvi/core";
import { createDownstreamFixtureStages } from "./downstream-stages";
import { generateMissionUnderstandingArtifactV1 } from "./mission-understanding";
import type { EngineStage, RuntimeSchema, StageContext } from "./stage";

interface MissionStageInput {
  mission: LocalMission;
}

const MissionStageInputSchema: RuntimeSchema<MissionStageInput> = {
  parse(value: unknown): MissionStageInput {
    if (value === null || typeof value !== "object" || !("mission" in value)) {
      throw new Error("Mission stage requires a mission input.");
    }
    return { mission: LocalMissionSchema.parse(value.mission) };
  },
};

const FixtureInputSchema: RuntimeSchema<FixtureArtifactEnvelope> = FixtureArtifactEnvelopeSchema;

function outputSchemaFor(
  stage: LocalRunPhase,
  dataSchema?: RuntimeSchema<Record<string, unknown>>,
): RuntimeSchema<FixtureArtifactEnvelope> {
  return {
    parse(value: unknown): FixtureArtifactEnvelope {
      const parsed = FixtureArtifactEnvelopeSchema.parse(value);
      if (parsed.stage !== stage) {
        throw new Error(`Fixture output stage must equal ${stage}.`);
      }
      return {
        ...parsed,
        data: dataSchema?.parse(parsed.data) ?? parsed.data,
      };
    },
  };
}

function envelope(
  context: StageContext,
  stage: LocalRunPhase,
  data: Record<string, unknown>,
): FixtureArtifactEnvelope {
  return FixtureArtifactEnvelopeSchema.parse({
    schemaVersion: "1.0",
    fixture: true,
    warning: C0_FIXTURE_WARNING,
    stage,
    runId: context.run.id,
    generatedAt: context.now(),
    data,
  });
}

function createFixtureStage(input: {
  name: LocalRunPhase;
  artifactType: ArtifactType;
  version?: string;
  previousArtifactType?: ArtifactType;
  outputDataSchema?: RuntimeSchema<Record<string, unknown>>;
  createData: (source: unknown, context: StageContext) => Record<string, unknown>;
}): EngineStage<unknown, unknown> {
  return {
    name: input.name,
    version: input.version ?? "1.0.0",
    schemaVersion: "1.0",
    artifactType: input.artifactType,
    inputSchema: input.name === "mission" ? MissionStageInputSchema : FixtureInputSchema,
    outputSchema: outputSchemaFor(input.name, input.outputDataSchema),
    async loadInput(context) {
      if (input.name === "mission") {
        return { mission: context.mission };
      }
      if (input.previousArtifactType === undefined) {
        throw new Error(`Stage ${input.name} has no declared input artifact.`);
      }
      const artifact = await context.getLatestArtifact(input.previousArtifactType);
      if (artifact === null) {
        throw new Error(
          `Stage ${input.name} requires missing artifact ${input.previousArtifactType}.`,
        );
      }
      return artifact.data;
    },
    async execute(source, context) {
      await context.recordFixtureToolCall({
        toolName: `fixture_${input.name}`,
        request: { stage: input.name, fixture: true },
        response: { status: "ok", fixture: true },
      });
      return envelope(context, input.name, input.createData(source, context));
    },
  };
}

export function createPlaceholderStages(): readonly EngineStage<unknown, unknown>[] {
  const stages: readonly EngineStage<unknown, unknown>[] = [
    createFixtureStage({
      name: "mission",
      artifactType: "mission",
      createData(source) {
        const parsed = MissionStageInputSchema.parse(source);
        return { mission: parsed.mission.input, sourceFile: parsed.mission.sourceFile };
      },
    }),
    createFixtureStage({
      name: "compilation",
      version: "1.1.0",
      artifactType: "mission_understanding",
      previousArtifactType: "mission",
      outputDataSchema: MissionUnderstandingArtifactV1Schema,
      createData(_source, context) {
        return generateMissionUnderstandingArtifactV1(context.mission.input);
      },
    }),
    createFixtureStage({
      name: "source_planning",
      version: "1.2.0",
      artifactType: "source_plan",
      previousArtifactType: "mission_understanding",
      createData(source) {
        const inputArtifact = FixtureArtifactEnvelopeSchema.parse(source);
        const understanding = MissionUnderstandingArtifactV1Schema.parse(inputArtifact.data);
        return {
          strategySummary:
            "Cluvvi generated a deterministic source and query plan. Project B consumes a separate version-controlled search_results.v2 fixture; no external query is executed.",
          generatedQueryCount: understanding.searchQueries.length,
          highPriorityQueryCount: understanding.searchQueries.filter(
            (query) => query.priority === "high",
          ).length,
          plannedSources: understanding.sourcePlan.map((entry) => ({
            sourceType: entry.sourceType,
            priority: entry.priority,
          })),
          searchStrategies: understanding.searchQueries.slice(0, 15),
          stopConditions: {
            candidateTarget: understanding.inputSummary.desiredOpportunities,
            candidateHardLimit: 9,
            executionEnabled: false,
            fixtureArtifactEnabled: true,
          },
        };
      },
    }),
    ...createDownstreamFixtureStages(),
  ];

  return stages.map((stage) => {
    RunPhaseSchema.parse(stage.name);
    return stage;
  });
}
