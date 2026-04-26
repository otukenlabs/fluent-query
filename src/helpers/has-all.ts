import type { HasAllOptions } from "../types";

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function deepEqual(expected: unknown, actual: unknown): boolean {
  if (Object.is(expected, actual)) {
    return true;
  }

  if (!isObjectLike(expected) || !isObjectLike(actual)) {
    return false;
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return false;
    }

    const expectedArray = expected as unknown[];
    const actualArray = actual as unknown[];

    if (expectedArray.length !== actualArray.length) {
      return false;
    }

    return expectedArray.every((expectedItem, index) =>
      deepEqual(expectedItem, actualArray[index]),
    );
  }

  const expectedObject = expected as Record<string, unknown>;
  const actualObject = actual as Record<string, unknown>;
  const expectedKeys = Object.keys(expectedObject);
  const actualKeys = Object.keys(actualObject);

  if (expectedKeys.length !== actualKeys.length) {
    return false;
  }

  for (const key of expectedKeys) {
    if (!(key in actualObject)) {
      return false;
    }
    if (!deepEqual(expectedObject[key], actualObject[key])) {
      return false;
    }
  }

  return true;
}

function topLevelObjectHasAll(
  value: Record<string, unknown>,
  criteria: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(criteria)) {
    if (!(key in value)) {
      return false;
    }
    if (!deepEqual(expected, value[key])) {
      return false;
    }
  }

  return true;
}

function criteriaPairExistsInSubtree(
  root: unknown,
  key: string,
  expected: unknown,
): boolean {
  const stack: unknown[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!isObjectLike(current)) {
      continue;
    }

    if (!Array.isArray(current)) {
      const currentObject = current as Record<string, unknown>;
      if (
        Object.hasOwn(currentObject, key) &&
        deepEqual(expected, currentObject[key])
      ) {
        return true;
      }

      stack.push(...Object.values(currentObject));
      continue;
    }

    stack.push(...current);
  }

  return false;
}

function objectOrDescendantHasAll(
  value: unknown,
  criteria: Record<string, unknown>,
  scope: "top-level" | "deep",
): boolean {
  if (!isObjectLike(value)) {
    return false;
  }

  if (scope === "top-level") {
    return !Array.isArray(value) && topLevelObjectHasAll(value, criteria);
  }

  return Object.entries(criteria).every(([key, expected]) =>
    criteriaPairExistsInSubtree(value, key, expected),
  );
}

export function hasAllInAny(
  values: readonly unknown[],
  criteria: Record<string, unknown>,
  options?: HasAllOptions,
): boolean {
  const scope = options?.scope ?? "top-level";

  for (const value of values) {
    if (objectOrDescendantHasAll(value, criteria, scope)) {
      return true;
    }
  }

  return false;
}
