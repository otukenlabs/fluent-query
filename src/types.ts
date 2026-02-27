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
  groupsRootPath?: string;
  arrayPath?: string;
  itemMetadata?: Array<GroupItemMetadata>;
};
