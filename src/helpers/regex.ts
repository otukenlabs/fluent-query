/**
 * @file helpers/regex.ts
 * @description Utilities for regex building and pattern escaping.
 */

import type { MatchMode, WhereOptions } from "../types";

/**
 * Escapes a string so it can be safely used inside a RegExp.
 *
 * @internal
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex for a given match mode, optionally case-insensitive.
 *
 * @internal
 */
export function makeRegex(
  value: string,
  mode: MatchMode,
  opts: Required<WhereOptions>,
): RegExp {
  const raw = opts.trim ? value.trim() : value;
  const escaped = escapeRegex(raw);

  const pattern =
    mode === "exact"
      ? `^${escaped}$`
      : mode === "startsWith"
        ? `^${escaped}`
        : mode === "endsWith"
          ? `${escaped}$`
          : escaped; // contains

  const flags = opts.caseInsensitive ? "i" : "";
  return new RegExp(pattern, flags);
}
