import { SearchResultsArtifactV2Schema } from "@cluvvi/core";
import projectAFixtureJson from "./fixtures/project-a-video-editing.search-results.v2.json";
import pipelineFixtureJson from "./fixtures/video-editing-pipeline.search-results.v2.json";

const projectAFixture = SearchResultsArtifactV2Schema.parse(projectAFixtureJson);
const pipelineFixture = SearchResultsArtifactV2Schema.parse(pipelineFixtureJson);

export function loadProjectACompatibilityFixture() {
  return structuredClone(projectAFixture);
}

export function loadProjectBPipelineFixture() {
  return structuredClone(pipelineFixture);
}
