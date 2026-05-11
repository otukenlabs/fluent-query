/**
 * @file core/pipeline-step.ts
 * @description Shared step representation for ArrayQuery chain recording.
 */

/**
 * A recorded chain operation, used by both bound (for .toRecipe()) and
 * unbound (for .run()) modes.
 */
export type PipelineStep =
  | { method: string; args: any[] }
  | {
      method: "where" | "whereNot";
      args: [string];
      modifiers: { name: string; args: any[] }[];
      terminal: { method: string; args: any[] };
    };

/**
 * Type guard for compound where-chain steps.
 */
export function isWhereStep(
  step: PipelineStep,
): step is Extract<PipelineStep, { modifiers: any }> {
  return "modifiers" in step;
}
