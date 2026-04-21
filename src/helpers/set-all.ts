/**
 * @file helpers/set-all.ts
 * @description Immutable deep update helpers for setting all matching path occurrences.
 */

import { applyPathAtNode } from "./internal/path-set-engine";
import {
  isObjectLike,
  tokenizePath,
  type PathToken,
} from "./internal/path-tokens";

export type SetAllUpdate = {
  path: string;
  value: unknown;
};

function visitAndSetAll(
  node: unknown,
  tokens: PathToken[],
  value: unknown,
): { updated: unknown; changed: boolean } {
  let current = node;
  let changed = false;

  const fromHere = applyPathAtNode(current, tokens, value, 0);
  if (fromHere.changed) {
    current = fromHere.updated;
    changed = true;
  }

  if (!isObjectLike(current)) {
    return { updated: current, changed };
  }

  if (Array.isArray(current)) {
    const arrayCurrent = current as unknown[];
    let arr: unknown[] = arrayCurrent;
    for (let i = 0; i < arrayCurrent.length; i++) {
      const child = visitAndSetAll(arr[i], tokens, value);
      if (child.changed) {
        if (arr === arrayCurrent) {
          arr = [...arr];
        }
        arr[i] = child.updated;
        changed = true;
      }
    }
    return { updated: arr, changed };
  }

  let obj = current as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(obj)) {
    const child = visitAndSetAll(childValue, tokens, value);
    if (child.changed) {
      if (obj === current) {
        obj = { ...obj };
      }
      obj[key] = child.updated;
      changed = true;
    }
  }

  return { updated: obj, changed };
}

/**
 * Immutably sets all occurrences of `path` to `value` by scanning the full structure.
 * Matches can start at any nested object/array node.
 */
export function setAllByPathOccurrences<T>(
  root: T,
  path: string,
  value: unknown,
): T {
  const tokens = tokenizePath(path, "setAll");
  const result = visitAndSetAll(root, tokens, value);
  return result.updated as T;
}

/**
 * Applies multiple setAll updates in order.
 * Later updates can overwrite earlier updates for overlapping paths.
 */
export function setAllByPathOccurrencesBatch<T>(
  root: T,
  updates: ReadonlyArray<SetAllUpdate>,
): T {
  let current = root;
  for (const update of updates) {
    current = setAllByPathOccurrences(current, update.path, update.value);
  }
  return current;
}
