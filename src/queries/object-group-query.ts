/**
 * @file queries/object-group-query.ts
 * @description ObjectGroupQuery helper for selecting child objects under a "groups" object.
 */

import sift from "sift";
import { ArrayQuery } from "../core/array-query";
import { parseCompositeFilterExpression } from "../filters/logical-operators";
import { type CompactOptions, compactValue } from "../helpers/compact";
import { diffValues } from "../helpers/diff";
import { hasAllInAny } from "../helpers/has-all";
import { buildNumericComparisonClause } from "../helpers/numeric-comparison";
import { getByPath } from "../helpers/path";
import { makeRegex } from "../helpers/regex";
import {
  replaceManyByScope,
  replaceValueByScope,
} from "../helpers/replace-value";
import {
  type SetAllUpdate,
  setAllByPathOccurrences,
  setAllByPathOccurrencesBatch,
} from "../helpers/set-all";
import { setByPath } from "../helpers/set-by-path";
import { setPathOccurrencesIndividually } from "../helpers/set-each";
import { type SetOneOptions, setOneByPath } from "../helpers/set-one";
import {
  setTopLevelValue,
  setTopLevelValuesBatch,
} from "../helpers/set-top-level";
import {
  type UnsetOptions,
  unsetByPathStrict,
  unsetByPathsStrict,
} from "../helpers/unset-by-path";
import type {
  DiffOptions,
  DiffResult,
  FindOptions,
  GroupItemMetadata,
  HasAllOptions,
  NumericComparisonOptions,
  Primitive,
  ReplaceRule,
  ReplaceValueOptions,
  SetAtOptions,
  SetOptions,
  WhereOptions,
} from "../types";

/**
 * Helper for selecting child objects under a "groups" object.
 */
export class ObjectGroupQuery {
  private includeKeys?: Set<string>;
  private excludeKeys?: Set<string>;

  private cloneWithGroups(groups: Record<string, unknown>): ObjectGroupQuery {
    const next = new ObjectGroupQuery(groups, this.groupsRootPath);
    if (this.includeKeys) {
      next.include([...this.includeKeys]);
    }
    if (this.excludeKeys) {
      next.exclude([...this.excludeKeys]);
    }
    return next;
  }

  private withSelectedKeys(keys: string[]): ObjectGroupQuery {
    const next = this.cloneWithGroups(this.groups);
    next.include(keys);
    return next;
  }

  private filterSelectedBy(
    predicate: (value: unknown, key: string) => boolean,
  ): ObjectGroupQuery {
    const matchedKeys = this.entries()
      .filter(([key, value]) => predicate(value, key))
      .map(([key]) => key);
    return this.withSelectedKeys(matchedKeys);
  }

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

  private isKeySelected(key: string): boolean {
    if (this.includeKeys && !this.includeKeys.has(key)) return false;
    if (this.excludeKeys?.has(key)) return false;
    return true;
  }

  constructor(
    private readonly groups: Record<string, unknown>,
    private readonly groupsRootPath?: string,
  ) {}

  /** Include only the given group key(s). */
  include(keys: string | string[]): this {
    const keyList = Array.isArray(keys) ? keys : [keys];
    this.includeKeys = new Set(keyList);
    return this;
  }

  /** Exclude the given group key(s). */
  exclude(keys: string | string[]): this {
    const keyList = Array.isArray(keys) ? keys : [keys];
    this.excludeKeys = new Set(keyList);
    return this;
  }

  /** Returns the filtered group entries. */
  entries(): Array<[string, any]> {
    return Object.entries(this.groups).filter(([key]) =>
      this.isKeySelected(key),
    );
  }

  /** @internal Applies a sift clause against selected group values. */
  _applyWhereClause(clause: any): ObjectGroupQuery {
    const matcher = sift(clause);
    return this.filterSelectedBy((value) => matcher(value));
  }

  /** Begins a where clause on selected group values. */
  where(path: string): ObjectGroupWhereBuilder {
    return new ObjectGroupWhereBuilder(this, path);
  }

  /** Begins a negated where clause on selected group values. */
  whereNot(path: string): ObjectGroupWhereBuilder {
    return new ObjectGroupWhereBuilder(this, path, true);
  }

  /** Begins a where clause against each selected group value itself. */
  whereSelf(): ObjectGroupWhereBuilder {
    return new ObjectGroupWhereBuilder(this, "");
  }

  /** Filters selected group values using a DSL expression. */
  filter(
    expression: string,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
    const clause = parseCompositeFilterExpression(expression, options);
    return this._applyWhereClause(clause);
  }

  /** Applies a raw sift query to selected group values. */
  whereSift(siftQuery: any): ObjectGroupQuery {
    return this._applyWhereClause(siftQuery);
  }

  /** Conditionally applies where().equals() if value is defined. */
  whereIfDefined(
    path: string,
    value: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
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

  /** Conditionally applies whereNot().equals() if value is defined. */
  whereNotIfDefined(
    path: string,
    value: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
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

  /** Conditionally applies filter() when the provided param is defined. */
  filterIfDefined(
    expression: string,
    param: any,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
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

  /** Conditionally applies filter() when all provided params are defined. */
  filterIfAllDefined(
    expression: string,
    params: Record<string, any>,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      decimals?: number;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
    if (Array.isArray(params)) {
      throw new Error(
        "filterIfAllDefined() expects an object map of params (e.g. { minPrice, maxPrice }). Array params are not supported.",
      );
    }

    for (const value of Object.values(params)) {
      if (value === null || value === undefined) {
        return this;
      }
    }

    if (/\$[a-zA-Z_][a-zA-Z0-9_]*/.test(expression)) {
      const boundExpression = this._bindExpressionParams(expression, params);
      return this.filter(boundExpression, options);
    }

    return this.filter(expression, options);
  }

  /** Filters selected group values where value at path is in the provided list. */
  whereIn(
    path: string,
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ObjectGroupQuery {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereIn("${path}") requires a non-empty array of values.`,
      );
    }
    const shouldCoerceNumericStrings = options?.coerceNumericStrings !== false;
    const hasNumericValues = values.some(
      (v) => typeof v === "number" && Number.isFinite(v),
    );

    if (shouldCoerceNumericStrings && hasNumericValues) {
      return this._applyWhereClause({
        $where: function (this: any) {
          let fieldValue: any;
          try {
            fieldValue = path === "" ? this : this[path];
          } catch {
            return false;
          }

          for (const val of values) {
            if (fieldValue === val) return true;

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

    if (path === "") {
      return this._applyWhereClause({ $in: values });
    }

    return this._applyWhereClause({ [path]: { $in: values } });
  }

  /** Filters selected group values where value at path is NOT in the provided list. */
  whereNotIn(
    path: string,
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ObjectGroupQuery {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereNotIn("${path}") requires a non-empty array of values.`,
      );
    }
    const shouldCoerceNumericStrings = options?.coerceNumericStrings !== false;
    const hasNumericValues = values.some(
      (v) => typeof v === "number" && Number.isFinite(v),
    );

    if (shouldCoerceNumericStrings && hasNumericValues) {
      return this._applyWhereClause({
        $where: function (this: any) {
          let fieldValue: any;
          try {
            fieldValue = path === "" ? this : this[path];
          } catch {
            return true;
          }

          for (const val of values) {
            if (fieldValue === val) return false;

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

          return true;
        },
      });
    }

    if (path === "") {
      return this._applyWhereClause({ $nin: values });
    }

    return this._applyWhereClause({ [path]: { $nin: values } });
  }

  /** Filters selected group values where key(s) at path do not exist. */
  whereMissing(path: string | string[]): ObjectGroupQuery {
    if (Array.isArray(path)) {
      return this._applyWhereClause({
        $and: path.map((p) => ({ [p]: { $exists: false } })),
      });
    }
    return this._applyWhereClause({ [path]: { $exists: false } });
  }

  /** Filters selected group values where key(s) at path exist. */
  whereExists(path: string | string[]): ObjectGroupQuery {
    if (Array.isArray(path)) {
      return this._applyWhereClause({
        $and: path.map((p) => ({ [p]: { $exists: true } })),
      });
    }
    return this._applyWhereClause({ [path]: { $exists: true } });
  }

  /** Filters selected group values where all provided field-value pairs match exactly. */
  whereAll(criteria: Record<string, Primitive>): ObjectGroupQuery {
    return this._applyWhereClause(criteria);
  }

  /** Filters selected group values where ANY provided field-value pair matches exactly. */
  whereAny(criteria: Record<string, Primitive>): ObjectGroupQuery {
    const entries = Object.entries(criteria);
    if (entries.length === 0) {
      throw new Error("whereAny() requires at least one criterion.");
    }

    const orClauses = entries.map(([key, value]) => ({ [key]: value }));
    return this._applyWhereClause({ $or: orClauses });
  }

  /** Filters selected group values where NONE of the provided field-value pairs match exactly. */
  whereNone(criteria: Record<string, Primitive>): ObjectGroupQuery {
    const entries = Object.entries(criteria);
    if (entries.length === 0) {
      throw new Error("whereNone() requires at least one criterion.");
    }

    const norClauses = entries.map(([key, value]) => ({ [key]: value }));
    return this._applyWhereClause({ $nor: norClauses });
  }

  /** Sorts selected groups by a nested value in each group object (or by group value when path is empty). */
  sort(
    path: string = "",
    options?: { direction?: "asc" | "desc"; nulls?: "last" | "first" },
  ): ObjectGroupQuery {
    const direction = options?.direction ?? "asc";
    const nulls = options?.nulls ?? "last";

    const selectedKeys = new Set(this.entries().map(([key]) => key));
    const selectedEntries = Object.entries(this.groups).filter(([key]) =>
      selectedKeys.has(key),
    );

    selectedEntries.sort((a, b) => {
      const valueA =
        path === "" ? (a[1] as any) : getByPath(a[1] as any, path, true);
      const valueB =
        path === "" ? (b[1] as any) : getByPath(b[1] as any, path, true);

      if (valueA === null || valueA === undefined) {
        if (valueB === null || valueB === undefined) {
          return 0;
        }
        return nulls === "last" ? 1 : -1;
      }
      if (valueB === null || valueB === undefined) {
        return nulls === "last" ? -1 : 1;
      }

      let comparison = 0;
      if (valueA < valueB) {
        comparison = -1;
      } else if (valueA > valueB) {
        comparison = 1;
      }

      return direction === "asc" ? comparison : -comparison;
    });

    const reordered: Record<string, unknown> = {};
    for (const [key, value] of selectedEntries) {
      reordered[key] = value;
    }
    for (const [key, value] of Object.entries(this.groups)) {
      if (!selectedKeys.has(key)) {
        reordered[key] = value;
      }
    }

    return this.cloneWithGroups(reordered);
  }

  /**
   * Picks properties from each selected group value.
   */
  pick(
    pathOrPaths: string | string[] | Record<string, string>,
    ...additionalPaths: string[]
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};

    for (const [key, groupValue] of Object.entries(this.groups)) {
      if (!this.isKeySelected(key)) {
        updated[key] = groupValue;
        continue;
      }

      const result: Record<string, any> = {};

      if (typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)) {
        for (const [alias, path] of Object.entries(pathOrPaths)) {
          result[alias] = getByPath(groupValue as any, path, true);
        }
      } else {
        const paths = Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...additionalPaths];
        for (const path of paths) {
          result[path] = getByPath(groupValue as any, path, true);
        }
      }

      updated[key] = result;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Omits properties from each selected group value.
   */
  omit(
    pathOrPaths: string | string[] | Record<string, string>,
    ...additionalPaths: string[]
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};
    const paths =
      typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)
        ? Object.values(pathOrPaths)
        : Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...additionalPaths];

    for (const [key, groupValue] of Object.entries(this.groups)) {
      if (!this.isKeySelected(key)) {
        updated[key] = groupValue;
        continue;
      }

      if (
        groupValue === null ||
        groupValue === undefined ||
        typeof groupValue !== "object"
      ) {
        throw new Error("omit() is only supported for object group values.");
      }

      let next: unknown = groupValue;
      for (const path of paths) {
        next = unsetByPathStrict(next, path, { onMissing: "ignore" });
      }
      updated[key] = next;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Compacts selected group values.
   */
  compact(options?: CompactOptions): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};

    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? compactValue(groupValue, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably sets an exact path inside selected group values.
   */
  setAt(
    path: string,
    value: unknown,
    options?: SetAtOptions,
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? setByPath(groupValue, path, value, {
            createMissing: options?.createMissing,
            methodName: "setAt",
          })
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably removes an exact path inside selected group values.
   */
  unset(path: string, options?: UnsetOptions): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? unsetByPathStrict(groupValue, path, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably removes multiple paths inside selected group values.
   */
  unsetAll(
    paths: ReadonlyArray<string>,
    options?: UnsetOptions,
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? unsetByPathsStrict(groupValue, paths, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably sets one path/value rule inside selected group values.
   */
  set(path: string, value: unknown, options?: SetOptions): ObjectGroupQuery {
    const scope = options?.scope ?? "top-level";
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? scope === "deep"
          ? setAllByPathOccurrences(groupValue, path, value)
          : setTopLevelValue(groupValue, path, value)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably applies multiple path/value rules inside selected group values.
   */
  setAll(
    updates: ReadonlyArray<SetAllUpdate>,
    options?: SetOptions,
  ): ObjectGroupQuery {
    const scope = options?.scope ?? "deep";
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? scope === "deep"
          ? setAllByPathOccurrencesBatch(groupValue, updates)
          : setTopLevelValuesBatch(groupValue, updates)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Returns one updated group value per matched path occurrence across selected groups.
   * Each result applies exactly one occurrence update independently.
   */
  setEach(path: string, value: unknown): ArrayQuery<any, "bound"> {
    const variants: unknown[] = [];
    for (const [key, groupValue] of Object.entries(this.groups)) {
      if (!this.isKeySelected(key)) {
        continue;
      }
      variants.push(...setPathOccurrencesIndividually(groupValue, path, value));
    }
    return ArrayQuery._bound(variants);
  }

  /**
   * Immutably replaces matched values inside selected group values.
   */
  replaceValue(
    fromValue: unknown,
    toValue: unknown,
    options?: ReplaceValueOptions,
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};

    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? replaceValueByScope(groupValue, fromValue, toValue, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Immutably applies ordered replacement rules inside selected group values.
   */
  replaceMany(
    rules: ReadonlyArray<ReplaceRule>,
    options?: ReplaceValueOptions,
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};

    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? replaceManyByScope(groupValue, rules, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Compares each selected group value against expected and returns diff summary.
   */
  diff(expected: unknown, options?: DiffOptions): DiffResult {
    const max = options?.maxMismatches;
    const maxMismatches =
      typeof max === "number" && Number.isFinite(max) && max > 0
        ? Math.floor(max)
        : Number.POSITIVE_INFINITY;

    const mismatches: DiffResult["mismatches"] = [];
    let truncated = false;

    for (const [key, value] of this.entries()) {
      if (mismatches.length >= maxMismatches) {
        truncated = true;
        break;
      }

      const result = diffValues(expected, value, {
        ...options,
        maxMismatches: maxMismatches - mismatches.length,
      });

      for (const mismatch of result.mismatches) {
        mismatches.push({ ...mismatch, groupKey: key });
      }

      if (result.truncated || mismatches.length >= maxMismatches) {
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

    return result;
  }

  /**
   * Returns true when any selected group value satisfies all criteria under the chosen scope.
   */
  hasAll(criteria: Record<string, unknown>, options?: HasAllOptions): boolean {
    return hasAllInAny(this.values(), criteria, options);
  }

  /**
   * Returns true when any selected group value satisfies a single key/value pair under the chosen scope.
   */
  has(key: string, value: unknown, options?: HasAllOptions): boolean {
    return this.hasAll({ [key]: value }, options);
  }

  /**
   * Immutably sets exactly one match for a path inside selected group values.
   */
  setOne(
    path: string,
    value: unknown,
    options?: SetOneOptions,
  ): ObjectGroupQuery {
    const updated: Record<string, unknown> = {};
    for (const [key, groupValue] of Object.entries(this.groups)) {
      updated[key] = this.isKeySelected(key)
        ? setOneByPath(groupValue, path, value, options)
        : groupValue;
    }

    return this.cloneWithGroups(updated);
  }

  /**
   * Searches selected group values for a property/path using scope controls.
   */
  find<TValue = any>(pathOrProperty: string, options?: FindOptions) {
    return ArrayQuery._bound(this.values()).find<TValue>(
      pathOrProperty,
      options,
    );
  }

  /** Returns the filtered group values. */
  values(): any[] {
    return this.entries().map(([, value]) => value);
  }

  /** Returns a fully detached deep clone of selected groups keyed by group key. */
  deepClone(): Record<string, unknown> {
    return cloneForUserFn(Object.fromEntries(this.entries()));
  }

  /**
   * Returns a flattened array from each group value at `arrayPath`.
   * Throws if any group value doesn't contain an array at the path.
   * @private
   */
  private flatArrayValues<TItem = any>(arrayPath: string): TItem[] {
    const results: TItem[] = [];
    for (const [key, value] of this.entries()) {
      const arr = getByPath(value as any, arrayPath, true);
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected array at path "${arrayPath}" in group "${key}".`,
        );
      }
      results.push(...(arr as TItem[]));
    }
    return results;
  }

  /**
   * Returns flattened array items alongside metadata about their source group and index.
   * @private
   */
  private flatArrayWithMetadata<TItem = any>(
    arrayPath: string,
  ): Array<[TItem, GroupItemMetadata]> {
    const results: Array<[TItem, GroupItemMetadata]> = [];
    for (const [key, value] of this.entries()) {
      const arr = getByPath(value as any, arrayPath, true);
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected array at path "${arrayPath}" in group "${key}".`,
        );
      }
      arr.forEach((item, index) => {
        results.push([item, { groupKey: key, itemIndex: index }]);
      });
    }
    return results;
  }

  /**
   * Returns an ArrayQuery for the flattened array at `arrayPath`.
   * Useful for chaining `.where(...)` filters.
   *
   * @example
   * ```ts
   * const active = query(resp)
   * .objectGroups('sections')
   * .exclude(['archived', 'pending'])
   * .flatArray('items')
   * .where('attributes.visible.value')
   * .equals(true)
   * .all();
   * ```
   */
  flatArray<TItem = any>(
    arrayPath: string,
  ): Omit<ArrayQuery<TItem, "bound", false>, "toRoot"> & {
    exists: never;
    every: never;
  } {
    const items = this.flatArrayValues<TItem>(arrayPath);
    const metadata = this.flatArrayWithMetadata<TItem>(arrayPath).map(
      ([, m]) => m,
    );
    return ArrayQuery._bound<TItem, false>(items, {
      groupsRootPath: this.groupsRootPath,
      arrayPath,
      itemMetadata: metadata,
    }) as unknown as Omit<ArrayQuery<TItem, "bound", false>, "toRoot"> & {
      exists: never;
      every: never;
    };
  }

  /**
   * Alias of `flatArray(arrayPath)`.
   */
  arrays<TItem = any>(
    arrayPath: string,
  ): Omit<ArrayQuery<TItem, "bound", false>, "toRoot"> & {
    exists: never;
    every: never;
  } {
    return this.flatArray<TItem>(arrayPath);
  }

  /** Returns a random [key, value] entry. Throws if no groups match. */
  randomEntry(): [string, any] {
    const entries = this.entries();
    if (entries.length === 0) {
      throw new Error("No group entries found for randomEntry().");
    }
    const index = Math.floor(Math.random() * entries.length);
    return [entries[index][0], entries[index][1]];
  }

  /** Returns a random group value. Throws if no groups match. */
  randomValue(): any {
    const [, value] = this.randomEntry();
    return value;
  }
}

function cloneForUserFn<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneForUserFn(item)) as T;
  }

  if (typeof value === "object") {
    const clone: Record<string, any> = {};
    for (const [key, val] of Object.entries(value as Record<string, any>)) {
      clone[key] = cloneForUserFn(val);
    }
    return clone as T;
  }

  return value;
}

/**
 * Builder for a single `ObjectGroupQuery.where(path)` clause.
 */
export class ObjectGroupWhereBuilder {
  private opts: Required<WhereOptions> = { caseInsensitive: false, trim: true };
  private negate: boolean;

  private _buildClause(condition: unknown): any {
    if (this.path === "") {
      return condition;
    }
    return { [this.path]: condition };
  }

  constructor(
    private readonly parent: ObjectGroupQuery,
    private readonly path: string,
    negate: boolean = false,
  ) {
    this.negate = negate;
  }

  not(): this {
    this.negate = true;
    return this;
  }

  ignoreCase(enabled: boolean = true): this {
    this.opts.caseInsensitive = enabled;
    return this;
  }

  trim(): this {
    this.opts.trim = true;
    return this;
  }

  noTrim(): this {
    this.opts.trim = false;
    return this;
  }

  equals(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
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
              fieldValue = this[path];
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

      return this.parent._applyWhereClause(numericClause);
    }

    if (typeof value === "string") {
      const regex = makeRegex(value, "exact", this.opts);
      return this.parent._applyWhereClause(
        this._buildClause(this.negate ? { $not: regex } : regex),
      );
    }

    if (this.negate) {
      return this.parent._applyWhereClause(this._buildClause({ $ne: value }));
    }

    return this.parent._applyWhereClause(this._buildClause(value));
  }

  eq(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
    return this.equals(value, options);
  }

  notEquals(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
    return this.not().equals(value, options);
  }

  ne(
    value: Primitive,
    options?: {
      ignoreCase?: boolean;
      trim?: boolean;
      coerceNumericStrings?: boolean;
    },
  ): ObjectGroupQuery {
    return this.notEquals(value, options);
  }

  in(
    values: Primitive[],
    options?: { coerceNumericStrings?: boolean },
  ): ObjectGroupQuery {
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

  contains(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ObjectGroupQuery {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }

    const regex = makeRegex(value, "contains", this.opts);
    return this.parent._applyWhereClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
  }

  startsWith(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ObjectGroupQuery {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }

    const regex = makeRegex(value, "startsWith", this.opts);
    return this.parent._applyWhereClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
  }

  endsWith(
    value: string,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ObjectGroupQuery {
    if (options) {
      if (options.ignoreCase !== undefined) {
        this.opts.caseInsensitive = options.ignoreCase;
      }
      if (options.trim !== undefined) {
        this.opts.trim = options.trim;
      }
    }

    const regex = makeRegex(value, "endsWith", this.opts);
    return this.parent._applyWhereClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
  }

  matches(regex: RegExp): ObjectGroupQuery {
    return this.parent._applyWhereClause(
      this._buildClause(this.negate ? { $not: regex } : regex),
    );
  }

  greaterThan(
    value: number,
    options?: NumericComparisonOptions,
  ): ObjectGroupQuery {
    return this.parent._applyWhereClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "lte" : "gt",
        value,
        options,
      ),
    );
  }

  gt(value: number, options?: NumericComparisonOptions): ObjectGroupQuery {
    return this.greaterThan(value, options);
  }

  greaterThanOrEqual(
    value: number,
    options?: NumericComparisonOptions,
  ): ObjectGroupQuery {
    return this.parent._applyWhereClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "lt" : "gte",
        value,
        options,
      ),
    );
  }

  gte(value: number, options?: NumericComparisonOptions): ObjectGroupQuery {
    return this.greaterThanOrEqual(value, options);
  }

  lessThan(
    value: number,
    options?: NumericComparisonOptions,
  ): ObjectGroupQuery {
    return this.parent._applyWhereClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "gte" : "lt",
        value,
        options,
      ),
    );
  }

  lt(value: number, options?: NumericComparisonOptions): ObjectGroupQuery {
    return this.lessThan(value, options);
  }

  lessThanOrEqual(
    value: number,
    options?: NumericComparisonOptions,
  ): ObjectGroupQuery {
    return this.parent._applyWhereClause(
      buildNumericComparisonClause(
        this.path,
        this.negate ? "gt" : "lte",
        value,
        options,
      ),
    );
  }

  lte(value: number, options?: NumericComparisonOptions): ObjectGroupQuery {
    return this.lessThanOrEqual(value, options);
  }
}
