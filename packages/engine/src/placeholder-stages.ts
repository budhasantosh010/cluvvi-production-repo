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
  return [
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
      version: "1.1.0",
      artifactType: "source_plan",
      previousArtifactType: "mission_understanding",
      createData(source) {
        const inputArtifact = FixtureArtifactEnvelopeSchema.parse(source);
        const understanding = MissionUnderstandingArtifactV1Schema.parse(inputArtifact.data);
        return {
          strategySummary:
            "Cluvvi generated a deterministic source and query plan. Search queries are not executed in C1-A.",
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
            candidateHardLimit: 0,
            executionEnabled: false,
          },
        };
      },
    }),
    createFixtureStage({
      name: "discovery",
      artifactType: "search_results",
      previousArtifactType: "source_plan",
      createData() {
        return {
          searchCalls: 0,
          results: [],
          note: "Queries were generated but not executed in C1-A.",
        };
      },
    }),
    createFixtureStage({
      name: "normalization",
      artifactType: "candidates",
      previousArtifactType: "search_results",
      createData() {
        return { candidates: [], duplicatesRemoved: 0 };
      },
    }),
    createFixtureStage({
      name: "investigation",
      artifactType: "investigations",
      previousArtifactType: "candidates",
      createData() {
        return { investigations: [], facts: [], inferences: [] };
      },
    }),
    createFixtureStage({
      name: "buyer_identification",
      artifactType: "buyers",
      previousArtifactType: "investigations",
      createData() {
        return { buyers: [] };
      },
    }),
    createFixtureStage({
      name: "enrichment",
      artifactType: "contacts",
      previousArtifactType: "buyers",
      createData() {
        return { contacts: [], publicFallbackOnly: true };
      },
    }),
    createFixtureStage({
      name: "ranking",
      artifactType: "opportunities",
      previousArtifactType: "contacts",
      createData() {
        return { opportunities: [], scoringVersion: "fixture-c0" };
      },
    }),
    createFixtureStage({
      name: "review",
      artifactType: "review",
      previousArtifactType: "opportunities",
      createData() {
        return {
          passed: [],
          failed: [],
          warnings: ["Fixture output cannot be evaluated as a real lead list."],
        };
      },
    }),
    createFixtureStage({
      name: "finalization",
      artifactType: "finalization",
      previousArtifactType: "review",
      createData(_source, context) {
        return {
          outcome: "fixture_run_completed",
          desiredOpportunities: context.mission.input.desiredOpportunities,
          realOpportunitiesProduced: 0,
          nextPhase: "C1-B approved-source query execution",
        };
      },
    }),
  ].map((stage) => {
    RunPhaseSchema.parse(stage.name);
    return stage;
  });
}
