import { z } from "zod";

const PublicHttpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only public HTTP or HTTPS URLs are allowed.");

export const EngagementSignalsV1Schema = z.strictObject({
  observedAt: z.iso.datetime(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  upvotes: z.number().int().nonnegative().optional(),
  downvotes: z.number().int().nonnegative().optional(),
  replies: z.number().int().nonnegative().optional(),
  reposts: z.number().int().nonnegative().optional(),
  quotes: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  stars: z.number().int().nonnegative().optional(),
  forks: z.number().int().nonnegative().optional(),
  reactions: z.number().int().nonnegative().optional(),
  watchers: z.number().int().nonnegative().optional(),
  sourceNativeScore: z.number().optional(),
  confidence: z.number().min(0).max(1),
  limitations: z.array(z.string().min(1).max(1_000)).max(100),
});
export type EngagementSignalsV1 = z.infer<typeof EngagementSignalsV1Schema>;

const PublicAuthorV1Schema = z.strictObject({
  sourceNativeId: z.string().min(1).max(500).optional(),
  displayName: z.string().min(1).max(500).optional(),
  handle: z.string().min(1).max(500).optional(),
});

export const ThreadArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("thread.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  sourceAdapterId: z.string().min(1).max(100),
  sourceNativeId: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(10_000).optional(),
  body: z.string().min(1).max(500_000).optional(),
  author: PublicAuthorV1Schema.optional(),
  url: PublicHttpUrlSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  engagement: EngagementSignalsV1Schema.optional(),
  trustClassification: z.literal("untrusted_public_content"),
  limitations: z.array(z.string().min(1).max(1_000)).max(100),
});
export type ThreadArtifactV1 = z.infer<typeof ThreadArtifactV1Schema>;

const CommentV1Schema = z.strictObject({
  commentId: z.string().min(1).max(500),
  sourceNativeId: z.string().min(1).max(500).optional(),
  parentCommentId: z.string().min(1).max(500).optional(),
  author: PublicAuthorV1Schema.optional(),
  body: z.string().min(1).max(200_000),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  engagement: EngagementSignalsV1Schema.optional(),
  sequence: z.number().int().nonnegative(),
  trustClassification: z.literal("untrusted_public_content"),
  limitations: z.array(z.string().min(1).max(1_000)).max(100),
});

export const CommentCollectionArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("comment_collection.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    threadArtifactId: z.string().min(1).max(200),
    comments: z.array(CommentV1Schema).max(100_000),
    summary: z.strictObject({
      commentsCollected: z.number().int().nonnegative(),
      maximumDepthObserved: z.number().int().nonnegative(),
      truncated: z.boolean(),
    }),
    limitations: z.array(z.string().min(1).max(1_000)).max(100),
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    const byId = new Map(artifact.comments.map((comment) => [comment.commentId, comment]));
    for (const [index, comment] of artifact.comments.entries()) {
      if (ids.has(comment.commentId)) {
        context.addIssue({
          code: "custom",
          path: ["comments", index, "commentId"],
          message: "Comment IDs must be unique.",
        });
      }
      ids.add(comment.commentId);
      if (comment.parentCommentId !== undefined && !byId.has(comment.parentCommentId)) {
        context.addIssue({
          code: "custom",
          path: ["comments", index, "parentCommentId"],
          message: "Parent comment must exist in the same collection.",
        });
      }
    }
    for (const [index, comment] of artifact.comments.entries()) {
      const visited = new Set<string>();
      let cursor: typeof comment | undefined = comment;
      while (cursor?.parentCommentId !== undefined) {
        if (visited.has(cursor.parentCommentId) || cursor.parentCommentId === comment.commentId) {
          context.addIssue({
            code: "custom",
            path: ["comments", index, "parentCommentId"],
            message: "Comment parent relationships must be acyclic.",
          });
          break;
        }
        visited.add(cursor.parentCommentId);
        cursor = byId.get(cursor.parentCommentId);
      }
    }
    if (artifact.summary.commentsCollected !== artifact.comments.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "commentsCollected"],
        message: "commentsCollected must equal comments.length.",
      });
    }
  });
export type CommentCollectionArtifactV1 = z.infer<typeof CommentCollectionArtifactV1Schema>;

export { PublicHttpUrlSchema };
