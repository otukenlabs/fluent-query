import type { SetAllUpdate } from "./set-all";
import { ensureTopLevelPath } from "./internal/path-tokens";

export function setTopLevelValue<T>(root: T, path: string, value: unknown): T {
  ensureTopLevelPath(path, "set");

  if (root === null || typeof root !== "object") {
    return root;
  }

  if (
    Object.prototype.hasOwnProperty.call(root as object, path) &&
    Object.is((root as any)[path], value)
  ) {
    return root;
  }

  if (Array.isArray(root)) {
    const clone = [...root];
    (clone as any)[path] = value;
    return clone as T;
  }

  return { ...(root as Record<string, unknown>), [path]: value } as T;
}

export function setTopLevelValuesBatch<T>(
  root: T,
  updates: ReadonlyArray<SetAllUpdate>,
): T {
  let current = root;
  for (const update of updates) {
    current = setTopLevelValue(current, update.path, update.value);
  }
  return current;
}
