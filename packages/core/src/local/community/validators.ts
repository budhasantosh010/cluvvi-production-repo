import {
  CommentCollectionArtifactV1Schema,
  ThreadArtifactV1Schema,
  type CommentCollectionArtifactV1,
  type ThreadArtifactV1,
} from "./universal-community";
import {
  CommentCollectionManifestArtifactV1Schema,
  CommunityCommentContextArtifactV1Schema,
  CommunitySignalsArtifactV1Schema,
  CommunitySourcePlanArtifactV1Schema,
  CommunitySourceRunTelemetryArtifactV1Schema,
  CommunityThreadContextArtifactV1Schema,
  ThreadManifestArtifactV1Schema,
  type CommentCollectionManifestArtifactV1,
  type CommunityCommentContextArtifactV1,
  type CommunitySignalsArtifactV1,
  type CommunitySourcePlanArtifactV1,
  type CommunitySourceRunTelemetryArtifactV1,
  type CommunityThreadContextArtifactV1,
  type ThreadManifestArtifactV1,
} from "./community-artifacts";
import {
  commentCollectionArtifactDigest,
  CommunityArtifactValidationError,
  deterministicCommentCollectionManifestId,
  deterministicCommunityCommentContextId,
  deterministicCommunitySignalsId,
  deterministicCommunitySourcePlanId,
  deterministicCommunityTelemetryId,
  deterministicCommunityThreadContextId,
  deterministicThreadManifestId,
  threadArtifactDigest,
} from "./identity";

export interface CommunityArtifactSetInput {
  plan: unknown;
  threadManifest: unknown;
  threadContext: unknown;
  threads: unknown[];
  commentManifest: unknown;
  commentContext: unknown;
  commentCollections: unknown[];
  signals: unknown;
  telemetry: unknown;
}

export interface ValidatedCommunityThreadManifestSet {
  plan: CommunitySourcePlanArtifactV1;
  threadManifest: ThreadManifestArtifactV1;
  threads: ThreadArtifactV1[];
}

export interface ValidatedCommunityThreadArtifactSet extends ValidatedCommunityThreadManifestSet {
  threadContext: CommunityThreadContextArtifactV1;
}

export interface ValidatedCommunityCommentManifestSet extends ValidatedCommunityThreadArtifactSet {
  commentManifest: CommentCollectionManifestArtifactV1;
  commentCollections: CommentCollectionArtifactV1[];
}

export interface ValidatedCommunityCommentArtifactSet extends ValidatedCommunityCommentManifestSet {
  commentContext: CommunityCommentContextArtifactV1;
}

export interface ValidatedCommunitySignalsArtifactSet extends ValidatedCommunityCommentArtifactSet {
  signals: CommunitySignalsArtifactV1;
}

export interface ValidatedCommunityArtifactSet extends ValidatedCommunitySignalsArtifactSet {
  telemetry: CommunitySourceRunTelemetryArtifactV1;
}

function withoutArtifactId<T extends { artifactId: string }>(value: T): Omit<T, "artifactId"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "artifactId")) as Omit<
    T,
    "artifactId"
  >;
}

const FORBIDDEN_KEYS = new Set([
  "rawhtml",
  "requestheaders",
  "responseheaders",
  "cookies",
  "authorization",
  "oauth",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "secret",
  "password",
  "environment",
]);

function fail(code: string, message: string): never {
  throw new CommunityArtifactValidationError(code, message);
}

function scanForbidden(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, [...path, String(index)]));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/gu, "").toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized)) {
      fail(
        "COMMUNITY_FORBIDDEN_DATA_REJECTED",
        `Community artifacts contain forbidden field ${[...path, key].join(".")}.`,
      );
    }
    scanForbidden(child, [...path, key]);
  }
}

function parseArtifact<T>(schema: { parse(value: unknown): T }, value: unknown, code: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof CommunityArtifactValidationError) throw error;
    fail(code, error instanceof Error ? error.message : "Community artifact validation failed.");
  }
}

function redditUrl(value: string): boolean {
  const host = new URL(value).hostname.toLowerCase();
  return host === "reddit.com" || host === "www.reddit.com";
}

function assertRequestId(expectedRequestId: string, artifacts: Array<{ requestId: string }>): void {
  if (artifacts.some((artifact) => artifact.requestId !== expectedRequestId)) {
    fail("COMMUNITY_REQUEST_MISMATCH", "All community artifacts must belong to the same request.");
  }
}

export function validateCommunitySourcePlanArtifact(
  input: unknown,
  expectedRequestId?: string,
): CommunitySourcePlanArtifactV1 {
  scanForbidden(input);
  const plan = parseArtifact(
    CommunitySourcePlanArtifactV1Schema,
    input,
    "COMMUNITY_SOURCE_PLAN_INVALID",
  );
  if (expectedRequestId !== undefined && plan.requestId !== expectedRequestId) {
    fail(
      "COMMUNITY_REQUEST_MISMATCH",
      "The community source plan does not belong to the current discovery request.",
    );
  }
  if (plan.artifactId !== deterministicCommunitySourcePlanId(withoutArtifactId(plan))) {
    fail("COMMUNITY_SOURCE_PLAN_INVALID", "Deterministic plan artifact ID mismatch.");
  }
  return plan;
}

export function validateCommunityThreadManifestSet(input: {
  plan: unknown;
  threadManifest: unknown;
  threads: unknown[];
  expectedRequestId?: string;
}): ValidatedCommunityThreadManifestSet {
  scanForbidden(input);
  const plan = validateCommunitySourcePlanArtifact(input.plan, input.expectedRequestId);
  const threadManifest = parseArtifact(
    ThreadManifestArtifactV1Schema,
    input.threadManifest,
    "THREAD_MANIFEST_INVALID",
  );
  const threads = input.threads.map((value) =>
    parseArtifact(ThreadArtifactV1Schema, value, "THREAD_ARTIFACT_INVALID"),
  );
  assertRequestId(plan.requestId, [threadManifest, ...threads]);
  if (
    threadManifest.artifactId !== deterministicThreadManifestId(withoutArtifactId(threadManifest))
  ) {
    fail("THREAD_MANIFEST_INVALID", "Deterministic thread manifest ID mismatch.");
  }
  const threadsById = new Map(threads.map((thread) => [thread.artifactId, thread]));
  if (threadsById.size !== threads.length) {
    fail("THREAD_ARTIFACT_INVALID", "Thread artifact IDs must be unique.");
  }
  if (threadManifest.threadArtifacts.length !== threads.length) {
    fail("THREAD_MANIFEST_INVALID", "Thread manifest and loaded thread count differ.");
  }
  for (const entry of threadManifest.threadArtifacts) {
    const thread = threadsById.get(entry.threadArtifactId);
    if (thread === undefined) {
      fail("THREAD_MANIFEST_INVALID", "Thread manifest references a missing thread artifact.");
    }
    if (threadArtifactDigest(thread) !== entry.contentDigest) {
      fail("THREAD_MANIFEST_INVALID", "Thread manifest digest mismatch.");
    }
    if (!redditUrl(thread.url)) {
      fail("THREAD_ARTIFACT_INVALID", "Community thread URL must be a public Reddit URL.");
    }
  }
  return { plan, threadManifest, threads };
}

export function validateCommunityThreadContextSet(input: {
  threadSet: ValidatedCommunityThreadManifestSet;
  threadContext: unknown;
}): ValidatedCommunityThreadArtifactSet {
  scanForbidden(input.threadContext);
  const threadContext = parseArtifact(
    CommunityThreadContextArtifactV1Schema,
    input.threadContext,
    "COMMUNITY_THREAD_CONTEXT_INVALID",
  );
  assertRequestId(input.threadSet.plan.requestId, [threadContext]);
  if (
    threadContext.artifactId !==
    deterministicCommunityThreadContextId(withoutArtifactId(threadContext))
  ) {
    fail("COMMUNITY_THREAD_CONTEXT_INVALID", "Deterministic thread context ID mismatch.");
  }
  if (
    threadContext.communitySourcePlanArtifactId !== input.threadSet.plan.artifactId ||
    threadContext.threadManifestArtifactId !== input.threadSet.threadManifest.artifactId
  ) {
    fail(
      "COMMUNITY_THREAD_CONTEXT_INVALID",
      "Thread context references do not match plan/manifest.",
    );
  }
  const threadIds = new Set(input.threadSet.threads.map((thread) => thread.artifactId));
  const contextIds = new Set(threadContext.threads.map((entry) => entry.threadArtifactId));
  if (
    contextIds.size !== input.threadSet.threads.length ||
    input.threadSet.threads.some((thread) => !contextIds.has(thread.artifactId))
  ) {
    fail(
      "COMMUNITY_THREAD_CONTEXT_INVALID",
      "Every thread must have exactly one community context entry.",
    );
  }
  for (const context of threadContext.threads) {
    if (!threadIds.has(context.threadArtifactId)) {
      fail(
        "COMMUNITY_THREAD_CONTEXT_INVALID",
        "Thread context contains an orphan thread reference.",
      );
    }
    for (const provenance of context.provenance) {
      const host = new URL(provenance.sourceUrl).hostname.toLowerCase();
      if (!["reddit.com", "www.reddit.com", "arctic-shift.photon-reddit.com"].includes(host)) {
        fail("COMMUNITY_THREAD_CONTEXT_INVALID", "Thread provenance used an unapproved host.");
      }
    }
  }
  return { ...input.threadSet, threadContext };
}

export function validateCommunityThreadArtifactSet(input: {
  plan: unknown;
  threadManifest: unknown;
  threadContext: unknown;
  threads: unknown[];
  expectedRequestId?: string;
}): ValidatedCommunityThreadArtifactSet {
  scanForbidden(input);
  const plan = validateCommunitySourcePlanArtifact(input.plan, input.expectedRequestId);
  const threadManifest = parseArtifact(
    ThreadManifestArtifactV1Schema,
    input.threadManifest,
    "THREAD_MANIFEST_INVALID",
  );
  const threadContext = parseArtifact(
    CommunityThreadContextArtifactV1Schema,
    input.threadContext,
    "COMMUNITY_THREAD_CONTEXT_INVALID",
  );
  const threads = input.threads.map((value) =>
    parseArtifact(ThreadArtifactV1Schema, value, "THREAD_ARTIFACT_INVALID"),
  );

  assertRequestId(plan.requestId, [threadManifest, threadContext, ...threads]);
  if (
    threadManifest.artifactId !== deterministicThreadManifestId(withoutArtifactId(threadManifest))
  ) {
    fail("THREAD_MANIFEST_INVALID", "Deterministic thread manifest ID mismatch.");
  }
  if (
    threadContext.artifactId !==
    deterministicCommunityThreadContextId(withoutArtifactId(threadContext))
  ) {
    fail("THREAD_MANIFEST_INVALID", "Deterministic thread context ID mismatch.");
  }
  if (
    threadContext.communitySourcePlanArtifactId !== plan.artifactId ||
    threadContext.threadManifestArtifactId !== threadManifest.artifactId
  ) {
    fail("THREAD_MANIFEST_INVALID", "Thread context references do not match plan/manifest.");
  }

  const threadsById = new Map(threads.map((thread) => [thread.artifactId, thread]));
  if (threadsById.size !== threads.length) {
    fail("THREAD_ARTIFACT_INVALID", "Thread artifact IDs must be unique.");
  }
  if (threadManifest.threadArtifacts.length !== threads.length) {
    fail("THREAD_MANIFEST_INVALID", "Thread manifest and loaded thread count differ.");
  }
  for (const entry of threadManifest.threadArtifacts) {
    const thread = threadsById.get(entry.threadArtifactId);
    if (thread === undefined) {
      fail("THREAD_MANIFEST_INVALID", "Thread manifest references a missing thread artifact.");
    }
    if (threadArtifactDigest(thread) !== entry.contentDigest) {
      fail("THREAD_MANIFEST_INVALID", "Thread manifest digest mismatch.");
    }
    if (!redditUrl(thread.url)) {
      fail("THREAD_ARTIFACT_INVALID", "Community thread URL must be a public Reddit URL.");
    }
  }
  const contextIds = new Set(threadContext.threads.map((entry) => entry.threadArtifactId));
  if (
    contextIds.size !== threads.length ||
    threads.some((thread) => !contextIds.has(thread.artifactId))
  ) {
    fail("THREAD_MANIFEST_INVALID", "Every thread must have exactly one community context entry.");
  }
  for (const context of threadContext.threads) {
    for (const provenance of context.provenance) {
      const host = new URL(provenance.sourceUrl).hostname.toLowerCase();
      if (!["reddit.com", "www.reddit.com", "arctic-shift.photon-reddit.com"].includes(host)) {
        fail("THREAD_ARTIFACT_INVALID", "Thread provenance used an unapproved host.");
      }
    }
  }

  return { plan, threadManifest, threadContext, threads };
}

export function validateCommunityCommentManifestSet(input: {
  threadSet: ValidatedCommunityThreadArtifactSet;
  commentManifest: unknown;
  commentCollections: unknown[];
}): ValidatedCommunityCommentManifestSet {
  scanForbidden({
    commentManifest: input.commentManifest,
    commentCollections: input.commentCollections,
  });
  const commentManifest = parseArtifact(
    CommentCollectionManifestArtifactV1Schema,
    input.commentManifest,
    "COMMENT_COLLECTION_MANIFEST_INVALID",
  );
  const commentCollections = input.commentCollections.map((value) =>
    parseArtifact(CommentCollectionArtifactV1Schema, value, "COMMENT_COLLECTION_INVALID"),
  );
  assertRequestId(input.threadSet.plan.requestId, [commentManifest, ...commentCollections]);
  if (
    commentManifest.artifactId !==
    deterministicCommentCollectionManifestId(withoutArtifactId(commentManifest))
  ) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Deterministic comment manifest ID mismatch.");
  }
  if (commentManifest.threadManifestArtifactId !== input.threadSet.threadManifest.artifactId) {
    fail(
      "COMMENT_COLLECTION_MANIFEST_INVALID",
      "Comment manifest references the wrong thread manifest.",
    );
  }
  const threadsById = new Map(input.threadSet.threads.map((thread) => [thread.artifactId, thread]));
  const collectionsById = new Map(
    commentCollections.map((collection) => [collection.artifactId, collection]),
  );
  if (collectionsById.size !== commentCollections.length) {
    fail("COMMENT_COLLECTION_INVALID", "Comment collection artifact IDs must be unique.");
  }
  if (commentManifest.collections.length !== commentCollections.length) {
    fail(
      "COMMENT_COLLECTION_MANIFEST_INVALID",
      "Comment manifest and loaded collection count differ.",
    );
  }
  const collectionThreadIds = new Set<string>();
  for (const entry of commentManifest.collections) {
    const collection = collectionsById.get(entry.commentCollectionArtifactId);
    if (collection === undefined) {
      fail(
        "COMMENT_COLLECTION_MANIFEST_INVALID",
        "Comment manifest references a missing collection.",
      );
    }
    if (
      !threadsById.has(entry.threadArtifactId) ||
      collection.threadArtifactId !== entry.threadArtifactId
    ) {
      fail(
        "COMMENT_COLLECTION_INVALID",
        "Comment collection references a missing or mismatched thread.",
      );
    }
    if (commentCollectionArtifactDigest(collection) !== entry.contentDigest) {
      fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Comment collection digest mismatch.");
    }
    if (collectionThreadIds.has(entry.threadArtifactId)) {
      fail(
        "COMMENT_COLLECTION_MANIFEST_INVALID",
        "Only one comment collection is allowed per thread.",
      );
    }
    collectionThreadIds.add(entry.threadArtifactId);
  }
  const commentsAccepted = commentCollections.reduce(
    (sum, collection) => sum + collection.comments.length,
    0,
  );
  if (commentManifest.summary.totalComments !== commentsAccepted) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Comment totals do not reconcile.");
  }
  return { ...input.threadSet, commentManifest, commentCollections };
}

export function validateCommunityCommentContextSet(input: {
  commentSet: ValidatedCommunityCommentManifestSet;
  commentContext: unknown;
}): ValidatedCommunityCommentArtifactSet {
  scanForbidden(input.commentContext);
  const commentContext = parseArtifact(
    CommunityCommentContextArtifactV1Schema,
    input.commentContext,
    "COMMUNITY_COMMENT_CONTEXT_INVALID",
  );
  assertRequestId(input.commentSet.plan.requestId, [commentContext]);
  if (
    commentContext.artifactId !==
    deterministicCommunityCommentContextId(withoutArtifactId(commentContext))
  ) {
    fail("COMMUNITY_COMMENT_CONTEXT_INVALID", "Deterministic comment context ID mismatch.");
  }
  if (
    commentContext.commentCollectionManifestArtifactId !==
    input.commentSet.commentManifest.artifactId
  ) {
    fail("COMMUNITY_COMMENT_CONTEXT_INVALID", "Comment context references the wrong manifest.");
  }
  const threadsById = new Set(input.commentSet.threads.map((thread) => thread.artifactId));
  const commentIds = new Set(
    input.commentSet.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  for (const context of commentContext.comments) {
    if (!threadsById.has(context.threadArtifactId) || !commentIds.has(context.commentId)) {
      fail("COMMUNITY_COMMENT_CONTEXT_INVALID", "Comment context contains an orphan reference.");
    }
    if (context.permalink !== undefined && !redditUrl(context.permalink)) {
      fail("COMMUNITY_COMMENT_CONTEXT_INVALID", "Comment permalink must be a public Reddit URL.");
    }
  }
  return { ...input.commentSet, commentContext };
}

export function validateCommunityCommentArtifactSet(input: {
  threadSet: ValidatedCommunityThreadArtifactSet;
  commentManifest: unknown;
  commentContext: unknown;
  commentCollections: unknown[];
}): ValidatedCommunityCommentArtifactSet {
  scanForbidden({
    commentManifest: input.commentManifest,
    commentContext: input.commentContext,
    commentCollections: input.commentCollections,
  });
  const commentManifest = parseArtifact(
    CommentCollectionManifestArtifactV1Schema,
    input.commentManifest,
    "COMMENT_COLLECTION_MANIFEST_INVALID",
  );
  const commentContext = parseArtifact(
    CommunityCommentContextArtifactV1Schema,
    input.commentContext,
    "COMMUNITY_COMMENT_CONTEXT_INVALID",
  );
  const commentCollections = input.commentCollections.map((value) =>
    parseArtifact(CommentCollectionArtifactV1Schema, value, "COMMENT_COLLECTION_INVALID"),
  );

  assertRequestId(input.threadSet.plan.requestId, [
    commentManifest,
    commentContext,
    ...commentCollections,
  ]);
  if (
    commentManifest.artifactId !==
    deterministicCommentCollectionManifestId(withoutArtifactId(commentManifest))
  ) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Deterministic comment manifest ID mismatch.");
  }
  if (
    commentContext.artifactId !==
    deterministicCommunityCommentContextId(withoutArtifactId(commentContext))
  ) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Deterministic comment context ID mismatch.");
  }
  if (commentManifest.threadManifestArtifactId !== input.threadSet.threadManifest.artifactId) {
    fail(
      "COMMENT_COLLECTION_MANIFEST_INVALID",
      "Comment manifest references the wrong thread manifest.",
    );
  }
  if (commentContext.commentCollectionManifestArtifactId !== commentManifest.artifactId) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Comment context references the wrong manifest.");
  }

  const threadsById = new Map(input.threadSet.threads.map((thread) => [thread.artifactId, thread]));
  const collectionsById = new Map(
    commentCollections.map((collection) => [collection.artifactId, collection]),
  );
  if (collectionsById.size !== commentCollections.length) {
    fail("COMMENT_COLLECTION_INVALID", "Comment collection artifact IDs must be unique.");
  }
  if (commentManifest.collections.length !== commentCollections.length) {
    fail(
      "COMMENT_COLLECTION_MANIFEST_INVALID",
      "Comment manifest and loaded collection count differ.",
    );
  }
  const collectionThreadIds = new Set<string>();
  for (const entry of commentManifest.collections) {
    const collection = collectionsById.get(entry.commentCollectionArtifactId);
    if (collection === undefined) {
      fail(
        "COMMENT_COLLECTION_MANIFEST_INVALID",
        "Comment manifest references a missing collection.",
      );
    }
    if (
      !threadsById.has(entry.threadArtifactId) ||
      collection.threadArtifactId !== entry.threadArtifactId
    ) {
      fail(
        "COMMENT_COLLECTION_INVALID",
        "Comment collection references a missing or mismatched thread.",
      );
    }
    if (commentCollectionArtifactDigest(collection) !== entry.contentDigest) {
      fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Comment collection digest mismatch.");
    }
    if (collectionThreadIds.has(entry.threadArtifactId)) {
      fail(
        "COMMENT_COLLECTION_MANIFEST_INVALID",
        "Only one comment collection is allowed per thread.",
      );
    }
    collectionThreadIds.add(entry.threadArtifactId);
  }

  const commentIds = new Set(
    commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  for (const context of commentContext.comments) {
    if (!threadsById.has(context.threadArtifactId) || !commentIds.has(context.commentId)) {
      fail("COMMENT_COLLECTION_INVALID", "Comment context contains an orphan reference.");
    }
    if (context.permalink !== undefined && !redditUrl(context.permalink)) {
      fail("COMMENT_COLLECTION_INVALID", "Comment permalink must be a public Reddit URL.");
    }
  }

  const commentsAccepted = commentCollections.reduce(
    (sum, collection) => sum + collection.comments.length,
    0,
  );
  if (commentManifest.summary.totalComments !== commentsAccepted) {
    fail("COMMENT_COLLECTION_MANIFEST_INVALID", "Comment totals do not reconcile.");
  }

  return {
    ...input.threadSet,
    commentManifest,
    commentContext,
    commentCollections,
  };
}

export function validateCommunitySignalsArtifactSet(input: {
  commentSet: ValidatedCommunityCommentArtifactSet;
  signals: unknown;
}): ValidatedCommunitySignalsArtifactSet {
  scanForbidden(input.signals);
  const signals = parseArtifact(
    CommunitySignalsArtifactV1Schema,
    input.signals,
    "COMMUNITY_SIGNALS_INVALID",
  );
  assertRequestId(input.commentSet.plan.requestId, [signals]);
  if (signals.artifactId !== deterministicCommunitySignalsId(withoutArtifactId(signals))) {
    fail("COMMUNITY_SIGNALS_INVALID", "Deterministic signal artifact ID mismatch.");
  }
  if (
    signals.communitySourcePlanArtifactId !== input.commentSet.plan.artifactId ||
    signals.threadManifestArtifactId !== input.commentSet.threadManifest.artifactId ||
    signals.commentCollectionManifestArtifactId !== input.commentSet.commentManifest.artifactId
  ) {
    fail("COMMUNITY_SIGNALS_INVALID", "Community signals reference the wrong companion artifacts.");
  }

  const threadIds = new Set(input.commentSet.threads.map((thread) => thread.artifactId));
  const commentIds = new Set(
    input.commentSet.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  for (const signal of signals.signals) {
    for (const threadId of signal.supportingThreadArtifactIds) {
      if (!threadIds.has(threadId)) {
        fail("COMMUNITY_SIGNALS_INVALID", "Community signal references an orphan thread.");
      }
    }
    for (const commentId of signal.supportingCommentIds) {
      if (!commentIds.has(commentId)) {
        fail("COMMUNITY_SIGNALS_INVALID", "Community signal references an orphan comment.");
      }
    }
  }

  return { ...input.commentSet, signals };
}

export function validateCommunityTelemetryArtifactSet(input: {
  signalsSet: ValidatedCommunitySignalsArtifactSet;
  telemetry: unknown;
}): ValidatedCommunityArtifactSet {
  scanForbidden(input.telemetry);
  const telemetry = parseArtifact(
    CommunitySourceRunTelemetryArtifactV1Schema,
    input.telemetry,
    "COMMUNITY_SOURCE_TELEMETRY_INVALID",
  );
  assertRequestId(input.signalsSet.plan.requestId, [telemetry]);
  if (telemetry.artifactId !== deterministicCommunityTelemetryId(withoutArtifactId(telemetry))) {
    fail("COMMUNITY_SOURCE_TELEMETRY_INVALID", "Deterministic telemetry artifact ID mismatch.");
  }
  if (
    telemetry.communitySourcePlanArtifactId !== input.signalsSet.plan.artifactId ||
    telemetry.threadManifestArtifactId !== input.signalsSet.threadManifest.artifactId ||
    telemetry.commentCollectionManifestArtifactId !== input.signalsSet.commentManifest.artifactId ||
    telemetry.communitySignalsArtifactId !== input.signalsSet.signals.artifactId
  ) {
    fail(
      "COMMUNITY_SOURCE_TELEMETRY_INVALID",
      "Community telemetry references the wrong companion artifacts.",
    );
  }

  const commentsAccepted = input.signalsSet.commentCollections.reduce(
    (sum, collection) => sum + collection.comments.length,
    0,
  );
  if (
    telemetry.totals.commentsAccepted !== commentsAccepted ||
    telemetry.totals.mergedThreads !== input.signalsSet.threads.length ||
    telemetry.totals.signalsGenerated !== input.signalsSet.signals.signals.length
  ) {
    fail("COMMUNITY_SOURCE_TELEMETRY_INVALID", "Community totals do not reconcile.");
  }

  return { ...input.signalsSet, telemetry };
}

export function validateCommunityArtifactSet(
  input: CommunityArtifactSetInput,
): ValidatedCommunityArtifactSet {
  const threadSet = validateCommunityThreadArtifactSet({
    plan: input.plan,
    threadManifest: input.threadManifest,
    threadContext: input.threadContext,
    threads: input.threads,
  });
  const commentSet = validateCommunityCommentArtifactSet({
    threadSet,
    commentManifest: input.commentManifest,
    commentContext: input.commentContext,
    commentCollections: input.commentCollections,
  });
  const signalsSet = validateCommunitySignalsArtifactSet({ commentSet, signals: input.signals });
  return validateCommunityTelemetryArtifactSet({ signalsSet, telemetry: input.telemetry });
}

// Compatibility aliases keep the engine/import layer readable while the frozen Project A
// artifact shapes remain the single source of truth.
export type ValidatedCommunityPlanSet = { plan: CommunitySourcePlanArtifactV1 };
export type ValidatedCommunityThreadSet = ValidatedCommunityThreadArtifactSet;
export type ValidatedCommunityCommentSet = ValidatedCommunityCommentArtifactSet;
export type ValidatedCommunityAnalysisSet = ValidatedCommunitySignalsArtifactSet;

export function validateCommunityPlanArtifact(input: {
  plan: unknown;
  requestId: string;
}): ValidatedCommunityPlanSet {
  return { plan: validateCommunitySourcePlanArtifact(input.plan, input.requestId) };
}

export function validateCommunityAnalysisArtifactSet(input: {
  plan: unknown;
  threadManifest: unknown;
  threadContext: unknown;
  threads: unknown[];
  commentManifest: unknown;
  commentContext: unknown;
  commentCollections: unknown[];
  signals: unknown;
  requestId: string;
}): ValidatedCommunityAnalysisSet {
  const threadSet = validateCommunityThreadArtifactSet({
    plan: input.plan,
    threadManifest: input.threadManifest,
    threadContext: input.threadContext,
    threads: input.threads,
    expectedRequestId: input.requestId,
  });
  const commentSet = validateCommunityCommentArtifactSet({
    threadSet,
    commentManifest: input.commentManifest,
    commentContext: input.commentContext,
    commentCollections: input.commentCollections,
  });
  return validateCommunitySignalsArtifactSet({ commentSet, signals: input.signals });
}
