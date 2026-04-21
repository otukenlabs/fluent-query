import {
  isObjectLike,
  tokenizePath,
  type PathToken,
} from "./internal/path-tokens";

function applyByPath(
  node: unknown,
  tokens: PathToken[],
  path: string,
  value: unknown,
  index: number,
): unknown {
  if (index === tokens.length) {
    return value;
  }

  const token = tokens[index];

  if (token.kind === "prop") {
    if (!isObjectLike(node)) {
      throw new Error(
        `Path "${path}" does not exist: null/undefined at "${token.key}".`,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(node, token.key)) {
      throw new Error(
        `Path "${path}" does not exist: property "${token.key}" not found.`,
      );
    }

    const child = (node as any)[token.key];
    const updatedChild = applyByPath(child, tokens, path, value, index + 1);

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
    throw new Error(
      `Path "${path}" does not exist: value is not an array at index ${token.index}.`,
    );
  }
  if (token.index < 0 || token.index >= node.length) {
    throw new Error(
      `Path "${path}" does not exist: index ${token.index} out of bounds.`,
    );
  }

  const updatedChild = applyByPath(
    node[token.index],
    tokens,
    path,
    value,
    index + 1,
  );
  const clone = [...node];
  clone[token.index] = updatedChild;
  return clone;
}

export function setByPathStrict<T>(root: T, path: string, value: unknown): T {
  if (!path) {
    return value as T;
  }

  const tokens = tokenizePath(path, "toRoot");
  return applyByPath(root, tokens, path, value, 0) as T;
}
