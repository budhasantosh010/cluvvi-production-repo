import {
  CommentCollectionArtifactV1Schema,
  ThreadArtifactV1Schema,
  type CommentCollectionArtifactV1,
  type ThreadArtifactV1,
} from "../community/universal-community";
import {
  DeveloperCommentCollectionManifestArtifactV1Schema,
  DeveloperCommentMetadataArtifactV1Schema,
  DeveloperRepositoryCollectionArtifactV1Schema,
  DeveloperSignalsArtifactV1Schema,
  DeveloperSourcePlanArtifactV1Schema,
  DeveloperSourceRunTelemetryArtifactV1Schema,
  DeveloperThreadManifestArtifactV1Schema,
  DeveloperThreadMetadataArtifactV1Schema,
  type DeveloperCommentCollectionManifestArtifactV1,
  type DeveloperCommentMetadataArtifactV1,
  type DeveloperRepositoryCollectionArtifactV1,
  type DeveloperSignalsArtifactV1,
  type DeveloperSourcePlanArtifactV1,
  type DeveloperSourceRunTelemetryArtifactV1,
  type DeveloperThreadManifestArtifactV1,
  type DeveloperThreadMetadataArtifactV1,
} from "./developer-artifacts";
import {
  deterministicDeveloperCommentManifestId,
  deterministicDeveloperCommentMetadataId,
  deterministicDeveloperRepositoryCollectionId,
  deterministicDeveloperSignalsId,
  deterministicDeveloperSourcePlanId,
  deterministicDeveloperTelemetryId,
  deterministicDeveloperThreadManifestId,
  deterministicDeveloperThreadMetadataId,
  developerCommentCollectionArtifactDigest,
  developerThreadArtifactDigest,
} from "./identity";

const FORBIDDEN_FIELD =
  /(?:^|_)(?:authorization|token|password|privateRepository|rawResponseHeaders|cookie|environment|emailAddress|commitEmail|accessToken|refreshToken)(?:$|_)/iu;

export class DeveloperArtifactValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeveloperArtifactValidationError";
  }
}

function fail(code: string, message: string): never {
  throw new DeveloperArtifactValidationError(code, message);
}

function scanForbidden(value: unknown, path = "artifact"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, `${path}[${String(index)}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELD.test(key)) {
      fail("DEVELOPER_PRIVATE_DATA_REJECTED", `Forbidden imported field at ${path}.${key}.`);
    }
    scanForbidden(nested, `${path}.${key}`);
  }
}

function withoutArtifactId<T extends { artifactId: string }>(value: T): Omit<T, "artifactId"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "artifactId")) as Omit<
    T,
    "artifactId"
  >;
}

function parseArtifact<T>(schema: { parse(value: unknown): T }, value: unknown, code: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof DeveloperArtifactValidationError) throw error;
    fail(code, error instanceof Error ? error.message : "Developer artifact validation failed.");
  }
}

function githubUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.toLowerCase() === "github.com" ||
        url.hostname.toLowerCase() === "www.github.com")
    );
  } catch {
    return false;
  }
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function validFullName(value: string): boolean {
  const match = /^([^\s/?#\\.][^\s/?#\\]*)\/([^\s/?#\\.][^\s/?#\\]*)$/u.exec(value);
  return (
    match !== null && !value.split("/").some((part) => part === ".." || hasControlCharacters(part))
  );
}

function assertRequestId(expectedRequestId: string, artifacts: Array<{ requestId: string }>): void {
  if (artifacts.some((artifact) => artifact.requestId !== expectedRequestId)) {
    fail("DEVELOPER_REQUEST_MISMATCH", "All developer artifacts must belong to the same request.");
  }
}

export interface ValidatedDeveloperPlanSet {
  plan: DeveloperSourcePlanArtifactV1;
}

export interface ValidatedDeveloperRepositorySet extends ValidatedDeveloperPlanSet {
  repositoryCollection: DeveloperRepositoryCollectionArtifactV1;
}

export interface ValidatedDeveloperThreadManifestSet extends ValidatedDeveloperRepositorySet {
  threadManifest: DeveloperThreadManifestArtifactV1;
  threads: ThreadArtifactV1[];
}

export interface ValidatedDeveloperThreadSet extends ValidatedDeveloperThreadManifestSet {
  threadMetadata: DeveloperThreadMetadataArtifactV1;
}

export interface ValidatedDeveloperCommentManifestSet extends ValidatedDeveloperThreadSet {
  commentManifest: DeveloperCommentCollectionManifestArtifactV1;
  commentCollections: CommentCollectionArtifactV1[];
}

export interface ValidatedDeveloperCommentSet extends ValidatedDeveloperCommentManifestSet {
  commentMetadata: DeveloperCommentMetadataArtifactV1;
}

export interface ValidatedDeveloperAnalysisSet extends ValidatedDeveloperCommentSet {
  signals: DeveloperSignalsArtifactV1;
}

export interface ValidatedDeveloperArtifactSet extends ValidatedDeveloperAnalysisSet {
  telemetry: DeveloperSourceRunTelemetryArtifactV1;
}

export function validateDeveloperPlanArtifact(
  input: unknown,
  expectedRequestId?: string,
): ValidatedDeveloperPlanSet {
  scanForbidden(input);
  const plan = parseArtifact(
    DeveloperSourcePlanArtifactV1Schema,
    input,
    "DEVELOPER_SOURCE_PLAN_INVALID",
  );
  if (expectedRequestId !== undefined && plan.requestId !== expectedRequestId) {
    fail(
      "DEVELOPER_REQUEST_MISMATCH",
      "The developer source plan does not belong to the current discovery request.",
    );
  }
  if (plan.artifactId !== deterministicDeveloperSourcePlanId(withoutArtifactId(plan))) {
    fail("DEVELOPER_SOURCE_PLAN_INVALID", "Deterministic developer plan ID mismatch.");
  }
  return { plan };
}

export function validateDeveloperRepositorySet(input: {
  plan: unknown;
  repositoryCollection: unknown;
  expectedRequestId?: string;
}): ValidatedDeveloperRepositorySet {
  scanForbidden(input);
  const { plan } = validateDeveloperPlanArtifact(input.plan, input.expectedRequestId);
  const repositoryCollection = parseArtifact(
    DeveloperRepositoryCollectionArtifactV1Schema,
    input.repositoryCollection,
    "DEVELOPER_REPOSITORY_COLLECTION_INVALID",
  );
  assertRequestId(plan.requestId, [repositoryCollection]);
  if (
    repositoryCollection.artifactId !==
    deterministicDeveloperRepositoryCollectionId(withoutArtifactId(repositoryCollection))
  ) {
    fail(
      "DEVELOPER_REPOSITORY_COLLECTION_INVALID",
      "Deterministic repository collection ID mismatch.",
    );
  }
  if (repositoryCollection.developerSourcePlanArtifactId !== plan.artifactId) {
    fail(
      "DEVELOPER_REPOSITORY_COLLECTION_INVALID",
      "Repository collection references the wrong developer plan.",
    );
  }
  for (const repo of repositoryCollection.repositories) {
    if (
      !validFullName(repo.fullName) ||
      repo.fullName.toLowerCase() !== `${repo.owner}/${repo.name}`.toLowerCase()
    ) {
      fail("DEVELOPER_REPOSITORY_COLLECTION_INVALID", "Repository identity is invalid.");
    }
    if (!githubUrl(repo.url)) {
      fail(
        "DEVELOPER_REPOSITORY_COLLECTION_INVALID",
        "Repository URL must be a public github.com URL.",
      );
    }
    for (const release of repo.releases) {
      if (!githubUrl(release.url)) {
        fail(
          "DEVELOPER_REPOSITORY_COLLECTION_INVALID",
          "Release URL must be a public github.com URL.",
        );
      }
    }
  }
  return { plan, repositoryCollection };
}

export function validateDeveloperThreadManifestSet(input: {
  repositorySet: ValidatedDeveloperRepositorySet;
  threadManifest: unknown;
  threads: unknown[];
}): ValidatedDeveloperThreadManifestSet {
  scanForbidden({ threadManifest: input.threadManifest, threads: input.threads });
  const threadManifest = parseArtifact(
    DeveloperThreadManifestArtifactV1Schema,
    input.threadManifest,
    "DEVELOPER_THREAD_MANIFEST_INVALID",
  );
  const threads = input.threads.map((item) =>
    parseArtifact(ThreadArtifactV1Schema, item, "DEVELOPER_THREAD_INVALID"),
  );
  assertRequestId(input.repositorySet.plan.requestId, [threadManifest, ...threads]);
  if (
    threadManifest.artifactId !==
    deterministicDeveloperThreadManifestId(withoutArtifactId(threadManifest))
  ) {
    fail(
      "DEVELOPER_THREAD_MANIFEST_INVALID",
      "Deterministic developer thread manifest ID mismatch.",
    );
  }
  const threadsById = new Map(threads.map((thread) => [thread.artifactId, thread]));
  if (
    threadsById.size !== threads.length ||
    threadManifest.threadArtifacts.length !== threads.length
  ) {
    fail(
      "DEVELOPER_THREAD_MANIFEST_INVALID",
      "Developer thread manifest and loaded thread set differ.",
    );
  }
  for (const entry of threadManifest.threadArtifacts) {
    const thread = threadsById.get(entry.threadArtifactId);
    if (thread === undefined) {
      fail(
        "DEVELOPER_THREAD_MANIFEST_INVALID",
        "Developer thread manifest references a missing thread.",
      );
    }
    if (developerThreadArtifactDigest(thread) !== entry.contentDigest) {
      fail("DEVELOPER_THREAD_MANIFEST_INVALID", "Developer thread manifest digest mismatch.");
    }
    if (!githubUrl(thread.url)) {
      fail("DEVELOPER_THREAD_INVALID", "Developer thread URL must be a public github.com URL.");
    }
    if (thread.body !== undefined && thread.body.length > 50_000) {
      fail("DEVELOPER_THREAD_INVALID", "Developer thread body exceeds the GitHub body limit.");
    }
  }
  return { ...input.repositorySet, threadManifest, threads };
}

export function validateDeveloperThreadMetadataSet(input: {
  threadSet: ValidatedDeveloperThreadManifestSet;
  threadMetadata: unknown;
}): ValidatedDeveloperThreadSet {
  scanForbidden(input.threadMetadata);
  const threadMetadata = parseArtifact(
    DeveloperThreadMetadataArtifactV1Schema,
    input.threadMetadata,
    "DEVELOPER_THREAD_METADATA_INVALID",
  );
  assertRequestId(input.threadSet.plan.requestId, [threadMetadata]);
  if (
    threadMetadata.artifactId !==
    deterministicDeveloperThreadMetadataId(withoutArtifactId(threadMetadata))
  ) {
    fail(
      "DEVELOPER_THREAD_METADATA_INVALID",
      "Deterministic developer thread metadata ID mismatch.",
    );
  }
  if (
    threadMetadata.developerSourcePlanArtifactId !== input.threadSet.plan.artifactId ||
    threadMetadata.repositoryCollectionArtifactId !==
      input.threadSet.repositoryCollection.artifactId ||
    threadMetadata.threadManifestArtifactId !== input.threadSet.threadManifest.artifactId
  ) {
    fail(
      "DEVELOPER_THREAD_METADATA_INVALID",
      "Developer thread metadata references the wrong companion artifact.",
    );
  }
  const repositoryIds = new Set(
    input.threadSet.repositoryCollection.repositories.map((repository) => repository.repositoryId),
  );
  const threadIds = new Set(input.threadSet.threads.map((thread) => thread.artifactId));
  const metadataThreadIds = new Set<string>();
  for (const metadata of threadMetadata.threads) {
    if (!threadIds.has(metadata.threadArtifactId) || !repositoryIds.has(metadata.repositoryId)) {
      fail(
        "DEVELOPER_THREAD_METADATA_INVALID",
        "Developer thread metadata contains an orphan reference.",
      );
    }
    if (metadataThreadIds.has(metadata.threadArtifactId)) {
      fail(
        "DEVELOPER_THREAD_METADATA_INVALID",
        "Every developer thread may have only one metadata record.",
      );
    }
    metadataThreadIds.add(metadata.threadArtifactId);
  }
  if (metadataThreadIds.size !== input.threadSet.threads.length) {
    fail("DEVELOPER_THREAD_METADATA_INVALID", "Every developer thread must have metadata.");
  }
  return { ...input.threadSet, threadMetadata };
}

export function validateDeveloperCommentManifestSet(input: {
  threadSet: ValidatedDeveloperThreadSet;
  commentManifest: unknown;
  commentCollections: unknown[];
}): ValidatedDeveloperCommentManifestSet {
  scanForbidden({
    commentManifest: input.commentManifest,
    commentCollections: input.commentCollections,
  });
  const commentManifest = parseArtifact(
    DeveloperCommentCollectionManifestArtifactV1Schema,
    input.commentManifest,
    "DEVELOPER_COMMENT_MANIFEST_INVALID",
  );
  const commentCollections = input.commentCollections.map((item) =>
    parseArtifact(CommentCollectionArtifactV1Schema, item, "DEVELOPER_COMMENT_INVALID"),
  );
  assertRequestId(input.threadSet.plan.requestId, [commentManifest, ...commentCollections]);
  if (
    commentManifest.artifactId !==
    deterministicDeveloperCommentManifestId(withoutArtifactId(commentManifest))
  ) {
    fail(
      "DEVELOPER_COMMENT_MANIFEST_INVALID",
      "Deterministic developer comment manifest ID mismatch.",
    );
  }
  if (commentManifest.threadManifestArtifactId !== input.threadSet.threadManifest.artifactId) {
    fail(
      "DEVELOPER_COMMENT_MANIFEST_INVALID",
      "Developer comment manifest references the wrong thread manifest.",
    );
  }
  const threadIds = new Set(input.threadSet.threads.map((thread) => thread.artifactId));
  const collectionsById = new Map(
    commentCollections.map((collection) => [collection.artifactId, collection]),
  );
  if (
    collectionsById.size !== commentCollections.length ||
    commentManifest.collections.length !== commentCollections.length
  ) {
    fail(
      "DEVELOPER_COMMENT_MANIFEST_INVALID",
      "Developer comment manifest and loaded collection set differ.",
    );
  }
  const allCommentIds = new Set<string>();
  let totalComments = 0;
  const collectionThreadIds = new Set<string>();
  for (const entry of commentManifest.collections) {
    const collection = collectionsById.get(entry.commentCollectionArtifactId);
    if (
      collection === undefined ||
      collection.threadArtifactId !== entry.threadArtifactId ||
      !threadIds.has(entry.threadArtifactId)
    ) {
      fail(
        "DEVELOPER_COMMENT_MANIFEST_INVALID",
        "Developer comment manifest contains an orphan or mismatched collection.",
      );
    }
    if (collectionThreadIds.has(entry.threadArtifactId)) {
      fail(
        "DEVELOPER_COMMENT_MANIFEST_INVALID",
        "Only one developer comment collection is allowed per thread.",
      );
    }
    collectionThreadIds.add(entry.threadArtifactId);
    if (developerCommentCollectionArtifactDigest(collection) !== entry.contentDigest) {
      fail("DEVELOPER_COMMENT_MANIFEST_INVALID", "Developer comment manifest digest mismatch.");
    }
    for (const comment of collection.comments) {
      if (comment.body.length > 10_000) {
        fail(
          "DEVELOPER_COMMENT_INVALID",
          "Developer comment body exceeds the configured contract maximum.",
        );
      }
      if (allCommentIds.has(comment.commentId)) {
        fail(
          "DEVELOPER_COMMENT_INVALID",
          "Developer comment IDs must be unique across collections.",
        );
      }
      allCommentIds.add(comment.commentId);
      totalComments += 1;
    }
  }
  if (commentManifest.summary.totalComments !== totalComments) {
    fail("DEVELOPER_COMMENT_MANIFEST_INVALID", "Developer comment totals do not reconcile.");
  }
  return { ...input.threadSet, commentManifest, commentCollections };
}

export function validateDeveloperCommentMetadataSet(input: {
  commentSet: ValidatedDeveloperCommentManifestSet;
  commentMetadata: unknown;
}): ValidatedDeveloperCommentSet {
  scanForbidden(input.commentMetadata);
  const commentMetadata = parseArtifact(
    DeveloperCommentMetadataArtifactV1Schema,
    input.commentMetadata,
    "DEVELOPER_COMMENT_METADATA_INVALID",
  );
  assertRequestId(input.commentSet.plan.requestId, [commentMetadata]);
  if (
    commentMetadata.artifactId !==
    deterministicDeveloperCommentMetadataId(withoutArtifactId(commentMetadata))
  ) {
    fail(
      "DEVELOPER_COMMENT_METADATA_INVALID",
      "Deterministic developer comment metadata ID mismatch.",
    );
  }
  if (
    commentMetadata.commentCollectionManifestArtifactId !==
    input.commentSet.commentManifest.artifactId
  ) {
    fail(
      "DEVELOPER_COMMENT_METADATA_INVALID",
      "Developer comment metadata references the wrong manifest.",
    );
  }
  const threadIds = new Set(input.commentSet.threads.map((thread) => thread.artifactId));
  const allCommentIds = new Set(
    input.commentSet.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  const metadataCommentIds = new Set<string>();
  for (const metadata of commentMetadata.comments) {
    if (!threadIds.has(metadata.threadArtifactId) || !allCommentIds.has(metadata.commentId)) {
      fail(
        "DEVELOPER_COMMENT_METADATA_INVALID",
        "Developer comment metadata contains an orphan reference.",
      );
    }
    if (metadata.permalink !== undefined && !githubUrl(metadata.permalink)) {
      fail(
        "DEVELOPER_COMMENT_METADATA_INVALID",
        "Developer comment permalink must be a public github.com URL.",
      );
    }
    if (metadataCommentIds.has(metadata.commentId)) {
      fail("DEVELOPER_COMMENT_METADATA_INVALID", "Developer comment metadata IDs must be unique.");
    }
    metadataCommentIds.add(metadata.commentId);
  }
  if (metadataCommentIds.size !== allCommentIds.size) {
    fail("DEVELOPER_COMMENT_METADATA_INVALID", "Every developer comment must have metadata.");
  }
  return { ...input.commentSet, commentMetadata };
}

export function validateDeveloperAnalysisSet(input: {
  commentSet: ValidatedDeveloperCommentSet;
  signals: unknown;
}): ValidatedDeveloperAnalysisSet {
  scanForbidden(input.signals);
  const signals = parseArtifact(
    DeveloperSignalsArtifactV1Schema,
    input.signals,
    "DEVELOPER_SIGNALS_INVALID",
  );
  assertRequestId(input.commentSet.plan.requestId, [signals]);
  if (signals.artifactId !== deterministicDeveloperSignalsId(withoutArtifactId(signals))) {
    fail("DEVELOPER_SIGNALS_INVALID", "Deterministic developer signals ID mismatch.");
  }
  if (
    signals.developerSourcePlanArtifactId !== input.commentSet.plan.artifactId ||
    signals.repositoryCollectionArtifactId !== input.commentSet.repositoryCollection.artifactId ||
    signals.threadManifestArtifactId !== input.commentSet.threadManifest.artifactId ||
    signals.commentCollectionManifestArtifactId !== input.commentSet.commentManifest.artifactId
  ) {
    fail("DEVELOPER_SIGNALS_INVALID", "Developer signals reference the wrong companion artifacts.");
  }
  const repositoryIds = new Set(
    input.commentSet.repositoryCollection.repositories.map((repository) => repository.repositoryId),
  );
  const threadIds = new Set(input.commentSet.threads.map((thread) => thread.artifactId));
  const commentIds = new Set(
    input.commentSet.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  for (const signal of signals.signals) {
    for (const repositoryId of signal.repositoryIds) {
      if (!repositoryIds.has(repositoryId)) {
        fail("DEVELOPER_SIGNALS_INVALID", "Developer signal references an orphan repository.");
      }
    }
    for (const threadId of signal.supportingThreadArtifactIds) {
      if (!threadIds.has(threadId)) {
        fail("DEVELOPER_SIGNALS_INVALID", "Developer signal references an orphan thread.");
      }
    }
    for (const commentId of signal.supportingCommentIds) {
      if (!commentIds.has(commentId)) {
        fail("DEVELOPER_SIGNALS_INVALID", "Developer signal references an orphan comment.");
      }
    }
  }
  return { ...input.commentSet, signals };
}

export function validateDeveloperArtifactSet(input: {
  plan: unknown;
  repositoryCollection: unknown;
  threadManifest: unknown;
  threadMetadata: unknown;
  threads: unknown[];
  commentManifest: unknown;
  commentMetadata: unknown;
  commentCollections: unknown[];
  signals: unknown;
  telemetry: unknown;
  expectedRequestId?: string;
}): ValidatedDeveloperArtifactSet {
  scanForbidden(input);
  const repositorySet = validateDeveloperRepositorySet({
    plan: input.plan,
    repositoryCollection: input.repositoryCollection,
    ...(input.expectedRequestId === undefined
      ? {}
      : { expectedRequestId: input.expectedRequestId }),
  });
  const threadManifestSet = validateDeveloperThreadManifestSet({
    repositorySet,
    threadManifest: input.threadManifest,
    threads: input.threads,
  });
  const threadSet = validateDeveloperThreadMetadataSet({
    threadSet: threadManifestSet,
    threadMetadata: input.threadMetadata,
  });
  const commentManifestSet = validateDeveloperCommentManifestSet({
    threadSet,
    commentManifest: input.commentManifest,
    commentCollections: input.commentCollections,
  });
  const commentSet = validateDeveloperCommentMetadataSet({
    commentSet: commentManifestSet,
    commentMetadata: input.commentMetadata,
  });
  const analysisSet = validateDeveloperAnalysisSet({ commentSet, signals: input.signals });
  const telemetry = parseArtifact(
    DeveloperSourceRunTelemetryArtifactV1Schema,
    input.telemetry,
    "DEVELOPER_SOURCE_TELEMETRY_INVALID",
  );
  assertRequestId(analysisSet.plan.requestId, [telemetry]);
  if (telemetry.artifactId !== deterministicDeveloperTelemetryId(withoutArtifactId(telemetry))) {
    fail("DEVELOPER_SOURCE_TELEMETRY_INVALID", "Deterministic developer telemetry ID mismatch.");
  }
  if (
    telemetry.developerSourcePlanArtifactId !== analysisSet.plan.artifactId ||
    telemetry.repositoryCollectionArtifactId !== analysisSet.repositoryCollection.artifactId ||
    telemetry.threadManifestArtifactId !== analysisSet.threadManifest.artifactId ||
    telemetry.commentCollectionManifestArtifactId !== analysisSet.commentManifest.artifactId ||
    telemetry.developerSignalsArtifactId !== analysisSet.signals.artifactId
  ) {
    fail(
      "DEVELOPER_SOURCE_TELEMETRY_INVALID",
      "Developer telemetry references the wrong companion artifacts.",
    );
  }
  const totalComments = analysisSet.commentCollections.reduce(
    (sum, collection) => sum + collection.comments.length,
    0,
  );
  if (
    telemetry.totals.repositoriesAccepted !==
      analysisSet.repositoryCollection.repositories.length ||
    telemetry.totals.threadsAccepted !== analysisSet.threads.length ||
    telemetry.totals.commentsAccepted !== totalComments ||
    telemetry.totals.releasesAccepted !==
      analysisSet.repositoryCollection.repositories.reduce(
        (sum, repository) => sum + repository.releases.length,
        0,
      ) ||
    telemetry.totals.signalsGenerated !== analysisSet.signals.signals.length
  ) {
    fail("DEVELOPER_SOURCE_TELEMETRY_INVALID", "Developer telemetry totals do not reconcile.");
  }
  return { ...analysisSet, telemetry };
}
