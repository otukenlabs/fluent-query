import { applyFirstDeep, countDeepMatches } from "./internal/path-set-engine";
import { ensureTopLevelPath, tokenizePath } from "./internal/path-tokens";

export type SetOneOptions = {
  onMultiple?: "throw" | "first";
  scope?: "top-level" | "deep";
};

function setTopLevelOne<T>(root: T, path: string, value: unknown): T {
  if (path.includes(".") || path.includes("[") || path.includes("]")) {
    throw new Error(
      `setOne() with scope "top-level" only supports top-level keys. Received "${path}".`,
    );
  }
  ensureTopLevelPath(path, "setOne");

  if (root === null || typeof root !== "object") {
    throw new Error(`setOne() found no matches for path "${path}".`);
  }

  if (!Object.hasOwn(root as object, path)) {
    throw new Error(`setOne() found no matches for path "${path}".`);
  }

  if (Object.is((root as any)[path], value)) {
    return root;
  }

  if (Array.isArray(root)) {
    const clone = [...root];
    (clone as any)[path] = value;
    return clone as T;
  }

  return { ...(root as Record<string, unknown>), [path]: value } as T;
}

function setDeepOne<T>(
  root: T,
  path: string,
  value: unknown,
  onMultiple: "throw" | "first",
): T {
  const tokens = tokenizePath(path, "setOne");

  if (onMultiple === "throw") {
    const count = countDeepMatches(root, tokens);
    if (count === 0) {
      throw new Error(`setOne() found no matches for path "${path}".`);
    }
    if (count > 1) {
      throw new Error(
        `setOne() found ${count} matches for path "${path}". Use onMultiple: "first" or setAll().`,
      );
    }
  }

  const first = applyFirstDeep(root, tokens, value);
  if (!first.applied) {
    throw new Error(`setOne() found no matches for path "${path}".`);
  }
  return first.updated as T;
}

export function setOneByPath<T>(
  root: T,
  path: string,
  value: unknown,
  options?: SetOneOptions,
): T {
  const onMultiple = options?.onMultiple ?? "throw";
  const scope = options?.scope ?? "deep";

  if (scope === "top-level") {
    return setTopLevelOne(root, path, value);
  }

  return setDeepOne(root, path, value, onMultiple);
}
