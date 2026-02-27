/**
 * @file filters/logical-operators.ts
 * @description Utilities for parsing composite filter expressions with logical operators.
 */

import {
  parseFilterExpression,
  expressionToSiftClause,
} from "./filter-expression";

/**
 * Splits a filter expression by "and" or "or" logical operators (case-insensitive).
 * Respects quoted strings to avoid splitting within them.
 *
 * @internal
 */
export function splitLogicalOperators(expression: string): {
  expressions: string[];
  operators: ("and" | "or")[];
} {
  const expressions: string[] = [];
  const operators: ("and" | "or")[] = [];

  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    // Track quoted strings
    if (
      (char === '"' || char === "'") &&
      (i === 0 || expression[i - 1] !== "\\")
    ) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      current += char;
      i++;
      continue;
    }

    if (inQuotes) {
      current += char;
      i++;
      continue;
    }

    // Check for "and" or "or" operators
    const remaining = expression.substring(i).toLowerCase();
    if (remaining.startsWith(" and ")) {
      expressions.push(current.trim());
      operators.push("and");
      current = "";
      i += 5;
      continue;
    }
    if (remaining.startsWith(" or ")) {
      expressions.push(current.trim());
      operators.push("or");
      current = "";
      i += 4;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) {
    expressions.push(current.trim());
  }

  return { expressions, operators };
}

/**
 * Parses a composite filter expression and converts it to a sift query.
 * Handles logical operators: "and", "or" (case-insensitive).
 *
 * @example "city == 'New York' and age > 30"
 * @example "status == 'Active' or status == 'Pending'"
 *
 * @internal
 */
export function parseCompositeFilterExpression(
  expression: string,
  options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
): any {
  const { expressions, operators } = splitLogicalOperators(expression);

  if (expressions.length === 0) {
    throw new Error(`No valid expressions found in filter: "${expression}"`);
  }

  if (expressions.length === 1) {
    // Single expression, no logical operators
    const { field, operator, value } = parseFilterExpression(expressions[0]);
    return expressionToSiftClause(field, operator, value, options);
  }

  // Multiple expressions with logical operators
  const clauses = expressions.map((expr) => {
    const { field, operator, value } = parseFilterExpression(expr);
    return expressionToSiftClause(field, operator, value, options);
  });

  // Build the query using $and and $or
  // Handle mixed operators (though recommended to use parentheses in future)
  // For now, we process left-to-right: all "and" have higher precedence
  let result = clauses[0];

  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const nextClause = clauses[i + 1];

    if (op === "and") {
      // Merge AND clauses
      result = { $and: [result, nextClause] };
    } else if (op === "or") {
      // Create OR clause
      result = { $or: [result, nextClause] };
    }
  }

  return result;
}
