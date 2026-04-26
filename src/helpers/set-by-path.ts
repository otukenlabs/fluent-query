import {
  isObjectLike,
  type PathToken,
  tokenizePath,
} from "./internal/path-tokens";

export type SetByPathOptions = {
  createMissing?: boolean;
  methodName?: string;
};

function createContainerFor(nextToken: PathToken | undefined): unknown {
  return nextToken?.kind === "index" ? [] : {};
}

function applyByPath(
  node: unknown,
  tokens: PathToken[],
  path: string,
  value: unknown,
  index: number,
  createMissing: boolean,
): unknown {
  if (index === tokens.length) {
    return value;
  }

  const token = tokens[index];
  const nextToken = tokens[index + 1];

  if (token.kind === "prop") {
    if (!isObjectLike(node)) {
      if (createMissing && (node === null || node === undefined)) {
        return {
          [token.key]: applyByPath(
            createContainerFor(nextToken),
            tokens,
            path,
            value,
            index + 1,
            createMissing,
          ),
        };
      }
      throw new Error(
        `Path "${path}" does not exist: null/undefined at "${token.key}".`,
      );
    }
    if (!Object.hasOwn(node, token.key) && !createMissing) {
      throw new Error(
        `Path "${path}" does not exist: property "${token.key}" not found.`,
      );
    }

    const child = Object.hasOwn(node, token.key)
      ? (node as any)[token.key]
      : createContainerFor(nextToken);
    const updatedChild = applyByPath(
      child,
      tokens,
      path,
      value,
      index + 1,
      createMissing,
    );

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
    if (createMissing && (node === null || node === undefined)) {
      const clone: unknown[] = [];
      clone[token.index] = applyByPath(
        createContainerFor(nextToken),
        tokens,
        path,
        value,
        index + 1,
        createMissing,
      );
      return clone;
    }
    throw new Error(
      `Path "${path}" does not exist: value is not an array at index ${token.index}.`,
    );
  }
  if (token.index < 0 || (!createMissing && token.index >= node.length)) {
    throw new Error(
      `Path "${path}" does not exist: index ${token.index} out of bounds.`,
    );
  }

  const updatedChild = applyByPath(
    token.index < node.length
      ? node[token.index]
      : createContainerFor(nextToken),
    tokens,
    path,
    value,
    index + 1,
    createMissing,
  );
  const clone = [...node];
  clone[token.index] = updatedChild;
  return clone;
}

export function setByPath<T>(
  root: T,
  path: string,
  value: unknown,
  options?: SetByPathOptions,
): T {
  if (!path) {
    return value as T;
  }

  const methodName = options?.methodName ?? "toRoot";
  const tokens = tokenizePath(path, methodName);
  return applyByPath(
    root,
    tokens,
    path,
    value,
    0,
    options?.createMissing ?? false,
  ) as T;
}

export function setByPathStrict<T>(root: T, path: string, value: unknown): T {
  return setByPath(root, path, value);
}
