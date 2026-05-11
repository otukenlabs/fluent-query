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
  // Handles:
  // - Symbol operators with optional spacing: ==, !=, >=, <=, >, <
  // - Word operators with natural spacing: not, contains, startsWith, endsWith
  const symbolMatch = expression.match(
    /^\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(===?|!==?|>=|<=|>|<)\s*(.+)$/,
  );
  const wordMatch = expression.match(
    /^\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s+(contains|startsWith|endsWith)\s*(.+)$/i,
  );
  const match = symbolMatch ?? wordMatch;

  if (!match) {
    if (/\bnot\b/i.test(expression)) {
      throw new Error(
        `Invalid filter expression: "${expression}". Binary "not" is not supported. Use "!=" instead (e.g., "status != 'Active'").`,
      );
    }

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
  options?: {
    ignoreCase?: boolean;
    trim?: boolean;
    decimals?: number;
    coerceNumericStrings?: boolean;
  },
): any {
  const flags = options?.ignoreCase === false ? "" : "i";
  const shouldTrim = options?.trim !== false; // default true
  const shouldCoerceNumericStrings = options?.coerceNumericStrings !== false;

  switch (operator) {
    case "==":
    case "===":
      // Keep decimal precision behavior as-is when decimals option is provided
      if (options?.decimals !== undefined && typeof value === "number") {
        const decimals = options.decimals;
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this?.[field];
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

      // For numeric values WITHOUT decimals, support numeric-string coercion
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this?.[field];

              // Nullish field values don't match
              if (fieldValue === null || fieldValue === undefined) {
                return false;
              }

              // Direct number match
              if (
                typeof fieldValue === "number" &&
                Number.isFinite(fieldValue)
              ) {
                return fieldValue === value;
              }

              // Numeric string match
              if (typeof fieldValue === "string") {
                const trimmed = fieldValue.trim();
                const parsed = Number(trimmed);
                if (Number.isFinite(parsed)) {
                  return parsed === value;
                }
              }

              return false;
            },
          },
        };
      }

      return { [field]: value };
    case "!=":
    case "!==":
      // Keep decimal precision behavior as-is when decimals option is provided
      if (options?.decimals !== undefined && typeof value === "number") {
        const decimals = options.decimals;
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this?.[field];
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

      // For numeric values WITHOUT decimals, support numeric-string coercion
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          [field]: {
            $where: function (this: any) {
              const fieldValue = this?.[field];

              // Nullish field values don't match (treated as not equal)
              if (fieldValue === null || fieldValue === undefined) {
                return true;
              }

              // Direct number match
              if (
                typeof fieldValue === "number" &&
                Number.isFinite(fieldValue)
              ) {
                return fieldValue !== value;
              }

              // Numeric string match
              if (typeof fieldValue === "string") {
                const trimmed = fieldValue.trim();
                const parsed = Number(trimmed);
                if (Number.isFinite(parsed)) {
                  return parsed !== value;
                }
              }

              // Non-numeric values are not equal to the number
              return true;
            },
          },
        };
      }

      return { [field]: { $ne: value } };
    case ">":
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          $where: function (this: any) {
            let fieldValue: any;
            try {
              fieldValue = field === "" ? this : this[field];
            } catch {
              return false;
            }

            if (fieldValue === null || fieldValue === undefined) {
              return false;
            }

            if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
              return fieldValue > value;
            }

            if (typeof fieldValue === "string") {
              const trimmed = fieldValue.trim();
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed)) {
                return parsed > value;
              }
            }

            return false;
          },
        };
      }
      return { [field]: { $gt: value } };
    case ">=":
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          $where: function (this: any) {
            let fieldValue: any;
            try {
              fieldValue = field === "" ? this : this[field];
            } catch {
              return false;
            }

            if (fieldValue === null || fieldValue === undefined) {
              return false;
            }

            if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
              return fieldValue >= value;
            }

            if (typeof fieldValue === "string") {
              const trimmed = fieldValue.trim();
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed)) {
                return parsed >= value;
              }
            }

            return false;
          },
        };
      }
      return { [field]: { $gte: value } };
    case "<":
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          $where: function (this: any) {
            let fieldValue: any;
            try {
              fieldValue = field === "" ? this : this[field];
            } catch {
              return false;
            }

            if (fieldValue === null || fieldValue === undefined) {
              return false;
            }

            if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
              return fieldValue < value;
            }

            if (typeof fieldValue === "string") {
              const trimmed = fieldValue.trim();
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed)) {
                return parsed < value;
              }
            }

            return false;
          },
        };
      }
      return { [field]: { $lt: value } };
    case "<=":
      if (
        shouldCoerceNumericStrings &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return {
          $where: function (this: any) {
            let fieldValue: any;
            try {
              fieldValue = field === "" ? this : this[field];
            } catch {
              return false;
            }

            if (fieldValue === null || fieldValue === undefined) {
              return false;
            }

            if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
              return fieldValue <= value;
            }

            if (typeof fieldValue === "string") {
              const trimmed = fieldValue.trim();
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed)) {
                return parsed <= value;
              }
            }

            return false;
          },
        };
      }
      return { [field]: { $lte: value } };
    case "contains": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      return { [field]: new RegExp(escapeRegex(processed), flags) };
    }
    case "startswith": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      const leadingBoundary = shouldTrim ? "\\s*" : "";
      return {
        [field]: new RegExp(
          `^${leadingBoundary}${escapeRegex(processed)}`,
          flags,
        ),
      };
    }
    case "endswith": {
      const str = String(value);
      const processed = shouldTrim ? str.trim() : str;
      const trailingBoundary = shouldTrim ? "\\s*" : "";
      return {
        [field]: new RegExp(
          `${escapeRegex(processed)}${trailingBoundary}$`,
          flags,
        ),
      };
    }
    default:
      throw new Error(`Unknown operator: "${operator}"`);
  }
}
