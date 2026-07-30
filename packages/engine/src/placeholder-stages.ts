import {
  C0_FIXTURE_WARNING,
  FixtureArtifactEnvelopeSchema,
  LocalMissionSchema,
  RunPhaseSchema,
  type ArtifactType,
  type FixtureArtifactEnvelope,
  type LocalMission,
  type LocalRunPhase,
} from "@cluvvi/core";
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

function outputSchemaFor(stage: LocalRunPhase): RuntimeSchema<FixtureArtifactEnvelope> {
  return {
    parse(value: unknown): FixtureArtifactEnvelope {
      const parsed = FixtureArtifactEnvelopeSchema.parse(value);
      if (parsed.stage !== stage) {
        throw new Error(`Fixture output stage must equal ${stage}.`);
      }
      return parsed;
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
  previousArtifactType?: ArtifactType;
  createData: (source: unknown, context: StageContext) => Record<string, unknown>;
}): EngineStage<unknown, unknown> {
  return {
    name: input.name,
    version: "1.0.0",
    artifactType: input.artifactType,
    inputSchema: input.name === "mission" ? MissionStageInputSchema : FixtureInputSchema,
    outputSchema: outputSchemaFor(input.name),
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
      artifactType: "interpretation",
      previousArtifactType: "mission",
      createData(_source, context) {
        return {
          offer: {
            summary: context.mission.input.description,
            customerOutcome: context.mission.input.customerOutcome ?? "Not supplied",
            provenance: "user_provided",
          },
          gtmMotion: { type: "fixture_unclassified", confidence: 0 },
          segments: [],
          assumptions: ["C0 does not call a model."],
          ambiguities: ["Commercial interpretation is deferred to C2."],
        };
      },
    }),
    createFixtureStage({
      name: "source_planning",
      artifactType: "source_plan",
      previousArtifactType: "interpretation",
      createData() {
        return {
          strategySummary: "No external sources are executed in C0.",
          searchStrategies: [],
          stopConditions: { candidateTarget: 0, candidateHardLimit: 0 },
        };
      },
    }),
    createFixtureStage({
      name: "discovery",
      artifactType: "search_results",
      previousArtifactType: "source_plan",
      createData() {
        return { searchCalls: 0, results: [] };
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
          nextPhase: "C1 website ingestion",
        };
      },
    }),
  ].map((stage) => {
    RunPhaseSchema.parse(stage.name);
    return stage;
  });
}
