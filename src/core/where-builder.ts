/**
 * @file core/where-builder.ts
 * @description WhereBuilder class for fluent where clause construction.
 */

import { buildNumericComparisonClause } from "../helpers/numeric-comparison";
import { getByPath } from "../helpers/path";
import { makeRegex } from "../helpers/regex";
import type {
  NumericComparisonOptions,
  Primitive,
  WhereOptions,
} from "../types";
import type { ArrayQuery } from "./array-query";

export type TypeOfName =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "null";

export type TypeOfStringOptions = {
  allowNull?: boolean;
  trim?: boolean;
  nonEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
};

export type TypeOfNumberOptions = {
  allowNull?: boolean;
  finite?: boolean;
  positive?: boolean;
  negative?: boolean;
};

export type TypeOfBooleanOptions = {
  allowNull?: boolean;
};

export type TypeOfObjectOptions = {
  allowNull?: boolean;
  allowEmptyObject?: boolean;
};

export type TypeOfArrayOptions = {
  allowNull?: boolean;
  minItems?: number;
  maxItems?: number;
};

export type TypeOfNullOptions = {
  allowNull?: boolean;
};

export type LengthOfName = "string" | "array" | "object";

export type LengthOfBaseOptions = {
  allowNull?: boolean;
  min?: number;
  max?: number;
  exact?: number;
};

export type LengthOfStringOptions = LengthOfBaseOptions & {
  trim?: boolean;
};

export type LengthOfArrayOptions = LengthOfBaseOptions;

export type LengthOfObjectOptions = LengthOfBaseOptions;

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
 * .ignoreCase()
 * .contains('pre')
 * .all();
 * ```
 *
 * @example Exact match, case-sensitive
 * ```ts
 * const results = query(resp)
 * .array('items')
 * .where('type')
 * .ignoreCase(false)
 * .equals('Premium')
 * .all();
 * ```
 */
export class WhereBuilder<TItem, TMode extends "bound" | "unbound" = "bound"> {
  private opts: Required<WhereOptions> = { caseInsensitive: false, trim: true };
  private negate: boolean;

  private _buildClause(condition: unknown): any {
    if (this.path === "") {
      return condition;
    }
    return { [this.path]: condition };
  }

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
   * Configures case-insensitive string matching for this clause.
   *
   * @defaultValue disabled by default
   */
  ignoreCase(enabled: boolean = true): this {
    this.opts.caseInsensitive = enabled;
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
   * - For numbers: matches both numeric values and numeric-string field values (e.g., "150.00" matches 150).
   * - For strings: uses a regex if `ignoreCase()` is enabled (so it can be case-insensitive).
   * - For booleans: strict equality.
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
   * @example Numeric equality with numeric strings
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('price')
   * .equals(150)
   * .all();
   * // Matches: { price: 150 }, { price: "150" }, { price: "150.00" }
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
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }

    // Numeric equality: matches both numeric values and numeric-string field values
    if (typeof value === "number" && Number.isFinite(value)) {
      const searchValue = value;
      const path = this.path;
      const negate = this.negate;
      const shouldCoerceNumericStrings =
        options?.coerceNumericStrings !== false;

      const numericClause = {
        $where: function (this: any) {
          let fieldValue: any;
          if (path === "") {
            fieldValue = this;
          } else {
            try {
              fieldValue = getByPath(this, path);
            } catch {
              return negate; // If error accessing field, negate determines falsy/truthy
            }
          }

          // Nullish field values don't match positive, match negative
          if (fieldValue === null || fieldValue === undefined) {
            return negate;
          }

          let matches = false;
          // Direct number match
          if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
            matches = fieldValue === searchValue;
          }
          // Numeric string match
          else if (
            shouldCoerceNumericStrings &&
            typeof fieldValue === "string"
          ) {
            const trimmed = fieldValue.trim();
            const parsed = Number(trimmed);
            if (Number.isFinite(parsed)) {
              matches = parsed === searchValue;
            }
          }

          return negate ? !matches : matches;
        },
      };

      return this.parent._pushClause(numericClause);
    }

    if (typeof value === "string") {
      const regex = makeRegex(value, "exact", this.opts);
      return this.parent._pushClause(
        this._buildClause(this.negate ? { $not: regex } : regex),
      );
    }
    if (this.negate) {
      return this.parent._pushClause(this._buildClause({ $ne: value }));
    }
    return this.parent._pushClause(this._buildClause(value));
  }

  /**
   * Alias for {@link equals}.
   */
  eq(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    return this.equals(value, options);
  }

  /**
   * Negated equality.
   */
  notEquals(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    return this.not().equals(value, options);
  }

  /**
   * Alias for {@link notEquals}.
   */
  ne(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    return this.notEquals(value, options);
  }

  /**
   * Validates the type of the current field and optionally applies type-specific rules.
   *
   * Default behavior:
   * - `undefined` never matches
   * - `null` only matches when `allowNull` is enabled or the target type is `"null"`
   * - `allowNull` defaults to `false`
   * - `trim` defaults to `true` for strings
   * - `finite` defaults to `false` for numbers
   * - `allowEmptyObject` defaults to `false` for objects
   *
   * `undefined` is never treated as a valid match. `null` is only accepted when
   * `allowNull` is enabled or the target type is `"null"`.
   */
  typeOf(
    type: "string",
    options?: TypeOfStringOptions,
  ): ArrayQuery<TItem, TMode>;
  typeOf(
    type: "number",
    options?: TypeOfNumberOptions,
  ): ArrayQuery<TItem, TMode>;
  typeOf(
    type: "boolean",
    options?: TypeOfBooleanOptions,
  ): ArrayQuery<TItem, TMode>;
  typeOf(
    type: "object",
    options?: TypeOfObjectOptions,
  ): ArrayQuery<TItem, TMode>;
  typeOf(type: "array", options?: TypeOfArrayOptions): ArrayQuery<TItem, TMode>;
  typeOf(type: "null", options?: TypeOfNullOptions): ArrayQuery<TItem, TMode>;
  typeOf(
    type: TypeOfName,
    options?:
      | TypeOfStringOptions
      | TypeOfNumberOptions
      | TypeOfBooleanOptions
      | TypeOfObjectOptions
      | TypeOfArrayOptions
      | TypeOfNullOptions,
  ): ArrayQuery<TItem, TMode> {
    const path = this.path;
    const negate = this.negate;
    const allowNull = options?.allowNull === true;
    const stringOptions =
      type === "string"
        ? (options as TypeOfStringOptions | undefined)
        : undefined;
    const numberOptions =
      type === "number"
        ? (options as TypeOfNumberOptions | undefined)
        : undefined;
    const arrayOptions =
      type === "array"
        ? (options as TypeOfArrayOptions | undefined)
        : undefined;
    const objectOptions =
      type === "object"
        ? (options as TypeOfObjectOptions | undefined)
        : undefined;

    return this.parent._pushClause({
      $where: function (this: any) {
        const value =
          path === ""
            ? this
            : (() => {
                try {
                  return getByPath(this, path);
                } catch {
                  return undefined;
                }
              })();

        if (value === undefined) {
          return negate;
        }

        if (value === null) {
          const matches = type === "null" || allowNull;
          return negate ? !matches : matches;
        }

        let matches = false;
        const actualType = Array.isArray(value)
          ? "array"
          : value === null
            ? "null"
            : typeof value;

        if (type === "string") {
          matches = actualType === "string";
          if (matches) {
            const text = stringOptions?.trim === false ? value : value.trim();
            if (stringOptions?.nonEmpty) {
              matches = text.length > 0;
            }
            if (typeof stringOptions?.minLength === "number") {
              matches = matches && text.length >= stringOptions.minLength;
            }
            if (typeof stringOptions?.maxLength === "number") {
              matches = matches && text.length <= stringOptions.maxLength;
            }
          }
        } else if (type === "number") {
          matches = actualType === "number";
          if (matches) {
            if (numberOptions?.finite) {
              matches = Number.isFinite(value);
            }
            if (matches && numberOptions?.positive) {
              matches = value > 0;
            }
            if (matches && numberOptions?.negative) {
              matches = value < 0;
            }
          }
        } else if (type === "boolean") {
          matches = actualType === "boolean";
        } else if (type === "array") {
          matches = actualType === "array";
          if (matches) {
            if (typeof arrayOptions?.minItems === "number") {
              matches = value.length >= arrayOptions.minItems;
            }
            if (matches && typeof arrayOptions?.maxItems === "number") {
              matches = value.length <= arrayOptions.maxItems;
            }
          }
        } else if (type === "object") {
          matches =
            actualType === "object" && !Array.isArray(value) && value !== null;
          if (matches && objectOptions?.allowEmptyObject === false) {
            matches = Object.keys(value).length > 0;
          }
        } else if (type === "null") {
          matches = actualType === "null";
        }

        return negate ? !matches : matches;
      },
    });
  }

  /**
   * Validates the length of string, array, or object values.
   *
   * - `string` uses `.length` (trimmed by default, disable with `trim: false`)
   * - `array` uses item count
   * - `object` uses `Object.keys(value).length`
   * - `undefined` never matches
   * - `null` only matches when `allowNull` is enabled
   */
  lengthOf(
    type: "string",
    options?: LengthOfStringOptions,
  ): ArrayQuery<TItem, TMode>;
  lengthOf(
    type: "array",
    options?: LengthOfArrayOptions,
  ): ArrayQuery<TItem, TMode>;
  lengthOf(
    type: "object",
    options?: LengthOfObjectOptions,
  ): ArrayQuery<TItem, TMode>;
  lengthOf(
    type: LengthOfName,
    options?:
      | LengthOfStringOptions
      | LengthOfArrayOptions
      | LengthOfObjectOptions,
  ): ArrayQuery<TItem, TMode> {
    const path = this.path;
    const negate = this.negate;
    const allowNull = options?.allowNull === true;
    const stringOptions =
      type === "string"
        ? (options as LengthOfStringOptions | undefined)
        : undefined;

    const validateBound = (
      value: number | undefined,
      label: "min" | "max" | "exact",
    ) => {
      if (value === undefined) {
        return;
      }
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(
          `lengthOf("${this.path}") options.${label} must be a non-negative integer.`,
        );
      }
    };

    validateBound(options?.min, "min");
    validateBound(options?.max, "max");
    validateBound(options?.exact, "exact");

    if (
      options?.min !== undefined &&
      options?.max !== undefined &&
      options.min > options.max
    ) {
      throw new Error(
        `lengthOf("${this.path}") options.min cannot be greater than options.max.`,
      );
    }

    if (
      options?.exact !== undefined &&
      (options?.min !== undefined || options?.max !== undefined)
    ) {
      throw new Error(
        `lengthOf("${this.path}") options.exact cannot be combined with options.min or options.max.`,
      );
    }

    const matchesLength = (size: number): boolean => {
      if (typeof options?.exact === "number") {
        return size === options.exact;
      }
      if (typeof options?.min === "number" && size < options.min) {
        return false;
      }
      if (typeof options?.max === "number" && size > options.max) {
        return false;
      }
      return true;
    };

    return this.parent._pushClause({
      $where: function (this: any) {
        const value =
          path === ""
            ? this
            : (() => {
                try {
                  return getByPath(this, path);
                } catch {
                  return undefined;
                }
              })();

        if (value === undefined) {
          return negate;
        }

        if (value === null) {
          const matches = allowNull;
          return negate ? !matches : matches;
        }

        let matches = false;

        if (type === "string") {
          if (typeof value === "string") {
            const text = stringOptions?.trim === false ? value : value.trim();
            matches = matchesLength(text.length);
          }
        } else if (type === "array") {
          if (Array.isArray(value)) {
            matches = matchesLength(value.length);
          }
        } else if (type === "object") {
          if (typeof value === "object" && !Array.isArray(value)) {
            matches = matchesLength(Object.keys(value).length);
          }
        }

        return negate ? !matches : matches;
      },
    });
  }

  /**
   * Membership match for values in a list.
   *
   * Equivalent to {@link ArrayQuery.whereIn} for the current `where(path)`.
   *
   * @example
   * ```ts
   * const results = query(resp)
   * .array('items')
   * .where('type')
   * .in(['Premium', 'Basic'])
   * .all();
   * ```
   */
  in(
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereIn("${this.path}") requires a non-empty array of values.`,
      );
    }

    if (this.negate) {
      return this.parent.whereNotIn(this.path, values, options);
    }

    return this.parent.whereIn(this.path, values, options);
  }

  /**
   * Negated membership match for values in a list.
   */
  notIn(
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ArrayQuery<TItem, TMode> {
    return this.not().in(values, options);
  }

  /**
   * Inclusive numeric range comparison.
   */
  between(
    min: number,
    max: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(
        `between("${this.path}") requires finite numeric min and max values.`,
      );
    }

    if (min > max) {
      throw new Error(
        `between("${this.path}") requires min to be less than or equal to max.`,
      );
    }

    if (this.negate) {
      return this.parent._pushClause({
        $or: [
          buildNumericComparisonClause(this.path, "lt", min, options),
          buildNumericComparisonClause(this.path, "gt", max, options),
        ],
      });
    }

    return this.parent._pushClause({
      $and: [
        buildNumericComparisonClause(this.path, "gte", min, options),
        buildNumericComparisonClause(this.path, "lte", max, options),
      ],
    });
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
    return this.parent._pushClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
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
    return this.parent._pushClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
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
    return this.parent._pushClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
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
    return this.parent._pushClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
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
  greaterThan(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "lte" : "gt",
        value,
        options,
      ),
    );
  }

  /**
   * Alias for {@link greaterThan}.
   */
  gt(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.greaterThan(value, options);
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
  greaterThanOrEqual(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "lt" : "gte",
        value,
        options,
      ),
    );
  }

  /**
   * Alias for {@link greaterThanOrEqual}.
   */
  gte(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.greaterThanOrEqual(value, options);
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
  lessThan(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "gte" : "lt",
        value,
        options,
      ),
    );
  }

  /**
   * Alias for {@link lessThan}.
   */
  lt(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.lessThan(value, options);
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
  lessThanOrEqual(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.parent._pushClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "gt" : "lte",
        value,
        options,
      ),
    );
  }

  /**
   * Alias for {@link lessThanOrEqual}.
   */
  lte(
    value: number,
    options?: NumericComparisonOptions,
  ): ArrayQuery<TItem, TMode> {
    return this.lessThanOrEqual(value, options);
  }
}
