/**
 * @file filters/filter-expression.ts
 * @description Utilities for parsing and converting filter expressions to sift clauses.
 */

import { escapeRegex } from "../helpers/regex";

/**
 * Parses a filter expression string and extracts the field, operator, and value.
 * Supports: ==, !=, >, >=, <, <=, contains, startsWith, endsWith
 *
 * @example "status == 'Active'"
 * @example "price >= 1000"
 * @example "description contains 'test'"
 *
 * @internal
 */
export function parseFilterExpression(expression: string): {
  field: string;
  operator: string;
  value: any;
} {
  // Match patterns like: field operator value
  // Handles: ==, !=, >=, <=, >, <, not, contains, startsWith, endsWith
  const match = expression.match(
    /^\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s+(===?|!==?|>=|<=|>|<|not|contains|startsWith|endsWith)\s+(.+)$/,
  );

  if (!match) {
    throw new Error(
      `Invalid filter expression: "${expression}". Expected format: "field operator value" (e.g., "status == 'Active'")`,
    );
  }

  const [, field, operator, valueStr] = match;

  // Parse the value (handle strings in quotes and numbers)
  let value: any;
  const trimmedVal = valueStr.trim();

  if (
    (trimmedVal.startsWith('"') && trimmedVal.endsWith('"')) ||
    (trimmedVal.startsWith("'") && trimmedVal.endsWith("'"))
  ) {
    // String literal
    value = trimmedVal.slice(1, -1);
  } else if (!Number.isNaN(Number(trimmedVal)) && trimmedVal !== "") {
    // Number
    value = Number(trimmedVal);
  } else if (trimmedVal === "true" || trimmedVal === "false") {
    // Boolean
    value = trimmedVal === "true";
  } else if (trimmedVal === "null") {
    value = null;
  } else if (trimmedVal === "undefined") {
    value = undefined;
  } else {
    // Treat as string without quotes
    value = trimmedVal;
  }

  return { field, operator: operator.toLowerCase(), value };
}

/**
 * Converts a parsed filter expression into a sift query clause.
 * Handles both simple expressions and composite expressions with "and"/"or" operators.
 *
 * @internal
 */
export function expressionToSiftClause(
  field: string,
  operator: string,
  value: any,
  options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
): any {
  const flags = options?.caseSensitive ? "" : "i";
  const shouldTrim = options?.trim !== false; // default true

  switch (operator) {
    case "==":
    case "===":
      // Handle decimal precision for numeric comparisons
      if (options?.decimals !== undefined && typeof value === "number") {
        const decimals = options.decimals;
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this[field];
              if (typeof fieldValue !== "number") return false;
              const rounded1 =
                Math.round(fieldValue * 10 ** decimals) / 10 ** decimals;
              const rounded2 =
                Math.round(value * 10 ** decimals) / 10 ** decimals;
              return rounded1 === rounded2;
            },
          },
        };
      }
      return { [field]: value };
    case "!=":
    case "!==":
    case "not":
      // Handle decimal precision for numeric comparisons
      if (options?.decimals !== undefined && typeof value === "number") {
        const decimals = options.decimals;
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this[field];
              if (typeof fieldValue !== "number") return true;
              const rounded1 =
                Math.round(fieldValue * 10 ** decimals) / 10 ** decimals;
              const rounded2 =
                Math.round(value * 10 ** decimals) / 10 ** decimals;
              return rounded1 !== rounded2;
            },
          },
        };
      }
      return { [field]: { $ne: value } };
    case ">":
      return { [field]: { $gt: value } };
    case ">=":
      return { [field]: { $gte: value } };
    case "<":
      return { [field]: { $lt: value } };
    case "<=":
      return { [field]: { $lte: value } };
    case "contains": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      return { [field]: new RegExp(escapeRegex(processed), flags) };
    }
    case "startswith": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      return { [field]: new RegExp(`^${escapeRegex(processed)}`, flags) };
    }
    case "endswith": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      return { [field]: new RegExp(`${escapeRegex(processed)}$`, flags) };
    }
    default:
      throw new Error(`Unknown operator: "${operator}"`);
  }
}
