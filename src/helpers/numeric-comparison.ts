/**
 * @file helpers/numeric-comparison.ts
 * @description Shared helpers for numeric comparisons with numeric-string support.
 */

import { getByPath } from "./path";
import type { NumericComparisonOptions } from "../types";

type NumericComparisonOperator = "gt" | "gte" | "lt" | "lte";

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";

  const json = JSON.stringify(value);
  return json ?? String(value);
}

function safeGetByPath(obj: unknown, path: string): unknown {
  try {
    return getByPath(obj, path);
  } catch {
    return undefined;
  }
}

function coerceNumericComparisonValue(
  value: unknown,
  path: string,
  options?: NumericComparisonOptions,
): number {
  const nullAsZero = options?.nullAsZero !== false;

  if (value === null || value === undefined) {
    if (nullAsZero) {
      return 0;
    }

    throw new Error(
      `Numeric comparison at path "${path}" received ${value === null ? "null" : "undefined"}. Pass { nullAsZero: true } to treat nullish values as 0.`,
    );
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(
      `Numeric comparison at path "${path}" requires a finite number, received ${formatValue(value)}.`,
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new Error(
        `Numeric comparison at path "${path}" requires a number or numeric string, received an empty string.`,
      );
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(
    `Numeric comparison at path "${path}" requires a number or numeric string, received ${formatValue(value)}.`,
  );
}

export function buildNumericComparisonClause(
  path: string,
  operator: NumericComparisonOperator,
  target: number,
  options?: NumericComparisonOptions,
): any {
  if (!Number.isFinite(target)) {
    throw new Error(
      `Numeric comparison target for path "${path}" must be a finite number.`,
    );
  }

  return {
    $where: function (this: any) {
      const rawValue = path === "" ? this : safeGetByPath(this, path);
      const actual = coerceNumericComparisonValue(rawValue, path || "<self>", options);

      switch (operator) {
        case "gt":
          return actual > target;
        case "gte":
          return actual >= target;
        case "lt":
          return actual < target;
        case "lte":
          return actual <= target;
      }
    },
  };
}

/**
 * Coerces a value for numeric equality checking.
 * Accepts numbers and numeric strings; returns the numeric value for comparison.
 * Unlike range comparisons, treats nullish as a distinct non-match rather than coercing.
 */
export function coerceNumericEqualityValue(value: unknown): number {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }
    throw new Error(
      `Numeric equality requires a finite number, received ${formatValue(value)}.`,
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new Error(
        `Numeric equality requires a number or numeric string, received an empty string.`,
      );
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(
    `Numeric equality requires a number or numeric string, received ${formatValue(value)}.`,
  );
}

/**
 * Builds a numeric equality clause that coerces both field and search values.
 * Returns a sift $where predicate that compares numeric/numeric-string values.
 */
export function buildNumericEqualityClause(
  path: string,
  searchValue: unknown,
): any {
  let coercedTarget: number;
  try {
    coercedTarget = coerceNumericEqualityValue(searchValue);
  } catch (e) {
    throw new Error(
      `Numeric equality search value for path "${path}": ${(e as Error).message}`,
    );
  }

  return {
    $where: function (this: any) {
      const rawValue = path === "" ? this : safeGetByPath(this, path);

      // Nullish field values don't match
      if (rawValue === null || rawValue === undefined) {
        return false;
      }

      try {
        const coercedActual = coerceNumericEqualityValue(rawValue);
        return coercedActual === coercedTarget;
      } catch {
        // Non-numeric field values don't match
        return false;
      }
    },
  };
}