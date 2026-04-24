/**
 * @file core/array-query.ts
 * @description Unified ArrayQuery class with phantom mode parameter.
 *
 * ArrayQuery<TItem, 'bound'>  — data attached, terminals execute eagerly.
 * ArrayQuery<TItem, 'unbound'> — no data, terminals record steps for later .run().
 */

import sift from "sift";
import { parseCompositeFilterExpression } from "../filters/logical-operators";
import { type CompactOptions, compactValue } from "../helpers/compact";
import { diffValues } from "../helpers/diff";
import { hasAllInAny } from "../helpers/has-all";
import { getByPath } from "../helpers/path";
import {
  replaceManyByScope,
  replaceValueByScope,
} from "../helpers/replace-value";
import {
  type SetAllUpdate,
  setAllByPathOccurrences,
  setAllByPathOccurrencesBatch,
} from "../helpers/set-all";
import { setByPathStrict } from "../helpers/set-by-path";
import { setPathOccurrencesIndividually } from "../helpers/set-each";
import { type SetOneOptions, setOneByPath } from "../helpers/set-one";
import {
  setTopLevelValue,
  setTopLevelValuesBatch,
} from "../helpers/set-top-level";
import { unsetByPathStrict } from "../helpers/unset-by-path";
import { AggregateQuery } from "../queries/aggregate-query";
import { IndexQuery } from "../queries/index-query";
import { PathQuery } from "../queries/path-query";
import { ValueArrayQuery } from "../queries/value-array-query";
import type {
  ArrayQueryMetadata,
  DiffOptions,
  DiffResult,
  FindOptions,
  HasAllOptions,
  Primitive,
  ReplaceRule,
  ReplaceValueOptions,
  SetOptions,
} from "../types";
import { isWhereStep, type PipelineStep } from "./pipeline-step";
import type { JsonQueryRoot } from "./query";
import { _setArrayQueryRef, QueryResult } from "./query-result";
import { WhereBuilder } from "./where-builder";

let createJsonQueryRoot: ((root: any) => JsonQueryRoot<any>) | undefined;

export function _setJsonQueryRootFactory(
  factory: (root: any) => JsonQueryRoot<any>,
): void {
  createJsonQueryRoot = factory;
}

/**
 * Fluent query wrapper around an array, parameterized by execution mode.
 *
 * - `'bound'`  — data is present; terminals return concrete results.
 * - `'unbound'` — no data; terminals record steps for `.run()`.
 *
 * Every chainable method returns a **new** instance (immutable).
 *
 * @typeParam TItem - Element type.
 * @typeParam TMode - `'bound'` (default) or `'unbound'`.
 * @typeParam TCanToRoot - Whether `.toRoot()` is available on this instance.
 */
export class ArrayQuery<
  TItem,
  TMode extends "bound" | "unbound" = "bound",
  _TCanToRoot extends boolean = TMode extends "bound" ? true : false,
> {
  // ── Private state ──────────────────────────────────────────────────────

  private readonly items: TItem[] | undefined;
  private readonly steps: PipelineStep[];
  private readonly clauses: readonly any[];
  private readonly _arrayPath: string | undefined;
  private readonly metadata: ArrayQueryMetadata | undefined;
  private readonly _sortPath: string | undefined;
  private readonly _sortDirection: "asc" | "desc";
  private readonly _sortNulls: "last" | "first";
  private readonly _sortCoerceNumericStrings: boolean;

  // ── Constructor (private) ──────────────────────────────────────────────

  private constructor(
    items: TItem[] | undefined,
    steps: PipelineStep[],
    clauses: readonly any[],
    arrayPath: string | undefined,
    metadata: ArrayQueryMetadata | undefined,
    sortPath: string | undefined,
    sortDirection: "asc" | "desc",
    sortNulls: "last" | "first",
    sortCoerceNumericStrings: boolean = true,
  ) {
    this.items = items;
    this.steps = steps;
    this.clauses = clauses;
    this._arrayPath = arrayPath;
    this.metadata = metadata;
    this._sortPath = sortPath;
    this._sortDirection = sortDirection;
    this._sortNulls = sortNulls;
    this._sortCoerceNumericStrings = sortCoerceNumericStrings;
  }

  // ── Static factories ───────────────────────────────────────────────────

  /** @internal Create a bound instance (has data). */
  static _bound<T, TCanToRoot extends boolean = true>(
    items: T[],
    metadata?: ArrayQueryMetadata,
  ): ArrayQuery<T, "bound", TCanToRoot> {
    return new ArrayQuery<T, "bound", TCanToRoot>(
      items,
      [],
      [],
      metadata?.arrayPath,
      metadata,
      undefined,
      "asc",
      "last",
    );
  }

  /** @internal Create an unbound instance (pipeline, no data). */
  static _unbound<T>(
    steps?: PipelineStep[],
    arrayPath?: string,
  ): ArrayQuery<T, "unbound"> {
    return new ArrayQuery<T, "unbound">(
      undefined,
      steps ?? [],
      [],
      arrayPath,
      undefined,
      undefined,
      "asc",
      "last",
    );
  }

  /** @internal Create an unbound instance from recorded steps. */
  static _fromSteps<T>(
    steps: PipelineStep[],
    arrayPath?: string,
  ): ArrayQuery<T, "unbound"> {
    return ArrayQuery._unbound<T>(steps, arrayPath);
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  /**
   * Creates a new instance with one step appended (no clause).
   * Used for recording non-clause steps like sort, take, drop.
   */
  private _appendStep(
    method: string,
    ...args: any[]
  ): ArrayQuery<TItem, TMode> {
    return new ArrayQuery<TItem, TMode>(
      this.items,
      [...this.steps, { method, args }],
      this.clauses,
      this._arrayPath,
      this.metadata,
      this._sortPath,
      this._sortDirection,
      this._sortNulls,
      this._sortCoerceNumericStrings,
    );
  }

  /**
   * Creates a new instance with a different element type and a step appended.
   * Used by type-changing transforms (map, flatMap, etc.) in unbound mode.
   */
  private _deriveUnbound<TOut>(
    method: string,
    ...args: any[]
  ): ArrayQuery<TOut, TMode> {
    return new ArrayQuery<TOut, TMode>(
      undefined,
      [...this.steps, { method, args }],
      [],
      this._arrayPath,
      undefined,
      undefined,
      "asc",
      "last",
    );
  }

  /**
   * Clones values before invoking user callbacks so callback-side mutation
   * cannot mutate bound source data by reference.
   */
  private static _cloneForUserFn<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof globalThis.structuredClone === "function") {
      return globalThis.structuredClone(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => ArrayQuery._cloneForUserFn(item)) as T;
    }

    if (typeof value === "object") {
      const clone: Record<string, any> = {};
      for (const [key, val] of Object.entries(value as Record<string, any>)) {
        clone[key] = ArrayQuery._cloneForUserFn(val);
      }
      return clone as T;
    }

    return value;
  }

  /**
   * Materializes the filtered + sorted items from accumulated clauses.
   * Only callable in bound mode.
   */
  private _executeFilter(): TItem[] {
    const items = this.items!;
    let results: TItem[];
    if (this.clauses.length === 0) {
      results = items;
    } else {
      const combined =
        this.clauses.length === 1
          ? this.clauses[0]
          : { $and: [...this.clauses] };
      results = items.filter(sift(combined));
    }
    return this._applySorting(results);
  }

  /**
   * Applies sort if configured.
   */
  private _applySorting(items: TItem[]): TItem[] {
    const sortPath = this._sortPath;
    const sortDirection = this._sortDirection || "asc";
    const sortNulls = this._sortNulls || "last";
    const sortCoerceNumericStrings = this._sortCoerceNumericStrings !== false;

    if (sortPath === undefined) {
      return items;
    }

    const decorated = items.map((item, index) => ({ item, index }));
    decorated.sort((a, b) => {
      const valueA =
        sortPath === ""
          ? (a.item as any)
          : getByPath(a.item as any, sortPath, true);
      const valueB =
        sortPath === ""
          ? (b.item as any)
          : getByPath(b.item as any, sortPath, true);

      if (valueA === null || valueA === undefined) {
        if (valueB === null || valueB === undefined) {
          return 0;
        }
        return sortNulls === "last" ? 1 : -1;
      }
      if (valueB === null || valueB === undefined) {
        return sortNulls === "last" ? -1 : 1;
      }

      let compareValueA = valueA;
      let compareValueB = valueB;

      if (
        sortCoerceNumericStrings &&
        typeof valueA === "string" &&
        typeof valueB === "string"
      ) {
        const parsedA = Number(valueA.trim());
        const parsedB = Number(valueB.trim());
        if (Number.isFinite(parsedA) && Number.isFinite(parsedB)) {
          compareValueA = parsedA;
          compareValueB = parsedB;
        }
      }

      let comparison = 0;
      if (compareValueA < compareValueB) {
        comparison = -1;
      } else if (compareValueA > compareValueB) {
        comparison = 1;
      }

      const directionAdjusted =
        sortDirection === "asc" ? comparison : -comparison;
      if (directionAdjusted !== 0) {
        return directionAdjusted;
      }

      return a.index - b.index;
    });

    return decorated.map((entry) => entry.item);
  }

  /**
   * Replays recorded steps onto a fresh bound ArrayQuery.
   * Used by .run() to execute a pipeline against data.
   */
  private static _replay<T>(
    items: T[],
    steps: readonly PipelineStep[],
    metadata?: ArrayQueryMetadata,
  ): ArrayQuery<T, "bound"> {
    let current: any = ArrayQuery._bound(items, metadata);

    for (const step of steps) {
      if (isWhereStep(step)) {
        let builder = current[step.method](step.args[0]);
        for (const mod of step.modifiers) {
          builder = builder[mod.name](...mod.args);
        }
        current = builder[step.terminal.method](...step.terminal.args);
      } else {
        current = current[step.method](...step.args);
      }
    }

    return current;
  }

  // ── @internal getters (cross-class access) ─────────────────────────────

  /** @internal */
  _getSteps(): readonly PipelineStep[] {
    return this.steps;
  }

  /** @internal */
  _getArrayPath(): string | undefined {
    return this._arrayPath;
  }

  // ── Chainable filter methods ───────────────────────────────────────────

  /**
   * Adds a raw sift query.
   */
  whereSift(siftQuery: any): ArrayQuery<TItem, TMode> {
    return this._pushClause(siftQuery);
  }

  /**
   * Applies a filter using a DSL expression.
   */
  filter(
    expression: string,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    const clause = parseCompositeFilterExpression(expression, options);
    return this._pushClause(clause);
  }

  /**
   * Conditionally applies filter() only when the provided param is defined
   * (i.e., not null and not undefined).
   * If expression contains a named placeholder (e.g. $minPrice), that
   * placeholder is bound to the provided param.
   */
  filterIfDefined(
    expression: string,
    param: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    if (param === null || param === undefined) {
      return this;
    }

    const placeholders = Array.from(
      new Set(
        Array.from(expression.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)).map(
          (m) => m[1],
        ),
      ),
    );

    if (placeholders.length === 0) {
      return this.filter(expression, options);
    }

    if (placeholders.length !== 1) {
      throw new Error(
        "filterIfDefined() supports expressions with exactly one named placeholder.",
      );
    }

    const boundExpression = this._bindExpressionParams(expression, {
      [placeholders[0]]: param,
    });
    return this.filter(boundExpression, options);
  }

  /**
   * Conditionally applies filter() only when all provided params are defined
   * (i.e., each is not null and not undefined).
   *
   * Uses an object map for both defined-value gating and named placeholder
   * binding (e.g. $minPrice).
   */
  filterIfAllDefined(
    expression: string,
    params: Record<string, any>,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    if (Array.isArray(params)) {
      throw new Error(
        "filterIfAllDefined() expects an object map of params (e.g. { minPrice, maxPrice }). Array params are not supported.",
      );
    }

    const values = Object.values(params);
    if (values.every((value) => value !== null && value !== undefined)) {
      const boundExpression = this._bindExpressionParams(expression, params);
      return this.filter(boundExpression, options);
    }
    return this;
  }

  /**
   * Binds named placeholders (e.g. $minPrice) using object params.
   */
  private _bindExpressionParams(
    expression: string,
    params: Record<string, any>,
  ): string {
    const hasPlaceholder = /\$[a-zA-Z_][a-zA-Z0-9_]*/.test(expression);

    if (!hasPlaceholder) {
      return expression;
    }

    return expression.replace(
      /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (_match, name: string) => {
        if (!(name in params)) {
          throw new Error(
            `Missing placeholder value for $${name} in filter expression.`,
          );
        }
        const value = params[name];
        if (value === null || value === undefined) {
          throw new Error(
            `Placeholder value for $${name} must be defined in filter expression.`,
          );
        }
        return this._toExpressionLiteral(value);
      },
    );
  }

  /**
   * Converts a JS value to a filter-expression literal.
   */
  private _toExpressionLiteral(value: any): string {
    if (typeof value === "string") {
      return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "undefined";
    }
    throw new Error(
      `Unsupported placeholder value type: ${typeof value}. Use string, number, bigint, boolean, null, or undefined.`,
    );
  }

  /**
   * Begins a where clause on a property path.
   */
  where(path: string): WhereBuilder<TItem, TMode> {
    return new WhereBuilder<TItem, TMode>(this, path);
  }

  /**
   * Begins a negated where clause on a property path.
   */
  whereNot(path: string): WhereBuilder<TItem, TMode> {
    return new WhereBuilder<TItem, TMode>(this, path, true);
  }

  /**
   * Begins a where clause on the item value itself.
   *
   * Useful for primitive arrays where each item is the value to compare.
   */
  whereSelf(): WhereBuilder<TItem, TMode> {
    return this.where("");
  }

  /**
   * Conditionally applies where().equals() if value is defined.
   */
  whereIfDefined(
    path: string,
    value: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.equals(value, options);
    }
    return this;
  }

  /**
   * Conditionally applies whereNot().equals() if value is defined.
   */
  whereNotIfDefined(
    path: string,
    value: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.whereNot(path);
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.equals(value, options);
    }
    return this;
  }

  /**
   * Conditionally applies where().greaterThan() if value is defined.
   */
  greaterThanIfDefined(
    path: string,
    value: number | null | undefined,
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      return this.where(path).greaterThan(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().greaterThanOrEqual() if value is defined.
   */
  greaterThanOrEqualIfDefined(
    path: string,
    value: number | null | undefined,
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      return this.where(path).greaterThanOrEqual(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().lessThan() if value is defined.
   */
  lessThanIfDefined(
    path: string,
    value: number | null | undefined,
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      return this.where(path).lessThan(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().lessThanOrEqual() if value is defined.
   */
  lessThanOrEqualIfDefined(
    path: string,
    value: number | null | undefined,
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      return this.where(path).lessThanOrEqual(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().contains() if value is defined.
   */
  containsIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.contains(value);
    }
    return this;
  }

  /**
   * Conditionally applies negated contains if value is defined.
   */
  notContainsIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.contains(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().startsWith() if value is defined.
   */
  startsWithIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.startsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies negated startsWith if value is defined.
   */
  notStartsWithIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.startsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies where().endsWith() if value is defined.
   */
  endsWithIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.endsWith(value);
    }
    return this;
  }

  /**
   * Conditionally applies negated endsWith if value is defined.
   */
  notEndsWithIfDefined(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path).not();
      if (options?.ignoreCase !== undefined) {
        builder.ignoreCase(options.ignoreCase);
      }
      if (options?.trim !== undefined) {
        if (options.trim) {
          builder.trim();
        } else {
          builder.noTrim();
        }
      }
      return builder.endsWith(value);
    }
    return this;
  }

  /**
   * Filters items where value at path is in the provided list.
   * Supports numeric string coercion: in([100]) matches both 100 and "100"
   */
  whereIn(
    path: string,
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereIn("${path}") requires a non-empty array of values.`,
      );
    }

    const shouldCoerceNumericStrings = options?.coerceNumericStrings !== false;

    // Check if any value is a finite number - if so, support numeric string coercion
    const hasNumericValues = values.some(
      (v) => typeof v === "number" && Number.isFinite(v),
    );

    if (shouldCoerceNumericStrings && hasNumericValues) {
      return this._pushClause({
        $where: function (this: any) {
          let fieldValue: any;
          try {
            fieldValue = path === "" ? this : this[path];
          } catch {
            return false;
          }

          for (const val of values) {
            // Direct match for any value
            if (fieldValue === val) return true;

            // Numeric string coercion for numeric values in the list
            if (typeof val === "number" && Number.isFinite(val)) {
              if (
                typeof fieldValue === "number" &&
                Number.isFinite(fieldValue)
              ) {
                if (fieldValue === val) return true;
              } else if (typeof fieldValue === "string") {
                const trimmed = fieldValue.trim();
                const parsed = Number(trimmed);
                if (Number.isFinite(parsed) && parsed === val) return true;
              }
            }
          }

          return false;
        },
      });
    }

    return this._pushClause({ [path]: { $in: values } });
  }

  /**
   * Filters items where value at path is NOT in the provided list.
   * Supports numeric string coercion: notIn([100]) excludes both 100 and "100"
   */
  whereNotIn(
    path: string,
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereNotIn("${path}") requires a non-empty array of values.`,
      );
    }

    const shouldCoerceNumericStrings = options?.coerceNumericStrings !== false;

    // Check if any value is a finite number - if so, support numeric string coercion
    const hasNumericValues = values.some(
      (v) => typeof v === "number" && Number.isFinite(v),
    );

    if (shouldCoerceNumericStrings && hasNumericValues) {
      return this._pushClause({
        $where: function (this: any) {
          let fieldValue: any;
          try {
            fieldValue = path === "" ? this : this[path];
          } catch {
            return true; // Missing field is not in the list
          }

          for (const val of values) {
            // Direct match for any value
            if (fieldValue === val) return false;

            // Numeric string coercion for numeric values in the list
            if (typeof val === "number" && Number.isFinite(val)) {
              if (
                typeof fieldValue === "number" &&
                Number.isFinite(fieldValue)
              ) {
                if (fieldValue === val) return false;
              } else if (typeof fieldValue === "string") {
                const trimmed = fieldValue.trim();
                const parsed = Number(trimmed);
                if (Number.isFinite(parsed) && parsed === val) return false;
              }
            }
          }

          return true; // Not in the list
        },
      });
    }

    return this._pushClause({ [path]: { $nin: values } });
  }

  /**
   * Filters items where the key(s) at path do not exist.
   * Pass a string array to require all given keys to be missing.
   */
  whereMissing(path: string | string[]): ArrayQuery<TItem, TMode> {
    if (Array.isArray(path)) {
      return this._pushClause({
        $and: path.map((p) => ({ [p]: { $exists: false } })),
      });
    }
    return this._pushClause({ [path]: { $exists: false } });
  }

  /**
   * Filters items where the key(s) at path exist.
   * Pass a string array to require all given keys to be present.
   */
  whereExists(path: string | string[]): ArrayQuery<TItem, TMode> {
    if (Array.isArray(path)) {
      return this._pushClause({
        $and: path.map((p) => ({ [p]: { $exists: true } })),
      });
    }
    return this._pushClause({ [path]: { $exists: true } });
  }

  /**
   * Filters items where all provided field-value pairs match exactly.
   */
  whereAll(criteria: Record<string, Primitive>): ArrayQuery<TItem, TMode> {
    return this._pushClause(criteria);
  }

  /**
   * Filters items where ANY provided field-value pair matches exactly.
   */
  whereAny(criteria: Record<string, Primitive>): ArrayQuery<TItem, TMode> {
    const entries = Object.entries(criteria);
    if (entries.length === 0) {
      throw new Error("whereAny() requires at least one criterion.");
    }

    const orClauses = entries.map(([key, value]) => ({ [key]: value }));
    return this._pushClause({ $or: orClauses });
  }

  /**
   * Filters items where NONE of the provided field-value pairs match exactly.
   */
  whereNone(criteria: Record<string, Primitive>): ArrayQuery<TItem, TMode> {
    const entries = Object.entries(criteria);
    if (entries.length === 0) {
      throw new Error("whereNone() requires at least one criterion.");
    }

    const norClauses = entries.map(([key, value]) => ({ [key]: value }));
    return this._pushClause({ $nor: norClauses });
  }

  /**
   * Sorts items by the value at the given path.
   */
  sort(
    path: string = "",
    options?: {
      direction?: "asc" | "desc";
      nulls?: "last" | "first";
      coerceNumericStrings?: boolean;
    },
  ): ArrayQuery<TItem, TMode> {
    const direction = options?.direction ?? "asc";
    const nulls = options?.nulls ?? "last";
    const coerceNumericStrings = options?.coerceNumericStrings !== false;

    return new ArrayQuery<TItem, TMode>(
      this.items,
      [
        ...this.steps,
        {
          method: "sort",
          args: [path, { direction, nulls, coerceNumericStrings }],
        },
      ],
      this.clauses,
      this._arrayPath,
      this.metadata,
      path,
      direction,
      nulls,
      coerceNumericStrings,
    );
  }

  // ── Terminal methods (conditional on TMode) ────────────────────────────

  /**
   * Returns all matches. In bound mode returns QueryResult (IS an array).
   * In unbound mode records the terminal and returns the pipeline.
   */
  all(): TMode extends "bound"
    ? QueryResult<TItem>
    : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("all") as any;
    }
    const results = this._executeFilter();
    const stepsWithTerminal = [...this.steps, { method: "all", args: [] }];
    return QueryResult.create(
      results,
      stepsWithTerminal,
      this._arrayPath,
    ) as any;
  }

  /**
   * Returns the count of matching items.
   */
  count(): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("count") as any;
    }
    return this._executeFilter().length as any;
  }

  /**
   * Compares each selected item with an expected value and returns diff summary.
   */
  diff(
    expected: unknown,
    options?: DiffOptions,
  ): TMode extends "bound" ? DiffResult : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("diff", expected, options) as any;
    }

    const selected = this._executeFilter();
    const max = options?.maxMismatches;
    const maxMismatches =
      typeof max === "number" && Number.isFinite(max) && max > 0
        ? Math.floor(max)
        : Number.POSITIVE_INFINITY;

    const mismatches: DiffResult["mismatches"] = [];
    let truncated = false;

    for (let i = 0; i < selected.length; i++) {
      if (mismatches.length >= maxMismatches) {
        truncated = true;
        break;
      }

      const rowResult = diffValues(expected, selected[i], {
        ...options,
        maxMismatches: maxMismatches - mismatches.length,
      });

      for (const mismatch of rowResult.mismatches) {
        mismatches.push({ ...mismatch, itemIndex: i });
      }

      if (rowResult.truncated || mismatches.length >= maxMismatches) {
        truncated = true;
        break;
      }
    }

    const result: DiffResult = {
      equal: mismatches.length === 0,
      mismatches,
    };

    if (truncated) {
      result.truncated = true;
    }

    return result as any;
  }

  /**
   * Returns true when any selected item contains all criteria key/value pairs.
   *
   * With `scope: "top-level"` (default), pairs must exist on the item itself.
   * With `scope: "deep"`, each pair may be matched anywhere in the item's subtree.
   */
  hasAll(
    criteria: Record<string, unknown>,
    options?: HasAllOptions,
  ): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("hasAll", criteria, options) as any;
    }

    return hasAllInAny(this._executeFilter(), criteria, options) as any;
  }

  /**
   * Returns true when any selected item contains a single key/value pair.
   *
   * This is a convenience alias for `hasAll({ [key]: value }, options)`.
   */
  has(
    key: string,
    value: unknown,
    options?: HasAllOptions,
  ): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    return this.hasAll({ [key]: value }, options) as any;
  }

  /**
   * Returns true if at least one item matches.
   */
  exists(): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("exists") as any;
    }
    this._assertBooleanTerminalHasSelectionContext("exists");
    return (this._executeFilter().length > 0) as any;
  }

  /**
   * Returns true if all items match the filters.
   */
  every(): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("every") as any;
    }
    this._assertBooleanTerminalHasSelectionContext("every");
    return (this._executeFilter().length === this.items!.length) as any;
  }

  /**
   * Returns the sum of values at path.
   */
  sum(
    path: string = "",
    options?: {
      decimals?: number;
      coerceNumericStrings?: boolean;
      preRoundDecimals?: number;
      preRoundSignificantDigits?: number;
      preRoundMode?: "halfUp" | "halfEven";
      finalRoundSignificantDigits?: number;
      finalRoundMode?: "halfUp" | "halfEven";
    },
  ): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("sum", path, options) as any;
    }

    const decimals = options?.decimals;
    if (
      decimals !== undefined &&
      (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)
    ) {
      throw new Error(
        "sum() options.decimals expects an integer between 0 and 100.",
      );
    }

    const preRoundDecimals = options?.preRoundDecimals;
    if (
      preRoundDecimals !== undefined &&
      (!Number.isInteger(preRoundDecimals) ||
        preRoundDecimals < 0 ||
        preRoundDecimals > 100)
    ) {
      throw new Error(
        "sum() options.preRoundDecimals expects an integer between 0 and 100.",
      );
    }

    const preRoundSignificantDigits = options?.preRoundSignificantDigits;
    if (
      preRoundSignificantDigits !== undefined &&
      (!Number.isInteger(preRoundSignificantDigits) ||
        preRoundSignificantDigits < 1 ||
        preRoundSignificantDigits > 100)
    ) {
      throw new Error(
        "sum() options.preRoundSignificantDigits expects an integer between 1 and 100.",
      );
    }

    if (
      preRoundDecimals !== undefined &&
      preRoundSignificantDigits !== undefined
    ) {
      throw new Error(
        "sum() options.preRoundDecimals and options.preRoundSignificantDigits are mutually exclusive.",
      );
    }

    const preRoundMode = options?.preRoundMode ?? "halfUp";
    const finalRoundSignificantDigits = options?.finalRoundSignificantDigits;
    if (
      finalRoundSignificantDigits !== undefined &&
      (!Number.isInteger(finalRoundSignificantDigits) ||
        finalRoundSignificantDigits < 1 ||
        finalRoundSignificantDigits > 100)
    ) {
      throw new Error(
        "sum() options.finalRoundSignificantDigits expects an integer between 1 and 100.",
      );
    }

    if (decimals !== undefined && finalRoundSignificantDigits !== undefined) {
      throw new Error(
        "sum() options.decimals and options.finalRoundSignificantDigits are mutually exclusive.",
      );
    }

    const finalRoundMode = options?.finalRoundMode ?? "halfUp";

    const roundHalfEven = (value: number): number => {
      const absValue = Math.abs(value);
      const lower = Math.floor(absValue);
      const fraction = absValue - lower;
      const epsilon = 1e-12;

      let roundedInt: number;
      if (fraction > 0.5 + epsilon) {
        roundedInt = lower + 1;
      } else if (fraction < 0.5 - epsilon) {
        roundedInt = lower;
      } else {
        roundedInt = lower % 2 === 0 ? lower : lower + 1;
      }

      return Math.sign(value) * roundedInt;
    };

    const preRoundNumericValue = (value: number): number => {
      if (preRoundDecimals !== undefined) {
        const factor = 10 ** preRoundDecimals;
        if (preRoundMode === "halfEven") {
          return roundHalfEven(value * factor) / factor;
        }
        return Math.round(value * factor) / factor;
      }

      if (preRoundSignificantDigits !== undefined) {
        if (preRoundMode === "halfEven") {
          if (value === 0) return 0;

          const exponent = Math.floor(Math.log10(Math.abs(value)));
          const scale = 10 ** (preRoundSignificantDigits - 1 - exponent);
          const scaled = value * scale;
          const roundedScaled = roundHalfEven(scaled);
          return roundedScaled / scale;
        }
        return Number(value.toPrecision(preRoundSignificantDigits));
      }

      return value;
    };

    const results = this._executeFilter();
    const total = results.reduce((sum, item) => {
      const value =
        path === "" ? (item as any) : getByPath(item as any, path, true);
      const shouldCoerceNumericStrings =
        options?.coerceNumericStrings !== false;

      if (typeof value === "number" && Number.isFinite(value)) {
        return sum + preRoundNumericValue(value);
      }

      if (shouldCoerceNumericStrings && typeof value === "string") {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed !== "" && Number.isFinite(parsed)) {
          return sum + preRoundNumericValue(parsed);
        }
      }

      return sum;
    }, 0);

    const roundToDecimals = (value: number, roundDecimals: number): number => {
      const factor = 10 ** roundDecimals;
      if (finalRoundMode === "halfEven") {
        return roundHalfEven(value * factor) / factor;
      }
      return Math.round(value * factor) / factor;
    };

    const roundToSignificant = (
      value: number,
      significantDigits: number,
    ): number => {
      if (value === 0) return 0;
      if (finalRoundMode === "halfEven") {
        const exponent = Math.floor(Math.log10(Math.abs(value)));
        const scale = 10 ** (significantDigits - 1 - exponent);
        const scaled = value * scale;
        const roundedScaled = roundHalfEven(scaled);
        return roundedScaled / scale;
      }
      return Number(value.toPrecision(significantDigits));
    };

    if (finalRoundSignificantDigits !== undefined) {
      return roundToSignificant(total, finalRoundSignificantDigits) as any;
    }

    if (decimals === undefined) {
      return total as any;
    }

    return roundToDecimals(total, decimals) as any;
  }

  /**
   * Returns the average of values at path.
   */
  average(
    path: string = "",
    options?: {
      decimals?: number;
      coerceNumericStrings?: boolean;
      preRoundDecimals?: number;
      preRoundSignificantDigits?: number;
      preRoundMode?: "halfUp" | "halfEven";
      finalRoundSignificantDigits?: number;
      finalRoundMode?: "halfUp" | "halfEven";
    },
  ): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("average", path, options) as any;
    }

    const decimals = options?.decimals;
    if (
      decimals !== undefined &&
      (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)
    ) {
      throw new Error(
        "average() options.decimals expects an integer between 0 and 100.",
      );
    }

    const preRoundDecimals = options?.preRoundDecimals;
    if (
      preRoundDecimals !== undefined &&
      (!Number.isInteger(preRoundDecimals) ||
        preRoundDecimals < 0 ||
        preRoundDecimals > 100)
    ) {
      throw new Error(
        "average() options.preRoundDecimals expects an integer between 0 and 100.",
      );
    }

    const preRoundSignificantDigits = options?.preRoundSignificantDigits;
    if (
      preRoundSignificantDigits !== undefined &&
      (!Number.isInteger(preRoundSignificantDigits) ||
        preRoundSignificantDigits < 1 ||
        preRoundSignificantDigits > 100)
    ) {
      throw new Error(
        "average() options.preRoundSignificantDigits expects an integer between 1 and 100.",
      );
    }

    if (
      preRoundDecimals !== undefined &&
      preRoundSignificantDigits !== undefined
    ) {
      throw new Error(
        "average() options.preRoundDecimals and options.preRoundSignificantDigits are mutually exclusive.",
      );
    }

    const preRoundMode = options?.preRoundMode ?? "halfUp";
    const finalRoundSignificantDigits = options?.finalRoundSignificantDigits;
    if (
      finalRoundSignificantDigits !== undefined &&
      (!Number.isInteger(finalRoundSignificantDigits) ||
        finalRoundSignificantDigits < 1 ||
        finalRoundSignificantDigits > 100)
    ) {
      throw new Error(
        "average() options.finalRoundSignificantDigits expects an integer between 1 and 100.",
      );
    }

    if (decimals !== undefined && finalRoundSignificantDigits !== undefined) {
      throw new Error(
        "average() options.decimals and options.finalRoundSignificantDigits are mutually exclusive.",
      );
    }

    const finalRoundMode = options?.finalRoundMode ?? "halfUp";

    const roundHalfEven = (value: number): number => {
      const absValue = Math.abs(value);
      const lower = Math.floor(absValue);
      const fraction = absValue - lower;
      const epsilon = 1e-12;

      let roundedInt: number;
      if (fraction > 0.5 + epsilon) {
        roundedInt = lower + 1;
      } else if (fraction < 0.5 - epsilon) {
        roundedInt = lower;
      } else {
        roundedInt = lower % 2 === 0 ? lower : lower + 1;
      }

      return Math.sign(value) * roundedInt;
    };

    const preRoundNumericValue = (value: number): number => {
      if (preRoundDecimals !== undefined) {
        const factor = 10 ** preRoundDecimals;
        if (preRoundMode === "halfEven") {
          return roundHalfEven(value * factor) / factor;
        }
        return Math.round(value * factor) / factor;
      }

      if (preRoundSignificantDigits !== undefined) {
        if (preRoundMode === "halfEven") {
          if (value === 0) return 0;

          const exponent = Math.floor(Math.log10(Math.abs(value)));
          const scale = 10 ** (preRoundSignificantDigits - 1 - exponent);
          const scaled = value * scale;
          const roundedScaled = roundHalfEven(scaled);
          return roundedScaled / scale;
        }
        return Number(value.toPrecision(preRoundSignificantDigits));
      }

      return value;
    };

    const results = this._executeFilter();
    if (results.length === 0) return 0 as any;
    const total = results.reduce((sum, item) => {
      const value =
        path === "" ? (item as any) : getByPath(item as any, path, true);
      const shouldCoerceNumericStrings =
        options?.coerceNumericStrings !== false;

      if (typeof value === "number" && Number.isFinite(value)) {
        return sum + preRoundNumericValue(value);
      }

      if (shouldCoerceNumericStrings && typeof value === "string") {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed !== "" && Number.isFinite(parsed)) {
          return sum + preRoundNumericValue(parsed);
        }
      }

      return sum;
    }, 0);

    const average = total / results.length;

    const roundToDecimals = (value: number, roundDecimals: number): number => {
      const factor = 10 ** roundDecimals;
      if (finalRoundMode === "halfEven") {
        return roundHalfEven(value * factor) / factor;
      }
      return Math.round(value * factor) / factor;
    };

    const roundToSignificant = (
      value: number,
      significantDigits: number,
    ): number => {
      if (value === 0) return 0;
      if (finalRoundMode === "halfEven") {
        const exponent = Math.floor(Math.log10(Math.abs(value)));
        const scale = 10 ** (significantDigits - 1 - exponent);
        const scaled = value * scale;
        const roundedScaled = roundHalfEven(scaled);
        return roundedScaled / scale;
      }
      return Number(value.toPrecision(significantDigits));
    };

    if (finalRoundSignificantDigits !== undefined) {
      return roundToSignificant(average, finalRoundSignificantDigits) as any;
    }

    if (decimals === undefined) {
      return average as any;
    }

    return roundToDecimals(average, decimals) as any;
  }

  /**
   * Returns the minimum value at path.
   */
  min(
    path: string = "",
  ): TMode extends "bound" ? number | null : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("min", path) as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) return null as any;
    const values = results
      .map((item) =>
        path === "" ? (item as any) : getByPath(item as any, path, true),
      )
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
      .map(Number);
    return (values.length > 0 ? Math.min(...values) : null) as any;
  }

  /**
   * Returns the maximum value at path.
   */
  max(
    path: string = "",
  ): TMode extends "bound" ? number | null : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("max", path) as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) return null as any;
    const values = results
      .map((item) =>
        path === "" ? (item as any) : getByPath(item as any, path, true),
      )
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
      .map(Number);
    return (values.length > 0 ? Math.max(...values) : null) as any;
  }

  /**
   * Returns the sum of products across paths.
   */
  sumOfProducts(
    ...paths: string[]
  ): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("sumOfProducts", ...paths) as any;
    }
    if (paths.length === 0) {
      throw new Error("sumOfProducts() requires at least one path");
    }
    return this._executeFilter().reduce((sum, item) => {
      let productValue = 1;
      for (const path of paths) {
        const value = getByPath(item as any, path, true);
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new Error(
            `Invalid number at path "${path}" for product calculation`,
          );
        }
        productValue *= num;
      }
      return sum + productValue;
    }, 0) as any;
  }

  /**
   * Returns a chainable aggregation helper.
   */
  aggregate(): AggregateQuery {
    if (this.items === undefined) {
      throw new Error("aggregate() is only available on bound queries.");
    }
    return new AggregateQuery(this._executeFilter());
  }

  /**
   * Groups matching items by path value.
   */
  groupBy(
    path: string,
  ): TMode extends "bound"
    ? Record<string, TItem[]>
    : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("groupBy", path) as any;
    }
    const results = this._executeFilter();
    const grouped: Record<string, TItem[]> = {};

    for (const item of results) {
      const groupValue = getByPath(item as any, path, true);
      const key = String(groupValue);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped as any;
  }

  /**
   * Returns distinct items by unique value at path.
   */
  distinct(path?: string): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("distinct", path) as any;
    }
    const results = this._executeFilter();
    if (!path) {
      const seenStructural = new Set<string>();
      const uniqueStructural: TItem[] = [];

      for (const item of results) {
        const key = this._stableStructuralKey(item);
        if (!seenStructural.has(key)) {
          seenStructural.add(key);
          uniqueStructural.push(item);
        }
      }

      return ArrayQuery._bound<TItem>(uniqueStructural, this.metadata) as any;
    }

    const seen = new Set<any>();
    const unique: TItem[] = [];
    const isDotPath = path.includes(".");

    for (const item of results) {
      const value = isDotPath
        ? getByPath(item as any, path, true)
        : this._getUniqueDeepPropertyValue(item as any, path);
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(item);
      }
    }

    return ArrayQuery._bound<TItem>(unique, this.metadata) as any;
  }

  /**
   * @internal
   * Finds a single matching property value anywhere in the object tree.
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

      // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022, tsconfig targets ES2020
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
   * @internal
   * Produces a stable serialization key for deep structural equality.
   */
  private _stableStructuralKey(value: any): string {
    return this._serializeStructural(value, new WeakSet<object>());
  }

  /**
   * @internal
   * Recursively serializes a value with stable object key ordering.
   */
  private _serializeStructural(value: any, seen: WeakSet<object>): string {
    if (value === null) return "null";

    const valueType = typeof value;
    if (valueType === "string") return `str:${JSON.stringify(value)}`;
    if (valueType === "number") {
      if (Number.isNaN(value)) return "num:NaN";
      if (Object.is(value, -0)) return "num:-0";
      if (value === Infinity) return "num:Infinity";
      if (value === -Infinity) return "num:-Infinity";
      return `num:${value}`;
    }
    if (valueType === "boolean") return `bool:${value}`;
    if (valueType === "bigint") return `bigint:${value.toString()}`;
    if (valueType === "undefined") return "undefined";
    if (valueType === "symbol") return `symbol:${String(value)}`;
    if (valueType === "function") return `function:${String(value)}`;

    if (value instanceof Date) {
      return `date:${value.toISOString()}`;
    }
    if (value instanceof RegExp) {
      return `regexp:${value.toString()}`;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      const items = value.map((item) => this._serializeStructural(item, seen));
      seen.delete(value);
      return `[${items.join(",")}]`;
    }

    const recordValue = value as Record<string, unknown>;
    const keys = Object.keys(recordValue).sort();
    const entries = keys.map(
      (key) =>
        `${JSON.stringify(key)}:${this._serializeStructural(recordValue[key], seen)}`,
    );
    seen.delete(value);
    return `{${entries.join(",")}}`;
  }

  /**
   * Extracts values at path as a chainable ValueArrayQuery.
   */
  pluck<TValue = any>(path: string): ValueArrayQuery<TValue> {
    if (this.items === undefined) {
      throw new Error("pluck() is only available on bound queries.");
    }
    const values = this._executeFilter().map((item) =>
      getByPath(item as any, path),
    ) as TValue[];
    return new ValueArrayQuery(values);
  }

  /**
   * Recursively searches for a property at any depth.
   */
  find<TValue = any>(
    pathOrProperty: string,
    options?: FindOptions,
  ): ValueArrayQuery<TValue> {
    if (this.items === undefined) {
      throw new Error("find() is only available on bound queries.");
    }
    const results: TValue[] = [];
    const scope = options?.scope ?? "deep";
    const isPath = pathOrProperty.includes(".");

    const collectFromCurrentObject = (obj: any): void => {
      if (obj === null || obj === undefined || typeof obj !== "object") {
        return;
      }
      if (isPath) {
        const value = getByPath(obj, pathOrProperty, true);
        if (value !== undefined) {
          results.push(value);
        }
      } else if (pathOrProperty in obj) {
        results.push(obj[pathOrProperty]);
      }
    };

    if (scope === "top-level") {
      for (const item of this._executeFilter()) {
        collectFromCurrentObject(item);
      }
      return new ValueArrayQuery(results);
    }

    const recursiveSearch = (obj: any): void => {
      if (obj === null || obj === undefined) {
        return;
      }

      if (typeof obj === "object") {
        collectFromCurrentObject(obj);

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

    for (const item of this._executeFilter()) {
      recursiveSearch(item);
    }

    return new ValueArrayQuery(results);
  }

  /**
   * Picks properties from each matching item.
   */
  pick(
    pathOrPaths: string | string[] | Record<string, string>,
    ...additionalPaths: string[]
  ): ArrayQuery<Record<string, any>, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<Record<string, any>>(
        "pick",
        pathOrPaths,
        ...additionalPaths,
      );
    }
    const picked = this._executeFilter().map((item) => {
      const result: Record<string, any> = {};

      if (typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)) {
        for (const [key, path] of Object.entries(pathOrPaths)) {
          result[key] = getByPath(item as any, path, true);
        }
      } else {
        const paths = Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...additionalPaths];
        for (const path of paths) {
          result[path] = getByPath(item as any, path, true);
        }
      }

      return result;
    });

    return ArrayQuery._bound<Record<string, any>>(picked, this.metadata) as any;
  }

  /**
   * Omits properties from each matching item.
   */
  omit(
    pathOrPaths: string | string[] | Record<string, string>,
    ...additionalPaths: string[]
  ): ArrayQuery<Record<string, any>, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<Record<string, any>>(
        "omit",
        pathOrPaths,
        ...additionalPaths,
      );
    }

    const paths =
      typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)
        ? Object.values(pathOrPaths)
        : Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...additionalPaths];

    const omitted = this._executeFilter().map((item) => {
      if (item === null || item === undefined || typeof item !== "object") {
        throw new Error("omit() is only supported for object items.");
      }

      let updated: any = item;
      for (const path of paths) {
        updated = unsetByPathStrict(updated, path, { onMissing: "ignore" });
      }
      return updated;
    });

    return ArrayQuery._bound<Record<string, any>>(
      omitted as any,
      this.metadata,
    ) as any;
  }

  /**
   * Compacts matching items by removing removable values from the result set.
   */
  compact(options?: CompactOptions): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("compact", options) as any;
    }

    const compacted = this._executeFilter()
      .map((item) => compactValue(item, options))
      .filter((item) => item !== undefined) as TItem[];

    return ArrayQuery._bound<TItem>(compacted, this.metadata) as any;
  }

  /**
   * Returns the first match. Throws if no matches.
   */
  first(): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("first") as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) {
      throw new Error("No matches found for first().");
    }
    return results[0] as any;
  }

  /**
   * Alias for first().
   */
  any(): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    return this.first();
  }

  /**
   * Returns a random match. Throws if no matches.
   */
  random(): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("random") as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) {
      throw new Error("No matches found for random().");
    }
    const index = Math.floor(Math.random() * results.length);
    return results[index] as any;
  }

  /**
   * Returns a random match with its full path as a tuple.
   */
  randomWithPath(): [TItem, string] {
    if (this.items === undefined) {
      throw new Error("randomWithPath() is only available on bound queries.");
    }
    const results = this._executeFilter();
    if (results.length === 0) {
      throw new Error("No matches found for randomWithPath().");
    }
    const randomIndex = Math.floor(Math.random() * results.length);
    const item = results[randomIndex];

    if (
      !this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      !this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items!;
      const unfilteredIndex = unfiltered.indexOf(item);
      const path =
        unfilteredIndex !== -1
          ? `${this.metadata.arrayPath}[${unfilteredIndex}]`
          : `${this.metadata.arrayPath}[${randomIndex}]`;
      return [item, path];
    }

    if (
      this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items!;
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

    return [item, `[${randomIndex}]`];
  }

  /**
   * Returns the last match. Throws if no matches.
   */
  last(): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("last") as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) {
      throw new Error("No matches found for last().");
    }
    return results[results.length - 1] as any;
  }

  /**
   * Returns the nth match by index.
   */
  nth(
    index: number,
  ): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("nth", index) as any;
    }
    const results = this._executeFilter();
    if (index < 0 || index >= results.length) {
      throw new Error(
        `Index ${index} out of bounds. Found ${results.length} matches.`,
      );
    }
    return results[index] as any;
  }

  /**
   * @internal
   */
  private _buildPathForItem(item: TItem, filteredIndex: number): string {
    if (
      !this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      !this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items!;
      const unfilteredIndex = unfiltered.indexOf(item);
      return unfilteredIndex !== -1
        ? `${this.metadata.arrayPath}[${unfilteredIndex}]`
        : `${this.metadata.arrayPath}[${filteredIndex}]`;
    }

    if (
      this.metadata?.groupsRootPath &&
      this.metadata?.arrayPath &&
      this.metadata?.itemMetadata
    ) {
      const unfiltered = this.items!;
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

    return `[${filteredIndex}]`;
  }

  /**
   * Returns a chainable path query helper.
   */
  path(): PathQuery {
    if (this.items === undefined) {
      throw new Error("path() is only available on bound queries.");
    }
    const results = this._executeFilter();
    const paths = results.map((item, index) =>
      this._buildPathForItem(item, index),
    );
    return new PathQuery(paths);
  }

  /**
   * Requires exactly one match.
   */
  one(
    message?: string,
  ): TMode extends "bound" ? TItem : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("one", message) as any;
    }
    const results = this._executeFilter();
    if (results.length !== 1) {
      throw new Error(
        message ?? `Expected exactly 1 match, found ${results.length}.`,
      );
    }
    return results[0] as any;
  }

  /**
   * Returns indices of all matching items.
   */
  index(): IndexQuery {
    if (this.items === undefined) {
      throw new Error("index() is only available on bound queries.");
    }
    const matchingIndices = this._executeFilter().map((item) =>
      this.items!.indexOf(item),
    );
    return new IndexQuery(matchingIndices);
  }

  /**
   * Returns all matching items with their original array indices.
   */
  allWithIndex(): Array<[number, TItem]> {
    if (this.items === undefined) {
      throw new Error("allWithIndex() is only available on bound queries.");
    }
    return this._executeFilter().map((item) => [
      this.items!.indexOf(item),
      item,
    ]);
  }

  // ── Map family ─────────────────────────────────────────────────────────

  /**
   * Applies fn to each item, returns a new ArrayQuery over the results.
   */
  map<TOut>(fn: (item: TItem) => TOut): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("map", fn);
    }
    const mapped = this._executeFilter().map((item) =>
      fn(ArrayQuery._cloneForUserFn(item)),
    );
    return ArrayQuery._bound<TOut>(mapped, this.metadata) as any;
  }

  /**
   * Extracts two paths per item, applies fn.
   */
  map2<TOut>(
    path1: string,
    path2: string,
    fn: (a: any, b: any) => TOut,
  ): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("map2", path1, path2, fn);
    }
    const mapped = this._executeFilter().map((item) =>
      fn(
        ArrayQuery._cloneForUserFn(getByPath(item as any, path1, true)),
        ArrayQuery._cloneForUserFn(getByPath(item as any, path2, true)),
      ),
    );
    return ArrayQuery._bound<TOut>(mapped, this.metadata) as any;
  }

  /**
   * Extracts N paths per item, applies fn.
   */
  mapn<TOut>(
    paths: string[],
    fn: (...values: any[]) => TOut,
  ): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("mapn", paths, fn);
    }
    const mapped = this._executeFilter().map((item) => {
      const values = paths.map((p) =>
        ArrayQuery._cloneForUserFn(getByPath(item as any, p, true)),
      );
      return fn(...values);
    });
    return ArrayQuery._bound<TOut>(mapped, this.metadata) as any;
  }

  // ── Reduce / Fold family ───────────────────────────────────────────────

  /**
   * Left-fold items into a single value.
   */
  reduce<TAcc>(
    fn: (acc: TAcc, item: TItem) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("reduce", fn, init) as any;
    }
    return this._executeFilter().reduce(
      (acc, item) => fn(acc, ArrayQuery._cloneForUserFn(item)),
      init,
    ) as any;
  }

  /**
   * Fold with two extracted path values.
   */
  reduce2<TAcc>(
    path1: string,
    path2: string,
    fn: (acc: TAcc, a: any, b: any) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("reduce2", path1, path2, fn, init) as any;
    }
    return this._executeFilter().reduce(
      (acc, item) =>
        fn(
          acc,
          ArrayQuery._cloneForUserFn(getByPath(item as any, path1, true)),
          ArrayQuery._cloneForUserFn(getByPath(item as any, path2, true)),
        ),
      init,
    ) as any;
  }

  /**
   * Fold with N extracted path values.
   */
  reducen<TAcc>(
    paths: string[],
    fn: (acc: TAcc, ...values: any[]) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("reducen", paths, fn, init) as any;
    }
    return this._executeFilter().reduce((acc, item) => {
      const values = paths.map((p) =>
        ArrayQuery._cloneForUserFn(getByPath(item as any, p, true)),
      );
      return fn(acc, ...values);
    }, init) as any;
  }

  /** Alias for reduce. */
  fold<TAcc>(
    fn: (acc: TAcc, item: TItem) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    return this.reduce(fn, init);
  }

  /** Alias for reduce2. */
  fold2<TAcc>(
    path1: string,
    path2: string,
    fn: (acc: TAcc, a: any, b: any) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    return this.reduce2(path1, path2, fn, init);
  }

  /** Alias for reducen. */
  foldn<TAcc>(
    paths: string[],
    fn: (acc: TAcc, ...values: any[]) => TAcc,
    init: TAcc,
  ): TMode extends "bound" ? TAcc : ArrayQuery<TItem, "unbound"> {
    return this.reducen(paths, fn, init);
  }

  // ── Core composable primitives ─────────────────────────────────────────

  /**
   * Maps each item to zero or more results, then flattens.
   */
  flatMap<TOut>(fn: (item: TItem) => TOut[]): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("flatMap", fn);
    }
    const result: TOut[] = [];
    for (const item of this._executeFilter()) {
      result.push(...fn(ArrayQuery._cloneForUserFn(item)));
    }
    return ArrayQuery._bound<TOut>(result, this.metadata) as any;
  }

  /**
   * Expands and flattens an array located at the given path for each item.
   */
  expand<TOut = any>(
    path: string,
    options?: { recursive?: boolean; strict?: boolean },
  ): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("expand", path, options);
    }

    const recursive = options?.recursive ?? false;
    const strict = options?.strict ?? false;
    const result: TOut[] = [];

    const getNested = (obj: any): any => {
      if (recursive) {
        try {
          return getByPath(obj as any, path);
        } catch {
          return undefined;
        }
      }
      return getByPath(obj as any, path, true);
    };

    for (const item of this._executeFilter()) {
      const initial = getNested(item);
      if (!Array.isArray(initial)) {
        throw new Error(
          `expand("${path}") expected an array at path for each item, but found ${typeof initial}.`,
        );
      }

      if (!recursive) {
        result.push(...(initial as TOut[]));
        continue;
      }

      const stack = [...(initial as TOut[])].reverse();
      while (stack.length > 0) {
        const node = stack.pop()!;
        result.push(node);

        const nested = getNested(node);
        if (!Array.isArray(nested)) {
          if (strict) {
            throw new Error(
              `expand("${path}") expected an array at path for each descendant, but found ${typeof nested}.`,
            );
          }
          continue;
        }
        for (let i = nested.length - 1; i >= 0; i--) {
          stack.push((nested as TOut[])[i]);
        }
      }
    }

    return ArrayQuery._bound<TOut>(result, this.metadata) as any;
  }

  /**
   * Immutably sets one path/value rule within each selected item.
   */
  set(
    path: string,
    value: unknown,
    options?: SetOptions,
  ): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("set", path, value, options);
    }

    const scope = options?.scope ?? "top-level";
    const updated = this._executeFilter().map((item) =>
      scope === "deep"
        ? setAllByPathOccurrences(item, path, value)
        : setTopLevelValue(item, path, value),
    );
    return ArrayQuery._bound<TItem>(updated as TItem[], this.metadata) as any;
  }

  /**
   * Immutably applies multiple path/value rules within each selected item.
   */
  setAll(
    updates: ReadonlyArray<SetAllUpdate>,
    options?: SetOptions,
  ): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("setAll", updates, options);
    }

    const scope = options?.scope ?? "deep";
    const updated = this._executeFilter().map((item) =>
      scope === "deep"
        ? setAllByPathOccurrencesBatch(item, updates)
        : setTopLevelValuesBatch(item, updates),
    );
    return ArrayQuery._bound<TItem>(updated as TItem[], this.metadata) as any;
  }

  /**
   * Returns one updated item per matched path occurrence.
   * Each result applies exactly one occurrence update independently.
   */
  setEach(path: string, value: unknown): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("setEach", path, value);
    }

    const variants = this._executeFilter().flatMap((item) =>
      setPathOccurrencesIndividually(item, path, value),
    );
    return ArrayQuery._bound<TItem>(variants as TItem[], this.metadata) as any;
  }

  /**
   * Immutably sets exactly one match for a path within each selected item.
   */
  setOne(
    path: string,
    value: unknown,
    options?: SetOneOptions,
  ): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("setOne", path, value, options);
    }

    const updated = this._executeFilter().map((item) =>
      setOneByPath(item, path, value, options),
    );
    return ArrayQuery._bound<TItem>(updated as TItem[], this.metadata) as any;
  }

  /**
   * Immutably replaces occurrences of a value within each selected item.
   *
   * - `scope: "deep"` (default): replace anywhere in the subtree.
   * - `scope: "top-level"`: replace only current item and direct fields/elements.
   */
  replaceValue(
    fromValue: unknown,
    toValue: unknown,
    options?: ReplaceValueOptions,
  ): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("replaceValue", fromValue, toValue, options);
    }

    const updated = this._executeFilter().map((item) =>
      replaceValueByScope(item, fromValue, toValue, options),
    );
    return ArrayQuery._bound<TItem>(updated as TItem[], this.metadata) as any;
  }

  /**
   * Immutably applies ordered replacement rules within each selected item.
   *
   * - `scope: "deep"` (default): replace anywhere in the subtree.
   * - `scope: "top-level"`: replace only current item and direct fields/elements.
   */
  replaceMany(
    rules: ReadonlyArray<ReplaceRule>,
    options?: ReplaceValueOptions,
  ): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("replaceMany", rules, options);
    }

    const updated = this._executeFilter().map((item) =>
      replaceManyByScope(item, rules, options),
    );
    return ArrayQuery._bound<TItem>(updated as TItem[], this.metadata) as any;
  }

  /**
   * Writes current array results back into root context and returns JsonQueryRoot.
   *
   * - Without `path`, uses the original bound array path.
   * - With `path`, writes to the explicit target path.
   */
  toRoot(
    this: ArrayQuery<TItem, "bound", true>,
    path?: string,
  ): JsonQueryRoot<any> {
    if (this.items === undefined) {
      throw new Error("toRoot() is only available on bound queries.");
    }
    if (!createJsonQueryRoot) {
      throw new Error(
        "toRoot() is unavailable: root factory is not registered.",
      );
    }

    if (this.metadata?.itemMetadata && this.metadata.itemMetadata.length > 0) {
      throw new Error(
        "toRoot() is not supported for grouped arrays. Use JsonQueryRoot.setAll()/setOne() to write back explicitly.",
      );
    }

    if (!this.metadata || !("rootSnapshot" in this.metadata)) {
      throw new Error(
        "toRoot() requires root context. Start from query(root).array(...).",
      );
    }

    const rootSnapshot = this.metadata.rootSnapshot;
    const targetPath = path ?? this.metadata.arrayPath;

    if (targetPath === undefined) {
      throw new Error(
        "toRoot() could not resolve target path. Provide toRoot(path) explicitly.",
      );
    }

    const updatedItems = this._executeFilter();
    const updatedRoot = setByPathStrict(rootSnapshot, targetPath, updatedItems);
    return createJsonQueryRoot(updatedRoot);
  }

  /**
   * Like reduce but returns all intermediate accumulator values.
   * Output length is n+1 (includes init).
   */
  scan<TAcc>(
    fn: (acc: TAcc, item: TItem) => TAcc,
    init: TAcc,
  ): ArrayQuery<TAcc, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TAcc>("scan", fn, init);
    }
    const items = this._executeFilter();
    const result: TAcc[] = [init];
    let acc = init;
    for (const item of items) {
      acc = fn(acc, ArrayQuery._cloneForUserFn(item));
      result.push(acc);
    }
    return ArrayQuery._bound<TAcc>(result, this.metadata) as any;
  }

  /**
   * Returns the first n items from filtered results.
   */
  take(n: number): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("take", n);
    }
    return ArrayQuery._bound<TItem>(
      this._executeFilter().slice(0, n),
      this.metadata,
    ) as any;
  }

  /**
   * Skips the first n items from filtered results.
   */
  drop(n: number): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("drop", n);
    }
    return ArrayQuery._bound<TItem>(
      this._executeFilter().slice(n),
      this.metadata,
    ) as any;
  }

  /**
   * Returns the longest prefix satisfying predicate.
   */
  takeWhile(fn: (item: TItem) => boolean): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("takeWhile", fn);
    }
    const items = this._executeFilter();
    const result: TItem[] = [];
    for (const item of items) {
      if (!fn(ArrayQuery._cloneForUserFn(item))) break;
      result.push(item);
    }
    return ArrayQuery._bound<TItem>(result, this.metadata) as any;
  }

  /**
   * Drops prefix satisfying predicate, returns remainder.
   */
  dropWhile(fn: (item: TItem) => boolean): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("dropWhile", fn);
    }
    const items = this._executeFilter();
    let i = 0;
    while (i < items.length && fn(ArrayQuery._cloneForUserFn(items[i]))) i++;
    return ArrayQuery._bound<TItem>(items.slice(i), this.metadata) as any;
  }

  /**
   * Splits into [matching, nonMatching]. Bound-only.
   */
  partition(
    fn: (item: TItem) => boolean,
  ): [ArrayQuery<TItem, "bound">, ArrayQuery<TItem, "bound">] {
    if (this.items === undefined) {
      throw new Error("partition() is only available on bound queries.");
    }
    const yes: TItem[] = [];
    const no: TItem[] = [];
    for (const item of this._executeFilter()) {
      (fn(ArrayQuery._cloneForUserFn(item)) ? yes : no).push(item);
    }
    return [
      ArrayQuery._bound<TItem>(yes, this.metadata),
      ArrayQuery._bound<TItem>(no, this.metadata),
    ];
  }

  /**
   * Pairs items with external array. Length = min of both.
   */
  zip<TOther>(other: TOther[]): ArrayQuery<[TItem, TOther], TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<[TItem, TOther]>("zip", other);
    }
    const items = this._executeFilter();
    const len = Math.min(items.length, other.length);
    const result: [TItem, TOther][] = [];
    for (let i = 0; i < len; i++) {
      result.push([items[i], other[i]]);
    }
    return ArrayQuery._bound<[TItem, TOther]>(result, this.metadata) as any;
  }

  /**
   * Combines items with external array using fn. Length = min of both.
   */
  zipWith<TOther, TOut>(
    other: TOther[],
    fn: (a: TItem, b: TOther) => TOut,
  ): ArrayQuery<TOut, TMode> {
    if (this.items === undefined) {
      return this._deriveUnbound<TOut>("zipWith", other, fn);
    }
    const items = this._executeFilter();
    const len = Math.min(items.length, other.length);
    const result: TOut[] = [];
    for (let i = 0; i < len; i++) {
      result.push(fn(ArrayQuery._cloneForUserFn(items[i]), other[i]));
    }
    return ArrayQuery._bound<TOut>(result, this.metadata) as any;
  }

  // ── Recipe extraction ──────────────────────────────────────────────────

  /**
   * Extracts a reusable pipeline (unbound ArrayQuery) from this chain.
   *
   * @param stripTerminal - If true, removes the last step (the terminal)
   *   so the caller can pick a different terminal at deploy time.
   */
  toRecipe(stripTerminal?: boolean): ArrayQuery<TItem, "unbound"> {
    const steps =
      stripTerminal && this.steps.length > 0
        ? this.steps.slice(0, -1)
        : [...this.steps];
    return ArrayQuery._fromSteps<TItem>(steps, this._arrayPath);
  }

  // ── Pipeline execution ─────────────────────────────────────────────────

  /**
   * Executes a pipeline against data, or applies a recipe to this query.
   *
   * On unbound (pipeline): supply data as input.
   *   - If arrayPath is set, extracts array from input object.
   *   - If arrayPath is undefined, input is TItem[] directly.
   *
   * On bound (query): supply a recipe (unbound ArrayQuery) to apply.
   */
  run(input: any): ArrayQuery<any, "bound"> {
    if (this.items === undefined) {
      // Unbound: input is data
      let items: any[];
      if (this._arrayPath !== undefined) {
        items = getByPath(input, this._arrayPath, true);
        if (!Array.isArray(items)) {
          throw new Error(
            `Expected array at path "${this._arrayPath}", got ${typeof items}.`,
          );
        }
      } else {
        items = input;
      }
      return ArrayQuery._replay(items, this.steps);
    } else {
      // Bound: input is a recipe
      const recipe = input as ArrayQuery<any, "unbound">;
      return ArrayQuery._replay(this._executeFilter(), recipe._getSteps());
    }
  }

  // ── Internal clause management ─────────────────────────────────────────

  /** @internal Used by WhereBuilder to append a clause. */
  _pushClause(clause: any): ArrayQuery<TItem, TMode> {
    const newSteps = [...this.steps, { method: "_pushClause", args: [clause] }];
    const newClauses =
      this.items !== undefined ? [...this.clauses, clause] : this.clauses;
    return new ArrayQuery<TItem, TMode>(
      this.items,
      newSteps,
      newClauses,
      this._arrayPath,
      this.metadata,
      this._sortPath,
      this._sortDirection,
      this._sortNulls,
      this._sortCoerceNumericStrings,
    );
  }

  private _assertBooleanTerminalHasSelectionContext(
    methodName: "exists" | "every",
  ): void {
    if (this.clauses.length === 0 && this.steps.length === 0) {
      throw new Error(
        `${methodName}() cannot be called directly after array(), flatArray(), or arrays(). Add a narrowing step first (for example where(), whereIn(), whereExists(), filter(), take(), or drop()).`,
      );
    }
  }
}

// ── Factory function ───────────────────────────────────────────────────

/**
 * Creates an empty reusable pipeline (no data, no terminals until .run()).
 *
 * ```typescript
 * const pipeline = arrayPipeline<Item>()
 *   .where('type').equals('Premium')
 *   .sort('price', { direction: 'desc' })
 *   .take(3);
 *
 * pipeline.run(datasetA).all();
 * pipeline.run(datasetB).first();
 * ```
 */
export function arrayPipeline<TItem>(): ArrayQuery<TItem, "unbound"> {
  return ArrayQuery._unbound<TItem>();
}

// ── Register circular reference for QueryResult ────────────────────────
_setArrayQueryRef(ArrayQuery);
