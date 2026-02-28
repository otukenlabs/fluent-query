/**
 * @file core/array-query.ts
 * @description Unified ArrayQuery class with phantom mode parameter.
 *
 * ArrayQuery<TItem, 'bound'>  — data attached, terminals execute eagerly.
 * ArrayQuery<TItem, 'unbound'> — no data, terminals record steps for later .run().
 */

import sift from "sift";
import { parseCompositeFilterExpression } from "../filters/logical-operators";
import { getByPath, getByPathStrict } from "../helpers/path";
import { AggregateQuery } from "../queries/aggregate-query";
import { IndexQuery } from "../queries/index-query";
import { PathQuery } from "../queries/path-query";
import { ValueArrayQuery } from "../queries/value-array-query";
import type { ArrayQueryMetadata, Primitive } from "../types";
import { isWhereStep, type PipelineStep } from "./pipeline-step";
import { _setArrayQueryRef, QueryResult } from "./query-result";
import { WhereBuilder } from "./where-builder";

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
 */
export class ArrayQuery<TItem, TMode extends "bound" | "unbound" = "bound"> {
  // ── Private state ──────────────────────────────────────────────────────

  private readonly items: TItem[] | undefined;
  private readonly steps: PipelineStep[];
  private readonly clauses: readonly any[];
  private readonly _arrayPath: string | undefined;
  private readonly metadata: ArrayQueryMetadata | undefined;
  private readonly _sortPath: string | undefined;
  private readonly _sortDirection: "asc" | "desc";

  // ── Constructor (private) ──────────────────────────────────────────────

  private constructor(
    items: TItem[] | undefined,
    steps: PipelineStep[],
    clauses: readonly any[],
    arrayPath: string | undefined,
    metadata: ArrayQueryMetadata | undefined,
    sortPath: string | undefined,
    sortDirection: "asc" | "desc",
  ) {
    this.items = items;
    this.steps = steps;
    this.clauses = clauses;
    this._arrayPath = arrayPath;
    this.metadata = metadata;
    this._sortPath = sortPath;
    this._sortDirection = sortDirection;
  }

  // ── Static factories ───────────────────────────────────────────────────

  /** @internal Create a bound instance (has data). */
  static _bound<T>(
    items: T[],
    metadata?: ArrayQueryMetadata,
  ): ArrayQuery<T, "bound"> {
    return new ArrayQuery<T, "bound">(
      items,
      [],
      [],
      metadata?.arrayPath,
      metadata,
      undefined,
      "asc",
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
    );
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

    if (!sortPath) {
      return items;
    }

    const sorted = [...items];
    sorted.sort((a, b) => {
      const valueA = getByPathStrict(a as any, sortPath);
      const valueB = getByPathStrict(b as any, sortPath);

      if (valueA === null || valueA === undefined) {
        return valueB === null || valueB === undefined ? 0 : 1;
      }
      if (valueB === null || valueB === undefined) {
        return -1;
      }

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
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): ArrayQuery<TItem, TMode> {
    const clause = parseCompositeFilterExpression(expression, options);
    return this._pushClause(clause);
  }

  /**
   * Conditionally applies filter() only when the provided param is defined
   * (i.e., not null and not undefined).
   * This is a single-param convenience wrapper over filterIfAllDefined().
   */
  filterIfDefined(
    expression: string,
    param: any,
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): ArrayQuery<TItem, TMode> {
    return this.filterIfAllDefined(expression, [param], options);
  }

  /**
   * Conditionally applies filter() only when all provided params are defined
   * (i.e., each is not null and not undefined).
   */
  filterIfAllDefined(
    expression: string,
    params: readonly any[] | Record<string, any>,
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): ArrayQuery<TItem, TMode> {
    const values = Array.isArray(params) ? params : Object.values(params);
    if (values.every((value) => value !== null && value !== undefined)) {
      return this.filter(expression, options);
    }
    return this;
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
   * Conditionally applies where().equals() if value is defined.
   */
  whereIfDefined(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.where(path);
      if (options?.ignoreCase === false) builder.ignoreCase(false);
      if (options?.trim === false) builder.noTrim();
      return builder.equals(value);
    }
    return this;
  }

  /**
   * Conditionally applies whereNot().equals() if value is defined.
   */
  whereNotIfDefined(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayQuery<TItem, TMode> {
    if (value !== null && value !== undefined) {
      const builder = this.whereNot(path);
      if (options?.ignoreCase === false) builder.ignoreCase(false);
      if (options?.trim === false) builder.noTrim();
      return builder.equals(value);
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
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
      if (options?.ignoreCase !== false) builder.ignoreCase();
      if (options?.trim === false) builder.noTrim();
      return builder.endsWith(value);
    }
    return this;
  }

  /**
   * Filters items where value at path is in the provided list.
   */
  whereIn(path: string, values: Primitive[]): ArrayQuery<TItem, TMode> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `whereIn("${path}") requires a non-empty array of values.`,
      );
    }
    return this._pushClause({ [path]: { $in: values } });
  }

  /**
   * Filters items where all provided field-value pairs match exactly.
   */
  whereAll(criteria: Record<string, Primitive>): ArrayQuery<TItem, TMode> {
    return this._pushClause(criteria);
  }

  /**
   * Sorts items by the value at the given path.
   */
  sort(
    path: string,
    direction: "asc" | "desc" = "asc",
  ): ArrayQuery<TItem, TMode> {
    return new ArrayQuery<TItem, TMode>(
      this.items,
      [...this.steps, { method: "sort", args: [path, direction] }],
      this.clauses,
      this._arrayPath,
      this.metadata,
      path,
      direction,
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
   * Returns true if at least one item matches.
   */
  exists(): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("exists") as any;
    }
    return (this._executeFilter().length > 0) as any;
  }

  /**
   * Returns true if all items match the filters.
   */
  every(): TMode extends "bound" ? boolean : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("every") as any;
    }
    return (this._executeFilter().length === this.items!.length) as any;
  }

  /**
   * Returns the sum of values at path.
   */
  sum(
    path: string,
  ): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("sum", path) as any;
    }
    const results = this._executeFilter();
    return results.reduce((total, item) => {
      const value = getByPathStrict(item as any, path);
      const num = typeof value === "number" ? value : 0;
      return total + num;
    }, 0) as any;
  }

  /**
   * Returns the average of values at path.
   */
  average(
    path: string,
  ): TMode extends "bound" ? number : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("average", path) as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) return 0 as any;
    const total = results.reduce((sum, item) => {
      const value = getByPathStrict(item as any, path);
      return sum + (typeof value === "number" ? value : 0);
    }, 0);
    return (total / results.length) as any;
  }

  /**
   * Returns the minimum value at path.
   */
  min(
    path: string,
  ): TMode extends "bound" ? number | null : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("min", path) as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) return null as any;
    const values = results
      .map((item) => getByPathStrict(item as any, path))
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
      .map(Number);
    return (values.length > 0 ? Math.min(...values) : null) as any;
  }

  /**
   * Returns the maximum value at path.
   */
  max(
    path: string,
  ): TMode extends "bound" ? number | null : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("max", path) as any;
    }
    const results = this._executeFilter();
    if (results.length === 0) return null as any;
    const values = results
      .map((item) => getByPathStrict(item as any, path))
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
        const value = getByPathStrict(item as any, path);
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
      const groupValue = getByPathStrict(item as any, path);
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
  distinct(
    path?: string,
  ): TMode extends "bound" ? TItem[] : ArrayQuery<TItem, "unbound"> {
    if (this.items === undefined) {
      return this._appendStep("distinct", path) as any;
    }
    const results = this._executeFilter();
    if (!path) {
      return Array.from(new Set(results)) as any;
    }

    const seen = new Set<any>();
    const unique: TItem[] = [];
    const isDotPath = path.includes(".");

    for (const item of results) {
      const value = isDotPath
        ? getByPathStrict(item as any, path)
        : this._getUniqueDeepPropertyValue(item as any, path);
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(item);
      }
    }

    return unique as any;
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
  findAll<TValue = any>(pathOrProperty: string): ValueArrayQuery<TValue> {
    if (this.items === undefined) {
      throw new Error("findAll() is only available on bound queries.");
    }
    const results: TValue[] = [];
    const isPath = pathOrProperty.includes(".");

    const recursiveSearch = (obj: any): void => {
      if (obj === null || obj === undefined) {
        return;
      }

      if (typeof obj === "object") {
        if (isPath) {
          const value = getByPathStrict(obj, pathOrProperty);
          if (value !== undefined) {
            results.push(value);
          }
        } else {
          if (pathOrProperty in obj) {
            results.push(obj[pathOrProperty]);
          }
        }

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
    ...rest: string[]
  ): Array<Record<string, any>> {
    if (this.items === undefined) {
      throw new Error("pick() is only available on bound queries.");
    }
    return this._executeFilter().map((item) => {
      const result: Record<string, any> = {};

      if (typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)) {
        for (const [key, path] of Object.entries(pathOrPaths)) {
          result[key] = getByPathStrict(item as any, path);
        }
      } else {
        const paths = Array.isArray(pathOrPaths)
          ? pathOrPaths
          : [pathOrPaths, ...rest];
        for (const path of paths) {
          result[path] = getByPathStrict(item as any, path);
        }
      }

      return result;
    });
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
    const mapped = this._executeFilter().map(fn);
    return ArrayQuery._bound<TOut>(mapped) as any;
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
        getByPathStrict(item as any, path1),
        getByPathStrict(item as any, path2),
      ),
    );
    return ArrayQuery._bound<TOut>(mapped) as any;
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
      const values = paths.map((p) => getByPathStrict(item as any, p));
      return fn(...values);
    });
    return ArrayQuery._bound<TOut>(mapped) as any;
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
    return this._executeFilter().reduce(fn, init) as any;
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
          getByPathStrict(item as any, path1),
          getByPathStrict(item as any, path2),
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
      const values = paths.map((p) => getByPathStrict(item as any, p));
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
      result.push(...fn(item));
    }
    return ArrayQuery._bound<TOut>(result) as any;
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
      acc = fn(acc, item);
      result.push(acc);
    }
    return ArrayQuery._bound<TAcc>(result) as any;
  }

  /**
   * Returns the first n items from filtered results.
   */
  take(n: number): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("take", n);
    }
    return ArrayQuery._bound<TItem>(this._executeFilter().slice(0, n)) as any;
  }

  /**
   * Skips the first n items from filtered results.
   */
  drop(n: number): ArrayQuery<TItem, TMode> {
    if (this.items === undefined) {
      return this._appendStep("drop", n);
    }
    return ArrayQuery._bound<TItem>(this._executeFilter().slice(n)) as any;
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
      if (!fn(item)) break;
      result.push(item);
    }
    return ArrayQuery._bound<TItem>(result) as any;
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
    while (i < items.length && fn(items[i])) i++;
    return ArrayQuery._bound<TItem>(items.slice(i)) as any;
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
      (fn(item) ? yes : no).push(item);
    }
    return [ArrayQuery._bound<TItem>(yes), ArrayQuery._bound<TItem>(no)];
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
    return ArrayQuery._bound<[TItem, TOther]>(result) as any;
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
      result.push(fn(items[i], other[i]));
    }
    return ArrayQuery._bound<TOut>(result) as any;
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
        items = getByPathStrict(input, this._arrayPath);
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
    );
  }
}

// ── Factory function ───────────────────────────────────────────────────

/**
 * Creates an empty reusable pipeline (no data, no terminals until .run()).
 *
 * ```typescript
 * const pipeline = arrayPipeline<Item>()
 *   .where('type').equals('Premium')
 *   .sort('price', 'desc')
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
