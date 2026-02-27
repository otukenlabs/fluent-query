/**
 * @file core/array-query.ts
 * @description ArrayQuery class for fluent array filtering and transformations.
 */

import sift from "sift";
import { ArrayQueryMetadata, Primitive } from "../types";
import { getByPath } from "../helpers/path";
import { parseCompositeFilterExpression } from "../filters/logical-operators";
import { WhereBuilder } from "./where-builder";
import { AggregateQuery } from "../queries/aggregate-query";
import { ValueArrayQuery } from "../queries/value-array-query";
import { PathQuery } from "../queries/path-query";
import { IndexQuery } from "../queries/index-query";

/**
 * Fluent query wrapper around an array.
 *
 * You typically do:
 *
 * ```ts
 * query(resp).array('items')...
 * ```
 *
 * @typeParam TItem - The type of each item in the array.
 */
export class ArrayQuery<TItem> {
  private readonly clauses: any[] = [];
  private readonly metadata?: ArrayQueryMetadata;

  constructor(
    private readonly items: TItem[],
    metadata?: ArrayQueryMetadata,
  ) {
    this.metadata = metadata;
  }

  /**
   * Adds a raw sift query for advanced use cases.
   *
   * This is the escape hatch for `$or`, `$in`, etc.
   *
   * @example OR query
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .whereSift({ $or: [{ type: /pre/i }, { type: /basic/i }] })
   * .all();
   * ```
   *
   * @param siftQuery - A query object compatible with sift (Mongo-like syntax).
   * @returns this (chainable)
   */
  whereSift(siftQuery: any): this {
    this.clauses.push(siftQuery);
    return this;
  }

  /**
   * Applies a filter using a DSL expression with comparison operators.
   * Parses expressions like "field == value", "field > 100", "field contains 'text'", etc.
   *
   * Supported operators:
   * - `==` or `===` → exact match
   * - `!=` or `!==` or `not` → not equal
   * - `>` → greater than (numeric)
   * - `>=` → greater than or equal
   * - `<` → less than (numeric)
   * - `<=` → less than or equal
   * - `contains` → substring match (case-insensitive by default, trims by default)
   * - `startsWith` → prefix match (case-insensitive by default, trims by default)
   * - `endsWith` → suffix match (case-insensitive by default, trims by default)
   *
   * Values can be:
   * - String literals: `'Active'` or `"Active"`
   * - Numbers: `1000`
   * - Booleans: `true` or `false`
   * - `null`
   * - `undefined`
   * - Unquoted strings: `Active` (treated as string)
   *
   * @example Exact match
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter("type == 'Premium'")
   *   .all();
   * ```
   *
   * @example Numeric comparison
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter('price >= 100')
   *   .all();
   * ```
   *
   * @example String contains (case-insensitive, default)
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter("description contains 'deluxe'")
   *   .all();
   * ```
   *
   * @example String contains (case-sensitive)
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter("description contains 'Deluxe'", { caseSensitive: true })
   *   .all();
   * ```
   *
   * @example String without trimming
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter("code startsWith ' ABC'", { trim: false })
   *   .all();
   * ```
   *
   * @example Multiple filters (chainable)
   * ```ts
   * query(resp)
   *   .array('items')
   *   .filter("type == 'Premium'")
   *   .filter('price >= 100')
   *   .all();
   * ```
   *
   * @example Multiple conditions with "and"
   * ```ts
   * query(resp)
   *   .array('people')
   *   .filter("city == 'New York' and age > 30")
   *   .all();
   * ```
   *
   * @example Multiple conditions with "or"
   * ```ts
   * query(resp)
   *   .array('people')
   *   .filter("status == 'Active' or status == 'Pending'")
   *   .all();
   * ```
   *
   * @param expression - Filter expression string (e.g., "field == value" or "field == value and field2 == value2")
   * @param options - Optional options:
   *   - caseSensitive: for string operations
   *   - trim: for string operations
   *   - decimals: number of decimal places for numeric equality (e.g., decimals: 2 rounds to 2 decimal places)
   * @returns this (chainable)
   * @throws Error if the expression format is invalid
   */
  filter(
    expression: string,
    options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
  ): this {
    const clause = parseCompositeFilterExpression(expression, options);
    return this._pushClause(clause);
  }

  /**
   * Conditionally applies a filter() only if the expression is not null/undefined.
   * Useful for optional filtering without nested if statements.
   *
   * - If expression is provided (not null/undefined/empty): adds a filter() for that expression
   * - If expression is null/undefined/empty: skips the filter entirely and continues with previous filters
   *
   * @example With expression provided
   * ```ts
   * const typeFilter = userInput ? "type == 'Premium'" : null;
   * const result = query(resp)
   *   .array('items')
   *   .filterIfPresent(typeFilter)  // Only filters if typeFilter provided
   *   .all();
   * ```
   *
   * @example Without expression (null/undefined)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .filterIfPresent(null)  // No filter added
   *   .all();
   * ```
   *
   * @example With options
   * ```ts
   * const descriptionFilter = someCondition ? "description contains 'deluxe'" : null;
   * const result = query(resp)
   *   .array('items')
   *   .filterIfPresent(descriptionFilter, { caseSensitive: true })
   *   .all();
   * ```
   *
   * @param expression - Filter expression string, or null/undefined to skip. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional options (caseSensitive, trim for string operations, decimals for numeric precision)
   * @returns this (chainable)
   */
  filterIfPresent(
    expression: string | null | undefined,
    options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
  ): this {
    if (expression !== null && expression !== undefined && expression !== "") {
      this.filter(expression, options);
    }
    return this;
  }

  /**
   * Begins a where clause on a property path (supports nested dot-paths).
   *
   * @example
   * ```ts
   * query(resp)
   * .array('items')
   * .where('type')
   * .contains('pre')
   * .all();
   * ```
   *
   * @param path - Field path (e.g. `"category"` or `"customer.relationship.description"`).
   * @returns A {@link WhereBuilder} that configures matching behavior for this clause.
   */
  where(path: string): WhereBuilder<TItem> {
    return new WhereBuilder<TItem>(this, path);
  }

  /**
   * Begins a negated where clause on a property path.
   *
   * @example
   * ```ts
   * query(resp)
   * .array('items')
   * .whereNot('type')
   * .equals('Basic')
   * .all();
   * ```
   */
  whereNot(path: string): WhereBuilder<TItem> {
    return new WhereBuilder<TItem>(this, path, true);
  }

  /**
   * Conditionally applies a where().equals() filter only if the value is not null/undefined.
   * Useful for optional filtering without nested if statements.
   *
   * - If value is provided (not null/undefined): adds a where().equals() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example With value provided
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .where('type')
   * .equals('premium')
   * .whereIfPresent('code', itemCode)  // Adds filter: code === itemCode (if itemCode provided)
   * .random();
   * ```
   *
   * @example Without value (null/undefined)
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .where('type')
   * .equals('premium')
   * .whereIfPresent('code', null)  // No filter added; uses only the type filter
   * .random();
   * ```
   *
   * @example With case-sensitive matching
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .whereIfPresent('type', typeFilter, { ignoreCase: false })  // Case-sensitive if provided
   * .random();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Value to match. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  whereIfPresent(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase === false) builder.caseSensitive();
      if (options?.trim === false) builder.noTrim();
      builder.equals(value);
    }
    return this;
  }

  /**
   * Conditionally applies a whereNot().equals() filter only if the value is not null/undefined.
   * Useful for optional negated filtering without manual if statements.
   *
   * - If value is provided (not null/undefined): adds a whereNot().equals() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example With value provided
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .whereNotIfPresent('id', excludeId) // Excludes id if excludeId provided
   *   .all();
   * ```
   *
   * @example Without value (null/undefined)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .whereNotIfPresent('id', null) // No filter added
   *   .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .whereNotIfPresent('type', excludeType, { ignoreCase: false })
   *   .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Value to exclude. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  whereNotIfPresent(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.whereNot(path);
      if (options?.ignoreCase === false) builder.caseSensitive();
      if (options?.trim === false) builder.noTrim();
      builder.equals(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().greaterThan() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().greaterThan() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .where('type')
   * .equals('premium')
   * .greaterThanIfPresent('price', minPrice)  // Only filters if minPrice provided
   * .all();
   * ```
   *
   * @param path - Field path to compare
   * @param value - Numeric threshold. If null/undefined, the filter is skipped and the query continues unchanged.
   * @returns this (chainable)
   */
  greaterThanIfPresent(path: string, value: number | null | undefined): this {
    if (value !== null && value !== undefined) {
      this.where(path).greaterThan(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().greaterThanOrEqual() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().greaterThanOrEqual() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .greaterThanOrEqualIfPresent('price', minPrice)
   * .all();
   * ```
   *
   * @param path - Field path to compare
   * @param value - Numeric threshold. If null/undefined, the filter is skipped and the query continues unchanged.
   * @returns this (chainable)
   */
  greaterThanOrEqualIfPresent(
    path: string,
    value: number | null | undefined,
  ): this {
    if (value !== null && value !== undefined) {
      this.where(path).greaterThanOrEqual(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().lessThan() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().lessThan() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .lessThanIfPresent('price', maxPrice)
   * .all();
   * ```
   *
   * @param path - Field path to compare
   * @param value - Numeric threshold. If null/undefined, the filter is skipped and the query continues unchanged.
   * @returns this (chainable)
   */
  lessThanIfPresent(path: string, value: number | null | undefined): this {
    if (value !== null && value !== undefined) {
      this.where(path).lessThan(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().lessThanOrEqual() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().lessThanOrEqual() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .lessThanOrEqualIfPresent('price', maxPrice)
   * .all();
   * ```
   *
   * @param path - Field path to compare
   * @param value - Numeric threshold. If null/undefined, the filter is skipped and the query continues unchanged.
   * @returns this (chainable)
   */
  lessThanOrEqualIfPresent(
    path: string,
    value: number | null | undefined,
  ): this {
    if (value !== null && value !== undefined) {
      this.where(path).lessThanOrEqual(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().contains() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().contains() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .containsIfPresent('description', descFilter)  // Only filters if descFilter provided
   * .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Substring to search for. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  containsIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.contains(value);
    }
    return this;
  }

  /**
   * Conditionally applies a negated contains filter only if the value is not null/undefined.
   * Useful for excluding items containing a substring if the parameter is provided.
   *
   * - If value is provided (not null/undefined): adds a where(path).not().contains(value) filter
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example With value provided
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notContainsIfPresent('type', excludeSubstring)
   *   .all();
   * ```
   *
   * @example Without value (null/undefined)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notContainsIfPresent('type', null)
   *   .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notContainsIfPresent('type', excludeSubstring, { ignoreCase: false })
   *   .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Substring to exclude. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  notContainsIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.contains(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().startsWith() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().startsWith() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .startsWithIfPresent('code', prefix)
   * .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Prefix to match. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  startsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.startsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies a negated startsWith filter only if the value is not null/undefined.
   * Useful for excluding items starting with a prefix if the parameter is provided.
   *
   * - If value is provided (not null/undefined): adds a where(path).not().startsWith(value) filter
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example With value provided
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notStartsWithIfPresent('code', excludePrefix)
   *   .all();
   * ```
   *
   * @example Without value (null/undefined)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notStartsWithIfPresent('code', null)
   *   .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notStartsWithIfPresent('code', excludePrefix, { ignoreCase: false })
   *   .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Prefix to exclude. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  notStartsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.startsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies a where().endsWith() filter only if the value is not null/undefined.
   *
   * - If value is provided (not null/undefined): adds a where().endsWith() filter for that path/value
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example
   * ```ts
   * const result = query(resp)
   * .array('items')
   * .endsWithIfPresent('code', suffix)
   * .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Suffix to match. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  endsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.endsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies a negated endsWith filter only if the value is not null/undefined.
   * Useful for excluding items ending with a suffix if the parameter is provided.
   *
   * - If value is provided (not null/undefined): adds a where(path).not().endsWith(value) filter
   * - If value is null/undefined: skips the filter entirely and continues with previous filters
   *
   * @example With value provided
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notEndsWithIfPresent('code', excludeSuffix)
   *   .all();
   * ```
   *
   * @example Without value (null/undefined)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notEndsWithIfPresent('code', null)
   *   .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const result = query(resp)
   *   .array('items')
   *   .notEndsWithIfPresent('code', excludeSuffix, { ignoreCase: false })
   *   .all();
   * ```
   *
   * @param path - Field path to match against
   * @param value - Suffix to exclude. If null/undefined, the filter is skipped and the query continues unchanged.
   * @param options - Optional matching options (ignoreCase, trim)
   * @returns this (chainable)
   */
  notEndsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): this {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      builder.endsWith(value);
    }
    return this;
  }

  /**
   * Filters items where the value at `path` is included in the provided list.
   *
   * @example
   * ```ts
   * const allowed = ["Premium", "Deluxe"];
   * const results = query(resp.data)
   * .array('items')
   * .whereIn('type', allowed)
   * .all();
   * ```
   * @throws Error if empty array is passed as values.
   */
  whereIn(path: string, values: Primitive[]): this {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereIn("${path}") requires a non-empty array of values.`,
      );
    }
    this.clauses.push({ [path]: { $in: values } });
    return this;
  }

  /**
   * Filters items where all provided field-value pairs match exactly.
   * Useful for finding an object by multiple criteria.
   *
   * @example
   * ```ts
   * const item = query(resp.data)
   * .array('items')
   * .whereAll({ type: 'Premium', inStock: true })
   * .first();
   * ```
   *
   * @param criteria - Object with field paths and expected values (exact match).
   * @throws Error if no matches are found when chained with `.first()`, `.one()`, etc.
   */
  whereAll(criteria: Record<string, Primitive>): this {
    this.clauses.push(criteria);
    return this;
  }

  /**
   * Sorts the array items by the value at the given path.
   * Can sort in ascending (default) or descending order.
   * Handles null/undefined values by placing them at the end.
   *
   * @example Sort ascending (default)
   * ```ts
   * const items = query(data)
   *   .array('items')
   *   .sort('price')
   *   .all();
   * // => Items sorted by price from lowest to highest
   * ```
   *
   * @example Sort descending
   * ```ts
   * const items = query(data)
   *   .array('items')
   *   .sort('price', 'desc')
   *   .all();
   * // => Items sorted by price from highest to lowest
   * ```
   *
   * @example Chaining with filters
   * ```ts
   * const items = query(data)
   *   .array('items')
   *   .where('category').equals('Premium')
   *   .sort('price')
   *   .all();
   * // => Premium items sorted by price
   * ```
   *
   * @param path - Field path to sort by (supports dot notation for nested fields)
   * @param direction - Sort direction: 'asc' (default) or 'desc'
   * @returns this (chainable)
   */
  sort(path: string, direction: "asc" | "desc" = "asc"): this {
    // Store sort configuration for later use in terminal methods
    (this as any)._sortPath = path;
    (this as any)._sortDirection = direction;
    return this;
  }

  /**
   * @internal
   */
  private _applySorting(items: TItem[]): TItem[] {
    const sortPath = (this as any)._sortPath;
    const sortDirection = (this as any)._sortDirection || "asc";

    if (!sortPath) {
      return items;
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      const valueA = getByPath(a as any, sortPath);
      const valueB = getByPath(b as any, sortPath);

      // Handle null/undefined - place them at the end
      if (valueA === null || valueA === undefined) {
        return valueB === null || valueB === undefined ? 0 : 1;
      }
      if (valueB === null || valueB === undefined) {
        return -1;
      }

      // Compare values
      let comparison = 0;
      if (valueA < valueB) {
        comparison = -1;
      } else if (valueA > valueB) {
        comparison = 1;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Returns all matches.
   *
   * If no filters are added, returns the original array items.
   */
  all(): TItem[] {
    let results: TItem[];
    if (this.clauses.length === 0) {
      results = this.items;
    } else {
      const combined =
        this.clauses.length === 1 ? this.clauses[0] : { $and: this.clauses };
      results = this.items.filter(sift(combined));
    }

    return this._applySorting(results);
  }

  /**
   * Returns the number of matching items.
   * Useful for assertions.
   */
  count(): number {
    return this.all().length;
  }

  /**
   * Returns true if at least one item matches the filters.
   *
   * @example
   * ```ts
   * const hasItems = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .exists();
   * // → true if any item is Premium
   * ```
   *
   * @example With conditionals
   * ```ts
   * if (query(data).array('errors').where('severity').equals('critical').exists()) {
   *   handleCriticalError();
   * }
   * ```
   */
  exists(): boolean {
    return this.count() > 0;
  }

  /**
   * Returns true if all items in the array match the filters.
   *
   * @example
   * ```ts
   * const allComplete = query(resp)
   *   .array('items')
   *   .where('status').equals('completed')
   *   .every();
   * // → true only if ALL items are completed
   * ```
   *
   * @example With conditionals
   * ```ts
   * if (!query(data).array('items').where('isValid').equals(true).every()) {
   *   alert('Not all items are valid');
   * }
   * ```
   */
  every(): boolean {
    return this.count() === this.items.length;
  }

  /**
   * Returns the sum of values at the given path for all matching items.
   *
   * @example
   * ```ts
   * const totalRevenue = query(resp)
   *   .array('items')
   *   .where('category').equals('premium')
   *   .sum('price');
   * // => 1500.50
   * ```
   *
   * @param path - Field path containing numeric values to sum
   * @returns Sum of all numeric values at the path
   */
  sum(path: string): number {
    const results = this.all();
    return results.reduce((total, item) => {
      const value = getByPath(item as any, path);
      const num = typeof value === "number" ? value : 0;
      return total + num;
    }, 0);
  }

  /**
   * Returns the average of values at the given path for all matching items.
   *
   * @example
   * ```ts
   * const avgPrice = query(resp)
   *   .array('items')
   *   .where('category').equals('premium')
   *   .average('price');
   * // => 312.50
   * ```
   *
   * @param path - Field path containing numeric values to average
   * @returns Average of all numeric values at the path
   */
  average(path: string): number {
    const results = this.all();
    if (results.length === 0) return 0;
    const total = this.sum(path);
    return total / results.length;
  }

  /**
   * Returns the minimum value at the given path for all matching items.
   *
   * @example
   * ```ts
   * const minPrice = query(resp)
   *   .array('items')
   *   .where('category').equals('premium')
   *   .min('price');
   * // => 150.00
   * ```
   *
   * @param path - Field path containing comparable values
   * @returns Minimum value at the path (null if no items)
   */
  min(path: string): number | null {
    const results = this.all();
    if (results.length === 0) return null;
    const values = results
      .map((item) => getByPath(item as any, path))
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number);
    return values.length > 0 ? Math.min(...values) : null;
  }

  /**
   * Returns the maximum value at the given path for all matching items.
   *
   * @example
   * ```ts
   * const maxPrice = query(resp)
   *   .array('items')
   *   .where('category').equals('premium')
   *   .max('price');
   * // => 750.00
   * ```
   *
   * @param path - Field path containing comparable values
   * @returns Maximum value at the path (null if no items)
   */
  max(path: string): number | null {
    const results = this.all();
    if (results.length === 0) return null;
    const values = results
      .map((item) => getByPath(item as any, path))
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number);
    return values.length > 0 ? Math.max(...values) : null;
  }

  /**
   * Returns the sum of products across multiple paths for all matching items.
   * For each item, multiplies the values at the given paths together, then sums all products.
   *
   * @example
   * ```ts
   * const totalValue = query(resp)
   *   .array('items')
   *   .where('status').equals('sold')
   *   .sumOfProducts('quantity', 'unitPrice');
   * // => 150000 (sum of quantity*unitPrice for all items)
   * ```
   *
   * @param paths - Field paths containing numeric values to multiply
   * @returns Sum of products across all items
   */
  sumOfProducts(...paths: string[]): number {
    if (paths.length === 0) {
      throw new Error("sumOfProducts() requires at least one path");
    }
    return this.all().reduce((sum, item) => {
      let productValue = 1;
      for (const path of paths) {
        const value = getByPath(item as any, path);
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(
            `Invalid number at path "${path}" for product calculation`,
          );
        }
        productValue *= num;
      }
      return sum + productValue;
    }, 0);
  }

  /**
   * Returns a chainable aggregation helper for building multiple aggregations at once.
   *
   * @example Single aggregation
   * ```ts
   * const total = query(resp)
   *   .array('items')
   *   .sum('price'); // Simple direct call
   * ```
   *
   * @example Multiple aggregations
   * ```ts
   * const stats = query(resp)
   *   .array('items')
   *   .where('type').equals('premium')
   *   .aggregate()
   *   .sum('price')
   *   .average('price')
   *   .min('price')
   *   .max('price')
   *   .count()
   *   .all();
   * // => { sum: 1500, average: 300, min: 100, max: 600, count: 5 }
   * ```
   *
   * @returns An {@link AggregateQuery} helper for chainable aggregations
   */
  aggregate(): AggregateQuery {
    return new AggregateQuery(this.all());
  }

  /**
   * Groups matching items by the value at the given path.
   * Returns an object where keys are the grouped values and values are arrays of items.
   *
   * @example Group by category
   * ```ts
   * const grouped = query(resp)
   *   .array('items')
   *   .groupBy('category');
   * // => {
   * //   "Premium": [{ category: 'Premium', name: 'Item1' }, { category: 'Premium', name: 'Item2' }],
   * //   "Basic": [{ category: 'Basic', name: 'Item3' }],
   * //   "Standard": [{ category: 'Standard', name: 'Item4' }]
   * // }
   * ```
   *
   * @example Group filtered results
   * ```ts
   * const inStockByType = query(resp)
   *   .array('items')
   *   .where('price').greaterThan(100)
   *   .groupBy('type');
   * // => { "Premium": [...], "Standard": [...] }
   * ```
   *
   * @example Group by nested path
   * ```ts
   * const byLocation = query(resp)
   *   .array('stores')
   *   .groupBy('address.country');
   * // => { "USA": [...], "Canada": [...] }
   * ```
   *
   * @param path - Field path to group by (supports dot notation for nested fields)
   * @returns Object with grouped items: `{ [groupValue]: TItem[] }`
   */
  groupBy(path: string): Record<string, TItem[]> {
    const results = this.all();
    const grouped: Record<string, TItem[]> = {};

    for (const item of results) {
      const groupValue = getByPath(item as any, path);
      const key = String(groupValue); // Convert to string for object key

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }

  /**
   * Returns distinct/unique items, keeping one item per unique value.
   *
   * When a `path` is provided, keeps the first item for each unique value at that path.
   * Without a path, removes duplicate items entirely (by object comparison).
   *
   * If `path` is a single property name (no dots), it searches that property at any depth
   * within each item. If multiple matches are found in the same item, it throws to avoid
   * ambiguity. Use a dot-path to disambiguate.
   *
   * @example Keep first item per unique category (removes duplicates but keeps one)
   * ```ts
   * const uniqueByCategory = query(resp)
   *   .array('items')
   *   .distinct('category');
   * // => [
   * //      { category: 'Premium', name: 'Item1', ... },     // First Premium item kept
   * //      { category: 'Basic', name: 'Item3', ... },       // First Basic item kept
   * //      { category: 'Standard', name: 'Item4', ... }     // First Standard item kept
   * //    ]
   * // If multiple items have the same category, only the first occurrence is kept
   * ```
   *
   * @example Keep first item per unique type
   * ```ts
   * const uniqueByType = query(resp)
   *   .array('items')
   *   .distinct('type');
   * // => [
   * //      { type: 'Premium', id: 101, ... },   // First Premium item kept
   * //      { type: 'Basic', id: 205, ... }      // First Basic item kept
   * //    ]
   * // Even if 15 items are Premium, only the first Premium item is returned
   * ```
   *
   * @example Remove all duplicate items (by entire object)
   * ```ts
   * const unique = query(resp)
   *   .array('items')
   *   .distinct();
   * // => Items with unique values (duplicates removed)
   * ```
   *
   * @param path - Optional field path to determine uniqueness. If omitted, uses entire item for comparison
   * @returns Array of distinct items
   */
  distinct(path?: string): TItem[] {
    const results = this.all();
    if (!path) {
      // Remove duplicate items entirely (by reference)
      return Array.from(new Set(results));
    }

    // Remove duplicates by property value
    const seen = new Set<any>();
    const unique: TItem[] = [];
    const isDotPath = path.includes(".");

    for (const item of results) {
      const value = isDotPath
        ? getByPath(item as any, path)
        : this._getUniqueDeepPropertyValue(item as any, path);
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * @internal
   * Finds a single matching property value anywhere in the object tree.
   * Throws if none or more than one match exists in the same item.
   */
  private _getUniqueDeepPropertyValue(obj: any, property: string): any {
    const matches: any[] = [];

    const visit = (node: any): void => {
      if (node === null || node === undefined) return;
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }
      if (typeof node !== "object") return;

      if (Object.prototype.hasOwnProperty.call(node, property)) {
        matches.push((node as any)[property]);
      }

      for (const child of Object.values(node)) {
        visit(child);
      }
    };

    visit(obj);

    if (matches.length === 0) {
      throw new Error(
        `Path "${property}" does not exist in item (deep search). Use a dot-path if needed.`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `Path "${property}" matched multiple values in an item. Use a dot-path to disambiguate.`,
      );
    }

    return matches[0];
  }

  /**
   * Returns a chainable helper for values at the given path for all matches.
   * Allows further operations like random(), first(), string(), number(), etc.
   *
   * @example Get all values
   * ```ts
   * const numbers = query(resp.result.data)
   * .array('items')
   * .pluck('id')
   * .all();
   * ```
   *
   * @example Chain operations
   * ```ts
   * const randomId = query(data)
   * .array('users')
   * .pluck('id')
   * .random();
   *
   * const stringIds = query(data)
   * .array('items')
   * .pluck('id')
   * .string()
   * .all();
   * // [1, 2, 3] → ['1', '2', '3']
   * ```
   */
  pluck<TValue = any>(path: string): ValueArrayQuery<TValue> {
    const values = this.all().map((item) =>
      getByPath(item as any, path),
    ) as TValue[];
    return new ValueArrayQuery(values);
  }

  /**
   * Recursively searches for a property or path at any depth and returns a chainable helper.
   * Unlike pluck(), which looks for a path from the array item root, findAll() searches
   * the entire object tree and finds the property/path anywhere it exists.
   *
   * **Warning**: If the same property/path appears in multiple places within an object structure,
   * findAll() will return ALL matching values. Use pluck() if you need a specific path from the root.
   *
   * @example Simple property name
   * ```ts
   * const data = [
   *   { "name": "Chris", "age": 23, "address": { "city": "New York" } },
   *   { "name": "Emily", "age": 19, "address": { "city": "Atlanta" } }
   * ];
   * query(data).arrayRoot().findAll('city').all();
   * // => ['New York', 'Atlanta']
   * ```
   *
   * @example Path notation (finds path anywhere in tree)
   * ```ts
   * const data = [
   *   {
   *     "orders": [{ "customer": { "address": { "city": "NYC" } } }],
   *     "metadata": { "customer": { "address": { "city": "Atlanta" } } }
   *   }
   * ];
   * query(data).arrayRoot().findAll('customer.address.city').all();
   * // => ['NYC', 'Atlanta'] // Finds BOTH, regardless of nesting level
   * ```
   *
   * @example Multiple occurrences of same key
   * ```ts
   * const data = [
   *   { "id": 1, "user": { "id": 100, "name": "Alice" } }
   * ];
   * query(data).arrayRoot().findAll('id').all();
   * // => [1, 100] // Returns BOTH id values!
   * ```
   *
   * @example Chaining operations
   * ```ts
   * const firstCity = query(data).arrayRoot().findAll('city').first();
   * const cityStrings = query(data).arrayRoot().findAll('zipCode').string().all();
   * ```
   *
   * @param pathOrProperty - Property name or dot-notation path to search for recursively
   * @returns ValueArrayQuery for chaining and conversion
   */
  findAll<TValue = any>(pathOrProperty: string): ValueArrayQuery<TValue> {
    const results: TValue[] = [];
    const isPath = pathOrProperty.includes(".");

    const recursiveSearch = (obj: any): void => {
      if (obj === null || obj === undefined) {
        return;
      }

      if (typeof obj === "object") {
        if (isPath) {
          // Check if this object has the complete path
          const value = getByPath(obj, pathOrProperty);
          if (value !== undefined) {
            results.push(value);
          }
        } else {
          // Check if this object has the property
          if (pathOrProperty in obj) {
            results.push(obj[pathOrProperty]);
          }
        }

        // Recursively search nested objects/arrays
        if (Array.isArray(obj)) {
          for (const item of obj) {
            recursiveSearch(item);
          }
        } else {
          for (const value of Object.values(obj)) {
            recursiveSearch(value);
          }
        }
      }
    };

    // Search through all matching items
    for (const item of this.all()) {
      recursiveSearch(item);
    }

    return new ValueArrayQuery(results);
  }

  /**
   * Picks one or more properties/paths from each matching item and returns a flat object per item.
   * Keys are the provided paths, or custom keys if using an object.
   *
   * @example Single path
   * ```ts
   * const ids = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .pick('id');
   * // => [{ "id": 1 }, { "id": 3 }]
   * ```
   *
   * @example Multiple paths
   * ```ts
   * const summaries = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .pick(['id', 'price.current']);
   * // => [{ "id": 1, "price.current": 500 }, ...]
   * ```
   *
   * @example With aliases (custom keys)
   * ```ts
   * const summaries = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .pick({ name: 'name', category: 'category.main' });
   * // => [{ "name": "Item1", "category": "Premium" }, ...]
   * ```
   */
  pick(
    pathOrPaths: string | string[] | Record<string, string>,
    ...rest: string[]
  ): Array<Record<string, any>> {
    return this.all().map((item) => {
      const result: Record<string, any> = {};

      if (typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)) {
        // Object format: { outputKey: 'path' }
        for (const [key, path] of Object.entries(pathOrPaths)) {
          result[key] = getByPath(item as any, path);
        }
      } else {
        // String or array format
        const paths = Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...rest];
        for (const path of paths) {
          result[path] = getByPath(item as any, path);
        }
      }

      return result;
    });
  }

  /**
   * Returns the first match.
   *
   * @throws Error if no matches are found.
   */
  first(): TItem {
    const results = this.all();
    if (results.length === 0) {
      throw new Error("No matches found for first().");
    }
    return results[0];
  }

  /**
   * Alias for {@link first} to clarify intent.
   *
   * @throws Error if no matches are found.
   */
  any(): TItem {
    return this.first();
  }

  /**
   * Returns a random match.
   *
   * @throws Error if no matches are found.
   */
  random(): TItem {
    const results = this.all();
    if (results.length === 0) {
      throw new Error("No matches found for random().");
    }
    const index = Math.floor(Math.random() * results.length);
    return results[index];
  }

  /**
   * Returns a random match with its full path from root as a tuple.
   * Throws if no matches found.
   * Works with both direct array queries (query().array()) and grouped array queries (query().objectGroups().arrays()).
   *
   * @example Direct array query
   * ```ts
   * const [item, path] = query(resp)
   * .array('items')
   * .where('type')
   * .equals('Premium')
   * .randomWithPath();
   *
   * // item = { type: 'Premium', ... }
   * // path = "items[2]"
   * ```
   *
   * @example Grouped array query
   * ```ts
   * const [item, path] = query(resp)
   * .objectGroups('sections')
   * .exclude(['archived', 'pending'])
   * .arrays('items')
   * .where('type')
   * .equals('Premium')
   * .randomWithPath();
   *
   * // item = { type: 'Premium', ... }
   * // path = "sections.active.items[2]"
   * ```
   *
   * @throws Error if no matches are found.
   */
  randomWithPath(): [TItem, string] {
    const results = this.all();
    if (results.length === 0) {
      throw new Error("No matches found for randomWithPath().");
    }
    const randomIndex = Math.floor(Math.random() * results.length);
    const item = results[randomIndex];

    // Simple case: direct array query (from query().array())
    if (
      !this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      !this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items;
      const unfilteredIndex = unfiltered.indexOf(item);
      const path =
        unfilteredIndex !== -1
          ? `${this.metadata.arrayPath}[${unfilteredIndex}]`
          : `${this.metadata.arrayPath}[${randomIndex}]`;
      return [item, path];
    }

    // Complex case: grouped array query (from query().objectGroups().arrays())
    if (
      this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items;
      const unfilteredIndex = unfiltered.indexOf(item);
      if (unfilteredIndex === -1) {
        return [item, `[${randomIndex}]`];
      }

      const itemMeta = this.metadata.itemMetadata[unfilteredIndex];
      if (!itemMeta) {
        return [item, `[${randomIndex}]`];
      }

      const path = `${this.metadata.groupsRootPath}.${itemMeta.groupKey}.${this.metadata.arrayPath}[${itemMeta.itemIndex}]`;
      return [item, path];
    }

    // Fallback: no path info available
    return [item, `[${randomIndex}]`];
  }

  /**
   * Returns the last match.
   *
   * @throws Error if no matches are found.
   */
  last(): TItem {
    const results = this.all();
    if (results.length === 0) {
      throw new Error("No matches found for last().");
    }
    return results[results.length - 1];
  }

  /**
   * Returns the nth match (by index in filtered results).
   *
   * @param index - Zero-based index of the item to return
   * @returns The item at the given index
   * @throws Error if index is out of bounds
   */
  nth(index: number): TItem {
    const results = this.all();
    if (index < 0 || index >= results.length) {
      throw new Error(
        `Index ${index} out of bounds. Found ${results.length} matches.`,
      );
    }
    return results[index];
  }

  /**
   * @internal
   * Helper to build the path for a given filtered item by its index.
   */
  private _buildPathForItem(item: TItem, filteredIndex: number): string {
    // Simple case: direct array query (from query().array())
    if (
      !this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      !this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items;
      const unfilteredIndex = unfiltered.indexOf(item);
      return unfilteredIndex !== -1
        ? `${this.metadata.arrayPath}[${unfilteredIndex}]`
        : `${this.metadata.arrayPath}[${filteredIndex}]`;
    }

    // Complex case: grouped array query (from query().objectGroups().arrays())
    if (
      this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items;
      const unfilteredIndex = unfiltered.indexOf(item);
      if (unfilteredIndex === -1) {
        return `[${filteredIndex}]`;
      }

      const itemMeta = this.metadata.itemMetadata[unfilteredIndex];
      if (!itemMeta) {
        return `[${filteredIndex}]`;
      }

      return `${this.metadata.groupsRootPath}.${itemMeta.groupKey}.${this.metadata.arrayPath}[${itemMeta.itemIndex}]`;
    }

    // Fallback: no path info available
    return `[${filteredIndex}]`;
  }

  /**
   * Returns a chainable path query helper.
   *
   * @example Get all matching paths
   * ```ts
   * const paths = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .path()
   *   .all(); // ["items[0]", "items[3]", "items[5]"]
   * ```
   *
   * @example Get first matching path
   * ```ts
   * const firstPath = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .path()
   *   .first(); // "items[0]"
   * ```
   *
   * @example Get last matching path
   * ```ts
   * const lastPath = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .path()
   *   .last(); // "items[5]"
   * ```
   *
   * @example Get random matching path
   * ```ts
   * const randomPath = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .path()
   *   .random(); // "items[3]"
   * ```
   *
   * @example Get nth matching path (by index in filtered results)
   * ```ts
   * const secondPath = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .path()
   *   .nth(1); // "items[3]" (2nd matching item)
   * ```
   *
   * @returns A {@link PathQuery} helper for chainable path operations
   */
  path(): PathQuery {
    const results = this.all();
    const paths = results.map((item, index) =>
      this._buildPathForItem(item, index),
    );
    return new PathQuery(paths);
  }

  /**
   * Requires exactly one match.
   *
   * @param message - Optional custom error message
   * @returns The single matching item
   * @throws Error if zero or more than one items match
   */
  one(message?: string): TItem {
    const results = this.all();
    if (results.length !== 1) {
      throw new Error(
        message ?? `Expected exactly 1 match, found ${results.length}.`,
      );
    }
    return results[0];
  }

  /**
   * Returns indices of all matching items as a chainable helper.
   * Use `.all()`, `.first()`, `.random()`, or `.one()` to get the result.
   *
   * @example Get all matching indices
   * ```ts
   * const indices = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .index()
   *   .all(); // [0, 3, 5]
   * ```
   *
   * @example Get first matching index
   * ```ts
   * const firstIdx = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .index()
   *   .first(); // 0
   * ```
   *
   * @example Get random matching index
   * ```ts
   * const randomIdx = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .index()
   *   .random(); // 3
   * ```
   *
   * @example Get exactly one matching index (throws if not exactly 1 match)
   * ```ts
   * const singleIdx = query(resp)
   *   .array('items')
   *   .filter("id == 123")
   *   .index()
   *   .one(); // 7
   * ```
   *
   * @returns An IndexQuery helper for chainable index operations.
   */
  index(): IndexQuery {
    const matchingIndices = this.all().map((item) => this.items.indexOf(item));
    return new IndexQuery(matchingIndices);
  }

  /**
   * Returns all matching items with their original array indices.
   * Result format: [[index, item], [index, item], ...]
   *
   * @example
   * ```ts
   * const itemsWithIdx = query(resp)
   *   .array('items')
   *   .where('type').equals('Premium')
   *   .allWithIndex();
   *
   * // Result: [[0, {id: 1, type: 'Premium'}], [3, {id: 4, type: 'Premium'}]]
   * ```
   *
   * @returns Array of [index, item] tuples for all matches.
   */
  allWithIndex(): Array<[number, TItem]> {
    return this.all().map((item) => [this.items.indexOf(item), item]);
  }

  /** @internal Used by {@link WhereBuilder} to append a clause. */
  _pushClause(clause: any): this {
    this.clauses.push(clause);
    return this;
  }
}
