import type { LocalRunPhase, RunFailure } from "./run";

export class CluvviError extends Error {
  readonly failure: RunFailure;

  constructor(failure: RunFailure, options?: ErrorOptions) {
    super(failure.message, options);
    this.name = "CluvviError";
    this.failure = failure;
  }
}

export function classifyError(error: unknown, stage?: LocalRunPhase): RunFailure {
  if (error instanceof CluvviError) {
    return error.failure;
  }

  return {
    code: "INTERNAL_UNEXPECTED_ERROR",
    category: "internal",
    message: error instanceof Error ? error.message : "An unknown error occurred.",
    retryable: false,
    ...(stage === undefined ? {} : { stage }),
    ...(error instanceof Error && error.stack !== undefined ? { cause: error.stack } : {}),
  };
}
