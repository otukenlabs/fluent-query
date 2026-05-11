import {
  isObjectLike,
  type PathToken,
  tokenizePath,
} from "./internal/path-tokens";

export type UnsetOptions = {
  onMissing?: "ignore" | "throw";
};

function missingError(path: string, reason: string): Error {
  return new Error(`Path "${path}" does not exist: ${reason}.`);
}

function applyUnsetByPath(
  node: unknown,
  tokens: PathToken[],
  path: string,
  index: number,
  options?: UnsetOptions,
): unknown {
  const onMissing = options?.onMissing ?? "ignore";

  if (index >= tokens.length) {
    return node;
  }

  const token = tokens[index];
  const isLast = index === tokens.length - 1;

  if (token.kind === "prop") {
    if (!isObjectLike(node)) {
      if (onMissing === "throw") {
        throw missingError(path, `null/undefined at "${token.key}"`);
      }
      return node;
    }

    if (!Object.hasOwn(node, token.key)) {
      if (onMissing === "throw") {
        throw missingError(path, `property "${token.key}" not found`);
      }
      return node;
    }

    if (isLast) {
      if (Array.isArray(node)) {
        const clone = [...node];
        delete (clone as any)[token.key];
        return clone;
      }

      const clone = { ...(node as Record<string, unknown>) };
      delete clone[token.key];
      return clone;
    }

    const child = (node as any)[token.key];
    const updatedChild = applyUnsetByPath(
      child,
      tokens,
      path,
      index + 1,
      options,
    );

    if (updatedChild === child) {
      return node;
    }

    if (Array.isArray(node)) {
      const clone = [...node];
      (clone as any)[token.key] = updatedChild;
      return clone;
    }

    return {
      ...(node as Record<string, unknown>),
      [token.key]: updatedChild,
    };
  }

  if (!Array.isArray(node)) {
    if (onMissing === "throw") {
      throw missingError(path, `value is not an array at index ${token.index}`);
    }
    return node;
  }

  if (token.index < 0 || token.index >= node.length) {
    if (onMissing === "throw") {
      throw missingError(path, `index ${token.index} out of bounds`);
    }
    return node;
  }

  if (isLast) {
    const clone = [...node];
    clone.splice(token.index, 1);
    return clone;
  }

  const child = node[token.index];
  const updatedChild = applyUnsetByPath(
    child,
    tokens,
    path,
    index + 1,
    options,
  );

  if (updatedChild === child) {
    return node;
  }

  const clone = [...node];
  clone[token.index] = updatedChild;
  return clone;
}

export function unsetByPathStrict<T>(
  root: T,
  path: string,
  options?: UnsetOptions,
): T {
  if (!path || !path.trim()) {
    throw new Error("unset() requires a non-empty path.");
  }

  const tokens = tokenizePath(path, "unset");
  return applyUnsetByPath(root, tokens, path, 0, options) as T;
}

export function unsetByPathsStrict<T>(
  root: T,
  paths: ReadonlyArray<string>,
  options?: UnsetOptions,
): T {
  let current = root;
  for (const path of paths) {
    current = unsetByPathStrict(current, path, options);
  }
  return current;
}
