/**
 * @file core/where-builder.ts
 * @description WhereBuilder class for fluent where clause construction.
 */

import { Primitive, WhereOptions } from "../types";
import { escapeRegex, makeRegex } from "../helpers/regex";
import type { ArrayQuery } from "./array-query";

/**
 * Builder for a single `where(path)` clause.
 *
 * This controls **how** values are compared (case sensitivity, partial match mode).
 *
 * `WhereBuilder` is created via {@link ArrayQuery.where}.
 *
 * @example Partial, case-insensitive match
 * ```ts
 * const results = query(resp)
 * .array('items')
 * .where('type')
 * .contains('pre')
 * .ignoreCase()
 * .all();
 * ```
 *
 * @example Exact match, case-sensitive
 * ```ts
 * const results = query(resp)
 * .array('items')
 * .where('type')
 * .caseSensitive()
 * .equals('Premium')
 * .all();
 * ```
 */
export class WhereBuilder<TItem, TMode extends "bound" | "unbound" = "bound"> {
  private opts: Required<WhereOptions> = { caseInsensitive: true, trim: true };
  private negate: boolean;

  constructor(
    private readonly parent: ArrayQuery<TItem, TMode>,
    private readonly path: string,
    negate: boolean = false,
  ) {
    this.negate = negate;
  }

  /**
   * Negates the current where clause.
   *
   * @example
   * ```ts
   * query(resp)
   * .array('items')
   * .where('type')
   * .not()
   * .equals('Premium')
   * .all();
   * ```
   */
  not(): this {
    this.negate = true;
    return this;
  }

  /**
   * Makes string matching case-insensitive for this clause.
   *
   * @defaultValue enabled by default
   */
  ignoreCase(): this {
    this.opts.caseInsensitive = true;
    return this;
  }

  /**
   * Makes string matching case-sensitive for this clause.
   */
  caseSensitive(): this {
    this.opts.caseInsensitive = false;
    return this;
  }

  /**
   * Trims input strings before building the match.
   *
   * @defaultValue enabled by default
   */
  trim(): this {
    this.opts.trim = true;
    return this;
  }

  /**
   * Disables trimming of input strings.
   */
  noTrim(): this {
    this.opts.trim = false;
    return this;
  }

  /**
   * Exact match:
   * - For strings: uses a regex if `ignoreCase()` is enabled (so it can be case-insensitive).
   * - For numbers/booleans: strict equality.
   *
   * @example Basic usage
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .equals('Premium')
   * .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .equals('Premium', { ignoreCase: false })
   * .all();
   * ```
   *
   * @param value - The value to match
   * @param options - Optional matching options (ignoreCase, trim)
   */
  equals(
    value: Primitive,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }
    if (typeof value === "string" && this.opts.caseInsensitive) {
      const regex = makeRegex(value, "exact", this.opts);
      return this.parent._pushClause({
        [this.path]: this.negate ? { $not: regex } : regex,
      });
    }
    if (this.negate) {
      return this.parent._pushClause({ [this.path]: { $ne: value } });
    }
    return this.parent._pushClause({ [this.path]: value });
  }

  /**
   * Alias for {@link equals}.
   */
  eq(
    value: Primitive,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    return this.equals(value, options);
  }

  /**
   * Alias for negated {@link equals}.
   */
  ne(
    value: Primitive,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    return this.not().equals(value, options);
  }

  /**
   * Partial "contains" match (string).
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .contains('pre')
   * .all();
   * ```
   *
   * @example With options (case-sensitive)
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .contains('Pre', { ignoreCase: false })
   * .all();
   * ```
   *
   * @param value - The substring to search for
   * @param options - Optional matching options (ignoreCase, trim)
   */
  contains(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }
    const regex = makeRegex(value, "contains", this.opts);
    return this.parent._pushClause({
      [this.path]: this.negate ? { $not: regex } : regex,
    });
  }

  /**
   * Prefix match (string).
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .startsWith('Pre')
   * .all();
   * ```
   *
   * @example With options
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .startsWith('Pre', { ignoreCase: false })
   * .all();
   * ```
   *
   * @param value - The prefix to match
   * @param options - Optional matching options (ignoreCase, trim)
   */
  startsWith(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }
    const regex = makeRegex(value, "startsWith", this.opts);
    return this.parent._pushClause({
      [this.path]: this.negate ? { $not: regex } : regex,
    });
  }

  /**
   * Suffix match (string).
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .endsWith('um')
   * .all();
   * ```
   *
   * @example With options
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .endsWith('um', { ignoreCase: false })
   * .all();
   * ```
   *
   * @param value - The suffix to match
   * @param options - Optional matching options (ignoreCase, trim)
   */
  endsWith(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }
    const regex = makeRegex(value, "endsWith", this.opts);
    return this.parent._pushClause({
      [this.path]: this.negate ? { $not: regex } : regex,
    });
  }

  /**
   * Advanced: supply your own RegExp.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .matches(/pre(mium)?/i)
   * .all();
   * ```
   */
  matches(regex: RegExp): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause({
      [this.path]: this.negate ? { $not: regex } : regex,
    });
  }

  /**
   * Greater than comparison for numeric fields.
   * Throws if the field value is not a number.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('price')
   * .greaterThan(100)
   * .all();
   * ```
   */
  greaterThan(value: number): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause({
      [this.path]: this.negate ? { $lte: value } : { $gt: value },
    });
  }

  /**
   * Alias for {@link greaterThan}.
   */
  gt(value: number): ArrayQuery<TItem, TMode> {
    return this.greaterThan(value);
  }

  /**
   * Greater than or equal comparison for numeric fields.
   * Throws if the field value is not a number.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('price')
   * .greaterThanOrEqual(100)
   * .all();
   * ```
   */
  greaterThanOrEqual(value: number): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause({
      [this.path]: this.negate ? { $lt: value } : { $gte: value },
    });
  }

  /**
   * Alias for {@link greaterThanOrEqual}.
   */
  gte(value: number): ArrayQuery<TItem, TMode> {
    return this.greaterThanOrEqual(value);
  }

  /**
   * Less than comparison for numeric fields.
   * Throws if the field value is not a number.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('price')
   * .lessThan(100)
   * .all();
   * ```
   */
  lessThan(value: number): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause({
      [this.path]: this.negate ? { $gte: value } : { $lt: value },
    });
  }

  /**
   * Alias for {@link lessThan}.
   */
  lt(value: number): ArrayQuery<TItem, TMode> {
    return this.lessThan(value);
  }

  /**
   * Less than or equal comparison for numeric fields.
   * Throws if the field value is not a number.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('price')
   * .lessThanOrEqual(500)
   * .all();
   * ```
   */
  lessThanOrEqual(value: number): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause({
      [this.path]: this.negate ? { $gt: value } : { $lte: value },
    });
  }

  /**
   * Alias for {@link lessThanOrEqual}.
   */
  lte(value: number): ArrayQuery<TItem, TMode> {
    return this.lessThanOrEqual(value);
  }
}
