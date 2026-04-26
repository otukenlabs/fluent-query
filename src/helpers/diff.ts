import type { DiffOptions, DiffResult, Mismatch } from "../types";

type DiffInternalOptions = {
  unorderedArrays: boolean | string[];
  ignorePaths: string[];
  maxMismatches: number;
};

function toInternalOptions(options?: DiffOptions): DiffInternalOptions {
  const max = options?.maxMismatches;
  const maxMismatches =
    typeof max === "number" && Number.isFinite(max) && max > 0
      ? Math.floor(max)
      : Number.POSITIVE_INFINITY;

  return {
    unorderedArrays: options?.unorderedArrays ?? false,
    ignorePaths: options?.ignorePaths ?? [],
    maxMismatches,
  };
}

function parsePathTokens(path: string): string[] {
  if (!path) return [];
  const tokens: string[] = [];
  const pattern = /([^.[\]]+)|(\[(?:\*|\d+)\])/g;
  let match = pattern.exec(path);
  while (match !== null) {
    tokens.push(match[1] ?? match[2]);
    match = pattern.exec(path);
  }
  return tokens;
}

function isArrayIndexToken(token: string): boolean {
  return /^\[\d+\]$/.test(token);
}

function tokenMatchesPath(token: string, pathToken: string): boolean {
  if (token === "*") {
    return !isArrayIndexToken(pathToken);
  }
  if (token === "[*]") {
    return isArrayIndexToken(pathToken);
  }
  return token === pathToken;
}

function matchesWildcardPath(
  pathTokens: string[],
  patternTokens: string[],
  i: number,
  j: number,
): boolean {
  if (j === patternTokens.length) {
    return i === pathTokens.length;
  }

  const patternToken = patternTokens[j];
  if (patternToken === "**") {
    if (matchesWildcardPath(pathTokens, patternTokens, i, j + 1)) {
      return true;
    }
    if (i < pathTokens.length) {
      return matchesWildcardPath(pathTokens, patternTokens, i + 1, j);
    }
    return false;
  }

  if (i >= pathTokens.length) {
    return false;
  }

  if (!tokenMatchesPath(patternToken, pathTokens[i])) {
    return false;
  }

  return matchesWildcardPath(pathTokens, patternTokens, i + 1, j + 1);
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  return matchesWildcardPath(
    parsePathTokens(path),
    parsePathTokens(pattern),
    0,
    0,
  );
}

function isUnorderedArrayPath(
  path: string,
  options: DiffInternalOptions,
): boolean {
  if (options.unorderedArrays === true) {
    return true;
  }
  if (!Array.isArray(options.unorderedArrays)) {
    return false;
  }
  return options.unorderedArrays.some((pattern) =>
    pathMatchesPattern(path, pattern),
  );
}

function isIgnoredPath(path: string, options: DiffInternalOptions): boolean {
  if (options.ignorePaths.length === 0) {
    return false;
  }
  return options.ignorePaths.some((pattern) =>
    pathMatchesPattern(path, pattern),
  );
}

function stableKey(value: unknown, seen: WeakSet<object>): string {
  if (value === null) return "null";

  const valueType = typeof value;
  if (valueType === "string") return `str:${JSON.stringify(value)}`;
  if (valueType === "number") {
    if (Number.isNaN(value)) return "num:NaN";
    if (Object.is(value, -0)) return "num:-0";
    if (value === Infinity) return "num:Infinity";
    if (value === -Infinity) return "num:-Infinity";
    return `num:${value}`;
  }
  if (valueType === "boolean") return `bool:${value}`;
  if (valueType === "bigint") return `bigint:${String(value)}`;
  if (valueType === "undefined") return "undefined";
  if (valueType === "symbol") return `symbol:${String(value)}`;
  if (valueType === "function") return `function:${String(value)}`;

  if (value instanceof Date) {
    return `date:${value.toISOString()}`;
  }
  if (value instanceof RegExp) {
    return `regexp:${value.toString()}`;
  }

  if (seen.has(value as object)) {
    return "[Circular]";
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    const items = value.map((item) => stableKey(item, seen));
    seen.delete(value);
    return `[${items.join(",")}]`;
  }

  const recordValue = value as Record<string, unknown>;
  const keys = Object.keys(recordValue).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableKey(recordValue[key], seen)}`,
  );
  seen.delete(value as object);
  return `{${entries.join(",")}}`;
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function pathFor(basePath: string, segment: string): string {
  if (!basePath) return segment;
  if (segment.startsWith("[")) return `${basePath}${segment}`;
  return `${basePath}.${segment}`;
}

function compareUnorderedArrays(
  expected: unknown[],
  actual: unknown[],
  path: string,
  mismatches: Mismatch[],
  _options: DiffInternalOptions,
): void {
  const expectedCounts = new Map<string, number>();
  const actualCounts = new Map<string, number>();

  for (const item of expected) {
    const key = stableKey(item, new WeakSet<object>());
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
  }

  for (const item of actual) {
    const key = stableKey(item, new WeakSet<object>());
    actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
  }

  const allKeys = new Set([...expectedCounts.keys(), ...actualCounts.keys()]);
  for (const key of allKeys) {
    const expectedCount = expectedCounts.get(key) ?? 0;
    const actualCount = actualCounts.get(key) ?? 0;
    if (expectedCount !== actualCount) {
      mismatches.push({
        path,
        reason: "value-mismatch",
        expected: expected,
        actual: actual,
      });
      return;
    }
  }
}

function compareValue(
  expected: unknown,
  actual: unknown,
  path: string,
  mismatches: Mismatch[],
  options: DiffInternalOptions,
): void {
  if (isIgnoredPath(path, options)) {
    return;
  }

  if (mismatches.length >= options.maxMismatches) {
    return;
  }

  const expectedType = valueType(expected);
  const actualType = valueType(actual);

  if (expectedType !== actualType) {
    mismatches.push({
      path,
      reason: "type-mismatch",
      expected,
      actual,
    });
    return;
  }

  if (expectedType === "array") {
    const expectedArray = expected as unknown[];
    const actualArray = actual as unknown[];

    if (expectedArray.length !== actualArray.length) {
      mismatches.push({
        path,
        reason: "array-length-mismatch",
        expected: expectedArray.length,
        actual: actualArray.length,
      });
      return;
    }

    const orderedSame = expectedArray.every(
      (item, index) =>
        stableKey(item, new WeakSet<object>()) ===
        stableKey(actualArray[index], new WeakSet<object>()),
    );

    if (!orderedSame) {
      const expectedCounts = new Map<string, number>();
      const actualCounts = new Map<string, number>();
      for (const item of expectedArray) {
        const key = stableKey(item, new WeakSet<object>());
        expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
      }
      for (const item of actualArray) {
        const key = stableKey(item, new WeakSet<object>());
        actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
      }

      const sameMultiset =
        expectedCounts.size === actualCounts.size &&
        [...expectedCounts.entries()].every(
          ([key, count]) => (actualCounts.get(key) ?? 0) === count,
        );

      if (sameMultiset && !isUnorderedArrayPath(path, options)) {
        mismatches.push({
          path,
          reason: "array-order-mismatch",
          expected,
          actual,
        });
        return;
      }
    }

    if (isUnorderedArrayPath(path, options)) {
      compareUnorderedArrays(
        expectedArray,
        actualArray,
        path,
        mismatches,
        options,
      );
      return;
    }

    for (let i = 0; i < expectedArray.length; i++) {
      compareValue(
        expectedArray[i],
        actualArray[i],
        pathFor(path, `[${i}]`),
        mismatches,
        options,
      );
      if (mismatches.length >= options.maxMismatches) {
        return;
      }
    }
    return;
  }

  if (expectedType === "object") {
    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    const expectedKeys = Object.keys(expectedObj);
    const actualKeys = Object.keys(actualObj);

    for (const key of expectedKeys) {
      if (!(key in actualObj)) {
        const keyPath = pathFor(path, key);
        if (isIgnoredPath(keyPath, options)) {
          continue;
        }
        mismatches.push({
          path: keyPath,
          reason: "missing-key",
          expected: expectedObj[key],
        });
        if (mismatches.length >= options.maxMismatches) {
          return;
        }
      }
    }

    for (const key of actualKeys) {
      if (!(key in expectedObj)) {
        const keyPath = pathFor(path, key);
        if (isIgnoredPath(keyPath, options)) {
          continue;
        }
        mismatches.push({
          path: keyPath,
          reason: "extra-key",
          actual: actualObj[key],
        });
        if (mismatches.length >= options.maxMismatches) {
          return;
        }
      }
    }

    const commonKeys = expectedKeys.filter((key) => key in actualObj);
    for (const key of commonKeys) {
      compareValue(
        expectedObj[key],
        actualObj[key],
        pathFor(path, key),
        mismatches,
        options,
      );
      if (mismatches.length >= options.maxMismatches) {
        return;
      }
    }
    return;
  }

  if (!Object.is(expected, actual)) {
    mismatches.push({
      path,
      reason: "value-mismatch",
      expected,
      actual,
    });
  }
}

export function diffValues(
  expected: unknown,
  actual: unknown,
  options?: DiffOptions,
): DiffResult {
  const internal = toInternalOptions(options);
  const mismatches: Mismatch[] = [];

  compareValue(expected, actual, "", mismatches, internal);

  const result: DiffResult = {
    equal: mismatches.length === 0,
    mismatches,
  };

  if (mismatches.length >= internal.maxMismatches) {
    result.truncated = true;
  }

  return result;
}
