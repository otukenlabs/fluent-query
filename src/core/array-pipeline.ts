/**
 * @file core/array-pipeline.ts
 * @description Reusable, data-independent query composition via lazy step recording.
 */

import { ArrayQuery } from "./array-query";
import type { Primitive } from "../types";

/**
 * A recorded step in the pipeline.
 *
 * Most methods record `{ method, args }`.  The `where`/`whereNot` family
 * records the full chain including modifiers and the terminal call.
 */
type PipelineStep =
  | { method: string; args: any[] }
  | {
      method: "where" | "whereNot";
      args: [string];
      modifiers: { name: string; args: any[] }[];
      terminal: { method: string; args: any[] };
    };

function isWhereStep(
  step: PipelineStep,
): step is Extract<PipelineStep, { modifiers: any }> {
  return "modifiers" in step;
}

/**
 * Proxy that mirrors `WhereBuilder` method names, recording the full
 * where-chain (path + modifiers + terminal) as a single pipeline step.
 */
class PipelineWhereBuilder<TItem> {
  private readonly modifiers: { name: string; args: any[] }[] = [];

  constructor(
    private readonly pipeline: ArrayPipeline<TItem>,
    private readonly method: "where" | "whereNot",
    private readonly path: string,
  ) {}

  // -- Modifier methods (return this) --

  not(): this {
    this.modifiers.push({ name: "not", args: [] });
    return this;
  }

  ignoreCase(): this {
    this.modifiers.push({ name: "ignoreCase", args: [] });
    return this;
  }

  caseSensitive(): this {
    this.modifiers.push({ name: "caseSensitive", args: [] });
    return this;
  }

  trim(): this {
    this.modifiers.push({ name: "trim", args: [] });
    return this;
  }

  noTrim(): this {
    this.modifiers.push({ name: "noTrim", args: [] });
    return this;
  }

  // -- Terminal methods (finalize step, return pipeline) --

  private _finalize(terminalMethod: string, ...terminalArgs: any[]): ArrayPipeline<TItem> {
    return this.pipeline._addWhereStep({
      method: this.method,
      args: [this.path],
      modifiers: [...this.modifiers],
      terminal: { method: terminalMethod, args: terminalArgs },
    });
  }

  equals(value: Primitive, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("equals", ...args);
  }

  eq(value: Primitive, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("eq", ...args);
  }

  ne(value: Primitive, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("ne", ...args);
  }

  contains(value: string, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("contains", ...args);
  }

  startsWith(value: string, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("startsWith", ...args);
  }

  endsWith(value: string, options?: { ignoreCase?: boolean; trim?: boolean }): ArrayPipeline<TItem> {
    const args: any[] = [value];
    if (options !== undefined) args.push(options);
    return this._finalize("endsWith", ...args);
  }

  matches(regex: RegExp): ArrayPipeline<TItem> {
    return this._finalize("matches", regex);
  }

  greaterThan(value: number): ArrayPipeline<TItem> {
    return this._finalize("greaterThan", value);
  }

  gt(value: number): ArrayPipeline<TItem> {
    return this._finalize("gt", value);
  }

  greaterThanOrEqual(value: number): ArrayPipeline<TItem> {
    return this._finalize("greaterThanOrEqual", value);
  }

  gte(value: number): ArrayPipeline<TItem> {
    return this._finalize("gte", value);
  }

  lessThan(value: number): ArrayPipeline<TItem> {
    return this._finalize("lessThan", value);
  }

  lt(value: number): ArrayPipeline<TItem> {
    return this._finalize("lt", value);
  }

  lessThanOrEqual(value: number): ArrayPipeline<TItem> {
    return this._finalize("lessThanOrEqual", value);
  }

  lte(value: number): ArrayPipeline<TItem> {
    return this._finalize("lte", value);
  }
}

/**
 * A data-independent query builder that records operations lazily
 * and replays them onto any `TItem[]` via `.run(items)`.
 *
 * @example
 * ```ts
 * const premium3 = arrayPipeline<Item>()
 *   .where('type').equals('Premium')
 *   .sort('price', 'desc')
 *   .take(3);
 *
 * premium3.run(datasetA).all();
 * premium3.run(datasetB).first();
 * ```
 */
export class ArrayPipeline<TItem> {
  /** @internal */
  private readonly steps: PipelineStep[];

  constructor(steps: PipelineStep[] = []) {
    this.steps = steps;
  }

  // -- Internal helpers --

  /** @internal Used by PipelineWhereBuilder to finalize a where-chain step. */
  _addWhereStep(step: PipelineStep): ArrayPipeline<TItem> {
    return new ArrayPipeline<TItem>([...this.steps, step]);
  }

  private _append(method: string, ...args: any[]): ArrayPipeline<TItem> {
    return new ArrayPipeline<TItem>([...this.steps, { method, args }]);
  }

  private _derive<TOut>(step: PipelineStep): ArrayPipeline<TOut> {
    return new ArrayPipeline<TOut>([...this.steps, step]);
  }

  // -- Where-chain (return PipelineWhereBuilder) --

  where(path: string): PipelineWhereBuilder<TItem> {
    return new PipelineWhereBuilder<TItem>(this, "where", path);
  }

  whereNot(path: string): PipelineWhereBuilder<TItem> {
    return new PipelineWhereBuilder<TItem>(this, "whereNot", path);
  }

  // -- Chainable methods (return new ArrayPipeline<TItem>) --

  filter(
    expression: string,
    options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
  ): ArrayPipeline<TItem> {
    const args: any[] = [expression];
    if (options !== undefined) args.push(options);
    return this._append("filter", ...args);
  }

  filterIfPresent(
    expression: string | null | undefined,
    options?: { caseSensitive?: boolean; trim?: boolean; decimals?: number },
  ): ArrayPipeline<TItem> {
    const args: any[] = [expression];
    if (options !== undefined) args.push(options);
    return this._append("filterIfPresent", ...args);
  }

  whereSift(siftQuery: any): ArrayPipeline<TItem> {
    return this._append("whereSift", siftQuery);
  }

  whereIn(path: string, values: Primitive[]): ArrayPipeline<TItem> {
    return this._append("whereIn", path, values);
  }

  whereAll(criteria: Record<string, Primitive>): ArrayPipeline<TItem> {
    return this._append("whereAll", criteria);
  }

  whereIfPresent(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("whereIfPresent", ...args);
  }

  whereNotIfPresent(
    path: string,
    value: any,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("whereNotIfPresent", ...args);
  }

  greaterThanIfPresent(path: string, value: number | null | undefined): ArrayPipeline<TItem> {
    return this._append("greaterThanIfPresent", path, value);
  }

  greaterThanOrEqualIfPresent(path: string, value: number | null | undefined): ArrayPipeline<TItem> {
    return this._append("greaterThanOrEqualIfPresent", path, value);
  }

  lessThanIfPresent(path: string, value: number | null | undefined): ArrayPipeline<TItem> {
    return this._append("lessThanIfPresent", path, value);
  }

  lessThanOrEqualIfPresent(path: string, value: number | null | undefined): ArrayPipeline<TItem> {
    return this._append("lessThanOrEqualIfPresent", path, value);
  }

  containsIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("containsIfPresent", ...args);
  }

  notContainsIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("notContainsIfPresent", ...args);
  }

  startsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("startsWithIfPresent", ...args);
  }

  notStartsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("notStartsWithIfPresent", ...args);
  }

  endsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("endsWithIfPresent", ...args);
  }

  notEndsWithIfPresent(
    path: string,
    value: string | null | undefined,
    options?: { ignoreCase?: boolean; trim?: boolean },
  ): ArrayPipeline<TItem> {
    const args: any[] = [path, value];
    if (options !== undefined) args.push(options);
    return this._append("notEndsWithIfPresent", ...args);
  }

  sort(path: string, direction: "asc" | "desc" = "asc"): ArrayPipeline<TItem> {
    return this._append("sort", path, direction);
  }

  take(n: number): ArrayPipeline<TItem> {
    return this._append("take", n);
  }

  drop(n: number): ArrayPipeline<TItem> {
    return this._append("drop", n);
  }

  takeWhile(fn: (item: TItem) => boolean): ArrayPipeline<TItem> {
    return this._append("takeWhile", fn);
  }

  dropWhile(fn: (item: TItem) => boolean): ArrayPipeline<TItem> {
    return this._append("dropWhile", fn);
  }

  // -- Type-changing transforms (return new ArrayPipeline<TOut>) --

  map<TOut>(fn: (item: TItem) => TOut): ArrayPipeline<TOut> {
    return this._derive<TOut>({ method: "map", args: [fn] });
  }

  map2<TOut>(
    path1: string,
    path2: string,
    fn: (a: any, b: any) => TOut,
  ): ArrayPipeline<TOut> {
    return this._derive<TOut>({ method: "map2", args: [path1, path2, fn] });
  }

  mapn<TOut>(paths: string[], fn: (...values: any[]) => TOut): ArrayPipeline<TOut> {
    return this._derive<TOut>({ method: "mapn", args: [paths, fn] });
  }

  flatMap<TOut>(fn: (item: TItem) => TOut[]): ArrayPipeline<TOut> {
    return this._derive<TOut>({ method: "flatMap", args: [fn] });
  }

  scan<TAcc>(fn: (acc: TAcc, item: TItem) => TAcc, init: TAcc): ArrayPipeline<TAcc> {
    return this._derive<TAcc>({ method: "scan", args: [fn, init] });
  }

  zip<TOther>(other: TOther[]): ArrayPipeline<[TItem, TOther]> {
    return this._derive<[TItem, TOther]>({ method: "zip", args: [other] });
  }

  zipWith<TOther, TOut>(
    other: TOther[],
    fn: (a: TItem, b: TOther) => TOut,
  ): ArrayPipeline<TOut> {
    return this._derive<TOut>({ method: "zipWith", args: [other, fn] });
  }

  // -- Terminal --

  /**
   * Replays the recorded steps onto a fresh `ArrayQuery` built from `items`.
   *
   * @param items - The array to query against
   * @returns A fully constructed `ArrayQuery` with all pipeline steps applied
   */
  run(items: TItem[]): ArrayQuery<any> {
    let aq: any = new ArrayQuery(items);

    for (const step of this.steps) {
      if (isWhereStep(step)) {
        let builder = aq[step.method](step.args[0]);
        for (const mod of step.modifiers) {
          builder = builder[mod.name](...mod.args);
        }
        aq = builder[step.terminal.method](...step.terminal.args);
      } else {
        aq = aq[step.method](...step.args);
      }
    }

    return aq;
  }
}

/**
 * Creates an empty `ArrayPipeline` -- a reusable, data-independent query
 * builder.  Chain operations on it, then call `.run(items)` to apply
 * the recorded steps to any array.
 *
 * @example
 * ```ts
 * const premium3 = arrayPipeline<Item>()
 *   .where('type').equals('Premium')
 *   .sort('price', 'desc')
 *   .take(3);
 *
 * premium3.run(datasetA).all();
 * premium3.run(datasetB).first();
 * ```
 */
export function arrayPipeline<TItem>(): ArrayPipeline<TItem> {
  return new ArrayPipeline<TItem>();
}
