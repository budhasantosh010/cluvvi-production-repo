import { z } from "zod";
import type { ActionState } from "./action-state";

export function actionError(error: unknown): ActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "Check the highlighted information and try again.",
      fieldErrors: error.flatten().fieldErrors,
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Something went wrong. Try again.",
  };
}
