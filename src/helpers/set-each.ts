/**
 * @file helpers/set-each.ts
 * @description Immutable helpers for producing one updated variant per path occurrence.
 */

import {
  applyFromAbsolutePath,
  collectOccurrenceStarts,
} from "./internal/path-set-engine";
import { type PathToken, tokenizePath } from "./internal/path-tokens";

/**
 * Returns one updated root per matched path occurrence.
 * Each output applies exactly one occurrence update (independently from original root).
 */
export function setPathOccurrencesIndividually<T>(
  root: T,
  path: string,
  value: unknown,
): T[] {
  const tokens = tokenizePath(path, "setEach");
  const starts: PathToken[][] = [];
  collectOccurrenceStarts(root, tokens, [], starts);

  if (starts.length === 0) {
    throw new Error(`setEach() found no matches for path "${path}".`);
  }

  const results: T[] = [];
  for (const start of starts) {
    const next = applyFromAbsolutePath(root, start, tokens, value, 0);
    if (next.changed) {
      results.push(next.updated as T);
    }
  }
  return results;
}
