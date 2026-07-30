import "server-only";

import { ApplicationServiceError } from "@cluvvi/application";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
    requestId: string;
  };
}

export function apiError(error: unknown): NextResponse<ApiErrorBody> {
  const requestId = `req_${randomUUID().replaceAll("-", "")}`;
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "request";
      fieldErrors[key] ??= [];
      fieldErrors[key].push(issue.message);
    }
    return NextResponse.json(
      {
        error: {
          code: "MISSION_SCHEMA_INVALID",
          message: "The request contains invalid fields.",
          retryable: false,
          fieldErrors,
          requestId,
        },
      },
      { status: 400 },
    );
  }
  if (error instanceof ApplicationServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId,
        },
      },
      { status: error.status },
    );
  }
  console.error("Cluvvi API failure", { requestId, error });
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Cluvvi could not complete this request.",
        retryable: true,
        requestId,
      },
    },
    { status: 500 },
  );
}
