import { isObjectLike, type PathToken } from "./path-tokens";

export function canApplyPathAtNode(
  node: unknown,
  tokens: PathToken[],
  index: number,
): boolean {
  if (index === tokens.length) {
    return true;
  }

  const token = tokens[index];
  if (token.kind === "prop") {
    if (!isObjectLike(node)) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(node, token.key)) {
      return false;
    }
    return canApplyPathAtNode((node as any)[token.key], tokens, index + 1);
  }

  if (!Array.isArray(node)) {
    return false;
  }
  if (token.index < 0 || token.index >= node.length) {
    return false;
  }
  return canApplyPathAtNode(node[token.index], tokens, index + 1);
}

export function applyPathAtNode(
  node: unknown,
  tokens: PathToken[],
  value: unknown,
  index: number,
): { updated: unknown; changed: boolean } {
  if (index === tokens.length) {
    if (Object.is(node, value)) {
      return { updated: node, changed: false };
    }
    return { updated: value, changed: true };
  }

  const token = tokens[index];

  if (token.kind === "prop") {
    if (!isObjectLike(node)) {
      return { updated: node, changed: false };
    }
    if (!Object.prototype.hasOwnProperty.call(node, token.key)) {
      return { updated: node, changed: false };
    }

    const child = (node as any)[token.key];
    const next = applyPathAtNode(child, tokens, value, index + 1);
    if (!next.changed) {
      return { updated: node, changed: false };
    }

    if (Array.isArray(node)) {
      const clone = [...node];
      (clone as any)[token.key] = next.updated;
      return { updated: clone, changed: true };
    }

    return {
      updated: {
        ...(node as Record<string, unknown>),
        [token.key]: next.updated,
      },
      changed: true,
    };
  }

  if (!Array.isArray(node)) {
    return { updated: node, changed: false };
  }
  if (token.index < 0 || token.index >= node.length) {
    return { updated: node, changed: false };
  }

  const child = node[token.index];
  const next = applyPathAtNode(child, tokens, value, index + 1);
  if (!next.changed) {
    return { updated: node, changed: false };
  }

  const clone = [...node];
  clone[token.index] = next.updated;
  return { updated: clone, changed: true };
}

export function countDeepMatches(node: unknown, tokens: PathToken[]): number {
  let total = canApplyPathAtNode(node, tokens, 0) ? 1 : 0;

  if (!isObjectLike(node)) {
    return total;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      total += countDeepMatches(child, tokens);
    }
    return total;
  }

  for (const child of Object.values(node)) {
    total += countDeepMatches(child, tokens);
  }
  return total;
}

export function applyFirstDeep(
  node: unknown,
  tokens: PathToken[],
  value: unknown,
): { updated: unknown; applied: boolean } {
  if (canApplyPathAtNode(node, tokens, 0)) {
    const updated = applyPathAtNode(node, tokens, value, 0).updated;
    return { updated, applied: true };
  }

  if (!isObjectLike(node)) {
    return { updated: node, applied: false };
  }

  if (Array.isArray(node)) {
    const arr = node as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const child = applyFirstDeep(arr[i], tokens, value);
      if (child.applied) {
        const clone = [...arr];
        clone[i] = child.updated;
        return { updated: clone, applied: true };
      }
    }
    return { updated: node, applied: false };
  }

  const obj = node as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(obj)) {
    const child = applyFirstDeep(childValue, tokens, value);
    if (child.applied) {
      return {
        updated: { ...obj, [key]: child.updated },
        applied: true,
      };
    }
  }

  return { updated: node, applied: false };
}

export function collectOccurrenceStarts(
  node: unknown,
  tokens: PathToken[],
  currentPath: PathToken[],
  starts: PathToken[][],
): void {
  if (canApplyPathAtNode(node, tokens, 0)) {
    starts.push(currentPath);
  }

  if (!isObjectLike(node)) {
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      collectOccurrenceStarts(
        node[i],
        tokens,
        [...currentPath, { kind: "index", index: i }],
        starts,
      );
    }
    return;
  }

  for (const [key, child] of Object.entries(node)) {
    collectOccurrenceStarts(
      child,
      tokens,
      [...currentPath, { kind: "prop", key }],
      starts,
    );
  }
}

export function applyFromAbsolutePath(
  node: unknown,
  absolutePath: PathToken[],
  relativeTokens: PathToken[],
  value: unknown,
  index: number,
): { updated: unknown; changed: boolean } {
  if (index === absolutePath.length) {
    return applyPathAtNode(node, relativeTokens, value, 0);
  }

  const token = absolutePath[index];

  if (token.kind === "prop") {
    if (
      !isObjectLike(node) ||
      !Object.prototype.hasOwnProperty.call(node, token.key)
    ) {
      return { updated: node, changed: false };
    }
    const child = (node as any)[token.key];
    const next = applyFromAbsolutePath(
      child,
      absolutePath,
      relativeTokens,
      value,
      index + 1,
    );
    if (!next.changed) {
      return { updated: node, changed: false };
    }

    if (Array.isArray(node)) {
      const clone = [...node];
      (clone as any)[token.key] = next.updated;
      return { updated: clone, changed: true };
    }

    return {
      updated: {
        ...(node as Record<string, unknown>),
        [token.key]: next.updated,
      },
      changed: true,
    };
  }

  if (!Array.isArray(node) || token.index < 0 || token.index >= node.length) {
    return { updated: node, changed: false };
  }

  const child = node[token.index];
  const next = applyFromAbsolutePath(
    child,
    absolutePath,
    relativeTokens,
    value,
    index + 1,
  );
  if (!next.changed) {
    return { updated: node, changed: false };
  }

  const clone = [...node];
  clone[token.index] = next.updated;
  return { updated: clone, changed: true };
}
