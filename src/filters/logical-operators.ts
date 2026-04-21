/**
 * @file filters/logical-operators.ts
 * @description Utilities for parsing composite filter expressions with logical operators.
 */

import {
  expressionToSiftClause,
  parseFilterExpression,
} from "./filter-expression";

type LogicalOp = "and" | "or";

type Token =
  | { type: "clause"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "and" }
  | { type: "or" }
  | { type: "not" };

function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}

function tokenTypeFromWordOperator(operator: string): "and" | "or" | "not" {
  const lower = operator.toLowerCase();
  if (lower === "and") return "and";
  if (lower === "or") return "or";
  return "not";
}

function tokenizeLogicalExpression(expression: string): Token[] {
  const tokens: Token[] = [];

  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;

  const flushClause = () => {
    const trimmed = current.trim();
    if (trimmed) {
      tokens.push({ type: "clause", value: trimmed });
    }
    current = "";
  };

  while (i < expression.length) {
    const char = expression[i];

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

    if (char === "(") {
      flushClause();
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }

    if (char === ")") {
      flushClause();
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    if (expression.startsWith("&&", i)) {
      flushClause();
      tokens.push({ type: "and" });
      i += 2;
      continue;
    }

    if (expression.startsWith("||", i)) {
      flushClause();
      tokens.push({ type: "or" });
      i += 2;
      continue;
    }

    if (char === "!" && expression[i + 1] !== "=") {
      flushClause();
      tokens.push({ type: "not" });
      i++;
      continue;
    }

    const remaining = expression.substring(i);
    const logicalMatch = remaining.match(/^(and|or|not)\b/i);
    if (logicalMatch) {
      const operator = logicalMatch[1];
      const prevChar = i > 0 ? expression[i - 1] : " ";
      const prevIsWord = isWordChar(prevChar);

      if (!prevIsWord) {
        flushClause();
        tokens.push({ type: tokenTypeFromWordOperator(operator) });
        i += operator.length;
        continue;
      }
    }

    current += char;
    i++;
  }

  flushClause();

  return tokens;
}

function combineLogicalClauses(
  operator: LogicalOp,
  left: any,
  right: any,
): any {
  if (operator === "and") {
    const leftAnd = left && typeof left === "object" && "$and" in left;
    if (leftAnd && Array.isArray(left.$and)) {
      return { $and: [...left.$and, right] };
    }
    return { $and: [left, right] };
  }

  const leftOr = left && typeof left === "object" && "$or" in left;
  if (leftOr && Array.isArray(left.$or)) {
    return { $or: [...left.$or, right] };
  }
  return { $or: [left, right] };
}

class LogicalExpressionParser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
    },
  ) {}

  parse(): any {
    if (this.tokens.length === 0) {
      throw new Error('No valid expressions found in filter: ""');
    }

    const clause = this.parseOr();
    if (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      throw new Error(
        `Unexpected token in filter expression near "${token.type}".`,
      );
    }
    return clause;
  }

  private parseOr(): any {
    let left = this.parseAnd();

    while (this.match("or")) {
      const right = this.parseAnd();
      left = combineLogicalClauses("or", left, right);
    }

    return left;
  }

  private parseAnd(): any {
    let left = this.parseUnary();

    while (this.match("and")) {
      const right = this.parseUnary();
      left = combineLogicalClauses("and", left, right);
    }

    return left;
  }

  private parseUnary(): any {
    if (this.match("not")) {
      const inner = this.parseUnary();
      return { $nor: [inner] };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): any {
    if (this.match("lparen")) {
      const inner = this.parseOr();
      if (!this.match("rparen")) {
        throw new Error("Mismatched parentheses in filter expression.");
      }
      return inner;
    }

    const token = this.consume("clause");
    const { field, operator, value } = parseFilterExpression(token.value);
    return expressionToSiftClause(field, operator, value, this.options);
  }

  private consume<T extends Token["type"]>(
    type: T,
  ): Extract<Token, { type: T }> {
    const token = this.tokens[this.index];
    if (!token || token.type !== type) {
      throw new Error(
        `Unexpected token in filter expression. Expected ${type}.`,
      );
    }
    this.index++;
    return token as Extract<Token, { type: T }>;
  }

  private match(type: Token["type"]): boolean {
    const token = this.tokens[this.index];
    if (!token || token.type !== type) {
      return false;
    }
    this.index++;
    return true;
  }
}

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
  const tokens = tokenizeLogicalExpression(expression);
  const expressions: string[] = [];
  const operators: ("and" | "or")[] = [];

  let current = "";
  let depth = 0;

  for (const token of tokens) {
    if (token.type === "lparen") {
      depth++;
      current += "(";
      continue;
    }

    if (token.type === "rparen") {
      depth = Math.max(0, depth - 1);
      current += ")";
      continue;
    }

    if (depth === 0 && (token.type === "and" || token.type === "or")) {
      expressions.push(current.trim());
      operators.push(token.type);
      current = "";
      continue;
    }

    if (token.type === "clause") {
      current += (current ? " " : "") + token.value;
      continue;
    }

    if (token.type === "not") {
      current += (current ? " " : "") + "not";
      continue;
    }
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
  options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
): any {
  const tokens = tokenizeLogicalExpression(expression);

  if (tokens.length === 0) {
    throw new Error(`No valid expressions found in filter: "${expression}"`);
  }

  return new LogicalExpressionParser(tokens, options).parse();
}
