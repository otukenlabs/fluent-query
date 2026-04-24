/**
 * @file types.ts
 * @description Type definitions for the json-query module.
 */

/**
 * Common primitive values supported for equality comparisons.
 */
export type Primitive = string | number | boolean;

/**
 * Modes that control how string matching behaves.
 *
 * - `exact` → the entire string must match (optionally case-insensitive)
 * - `contains` → substring match
 * - `startsWith` → prefix match
 * - `endsWith` → suffix match
 */
export type MatchMode = "exact" | "contains" | "startsWith" | "endsWith";

/**
 * Options for a single `where(...)` clause.
 */
export type WhereOptions = {
  /**
   * If true, string comparisons ignore case.
   *
   * @defaultValue `true`
   */
  caseInsensitive?: boolean;

  /**
   * If true, string inputs are trimmed before matching.
   *
   * @defaultValue `true`
   */
  trim?: boolean;
};

/**
 * Options for numeric comparisons such as `greaterThan()` and `lessThan()`.
 */
export type NumericComparisonOptions = {
  /**
   * When true, numeric strings are parsed as numbers during comparisons.
   *
   * @defaultValue `true`
   */
  coerceNumericStrings?: boolean;

  /**
   * When true, `null` and `undefined` values are treated as `0`.
   *
   * @defaultValue `true`
   */
  nullAsZero?: boolean;
};

/**
 * Metadata for tracking an item's source within a groups hierarchy.
 */
export type GroupItemMetadata = {
  groupKey: string;
  itemIndex: number;
};

/**
 * Metadata for path reconstruction in grouped array queries.
 */
export type ArrayQueryMetadata = {
  rootSnapshot?: unknown;
  groupsRootPath?: string;
  arrayPath?: string;
  itemMetadata?: Array<GroupItemMetadata>;
};

export type DiffReason =
  | "value-mismatch"
  | "type-mismatch"
  | "missing-key"
  | "extra-key"
  | "array-length-mismatch"
  | "array-order-mismatch";

export type Mismatch = {
  path: string;
  reason: DiffReason;
  expected?: unknown;
  actual?: unknown;
  itemIndex?: number;
  groupKey?: string;
};

export type DiffOptions = {
  unorderedArrays?: boolean | string[];
  ignorePaths?: string[];
  maxMismatches?: number;
};

export type HasAllOptions = {
  scope?: "top-level" | "deep";
};

export type FindOptions = {
  scope?: "top-level" | "deep";
};

export type SetOptions = {
  scope?: "top-level" | "deep";
};

export type ReplaceValueOptions = {
  scope?: "top-level" | "deep";
  keySelection?: {
    mode: "include" | "exclude";
    keys: string[];
  };
};

export type ReplaceRule = {
  from: unknown;
  to: unknown;
};

export type DiffResult = {
  equal: boolean;
  mismatches: Mismatch[];
  truncated?: boolean;
};
