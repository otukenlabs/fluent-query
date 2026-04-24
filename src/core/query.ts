/**
 * @file core/query.ts
 * @description Main query entry point and JsonQueryRoot class.
 */

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
import {
  type UnsetOptions,
  unsetByPathStrict,
  unsetByPathsStrict,
} from "../helpers/unset-by-path";
import { ObjectGroupQuery } from "../queries/object-group-query";
import type {
  DiffOptions,
  DiffResult,
  FindOptions,
  HasAllOptions,
  ReplaceRule,
  ReplaceValueOptions,
  SetOptions,
} from "../types";
import { _setJsonQueryRootFactory, ArrayQuery } from "./array-query";

/**
 * Entry point for fluent JSON querying.
 *
 * `query(root)` returns a wrapper that lets you select an array by path and filter it fluently.
 *
 * @example Basic usage (array at root)
 * ```ts
 * import { query } from './query';
 *
 * const results = query({ items: [{ type: 'Premium' }] })
 * .array('items')
 * .where('type')
 * .equals('Premium')
 * .all();
 * ```
 *
 * @example Partial + case-insensitive (recommended for your API response filtering)
 * ```ts
 * const results = query(resp)
 * .array('items')
 * .where('type')
 * .ignoreCase() // ignore case
 * .contains('pre') // partial match
 * .all();
 * ```
 *
 * @example Nested path match
 * ```ts
 * const filtered = query(resp)
 * .array('items')
 * .where('type').contains('pre')
 * .where('metadata.description').contains('special')
 * .all();
 * ```
 *
 * @example Require exactly one match (ideal for tests)
 * ```ts
 * const item = query(resp)
 * .array('items')
 * .where('type').equals('Premium')
 * .one('Expected exactly one Premium item');
 * ```
 *
 * @typeParam TRoot - The type of the root JSON object.
 * @param root - The JSON object (API response) to query.
 */
export function query<TRoot>(root: TRoot): JsonQueryRoot<TRoot> {
  return new JsonQueryRoot(root);
}

/**
 * Root wrapper returned by {@link query}. Select arrays by dot-path.
 *
 * @typeParam TRoot - Root JSON type.
 */
export class JsonQueryRoot<TRoot> {
  constructor(private readonly root: TRoot) {}

  /**
   * Select an array under the root object using a dot-path.
   * Throws if the path is missing or the value is not an array.
   *
   * @example
   * ```ts
   * const q = query(resp).array('items'); // resp.items
   * const q2 = query(resp).array('data.items'); // resp.data.items
   * ```
   *
   * @typeParam TItem - Item type of the array. Use for TypeScript IntelliSense.
   * @param path - Dot-path to the array.
   * @returns An {@link ArrayQuery} that can be filtered fluently.
   */
  array<TItem = any>(
    path: string,
  ): ArrayQuery<TItem, "bound"> & { exists: never; every: never } {
    const v = getByPath(this.root as any, path, true);
    if (!Array.isArray(v)) {
      throw new Error(
        `Expected array at path "${path}", but found ${typeof v}.`,
      );
    }
    return ArrayQuery._bound<TItem>(v as TItem[], {
      rootSnapshot: this.root,
      arrayPath: path,
    }) as ArrayQuery<TItem, "bound"> & { exists: never; every: never };
  }

  /**
   * Sorts an array at `arrayPath` by `byPath` and writes it back to the same path.
   *
   * This is a root-level convenience for:
   * `query(root).array(arrayPath).sort(byPath, options).toRoot(arrayPath)`.
   */
  sortAt<TItem = any>(
    arrayPath: string,
    byPath: string,
    options?: { direction?: "asc" | "desc"; nulls?: "last" | "first" },
  ): JsonQueryRoot<TRoot> {
    return this.array<TItem>(arrayPath)
      .sort(byPath, options)
      .toRoot(arrayPath) as JsonQueryRoot<TRoot>;
  }

  /**
   * Select any object by path and filter its child objects.
   *
   * @example
   * ```ts
   * const items = query(resp)
   * .objectGroups('data.sections')
   * .include(['section1', 'section2'])
   * .flatArray('items');
   * ```
   */
  objectGroups(path: string): ObjectGroupQuery {
    const v = getByPath(this.root as any, path, true);
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`Expected object at path "${path}".`);
    }
    return new ObjectGroupQuery(v as Record<string, unknown>, path);
  }

  /**
   * Returns the underlying root value.
   * Useful when you want to step out of fluent mode.
   */
  unwrap(): TRoot {
    return this.root;
  }

  /**
   * Removes the value at path immutably.
   */
  unset(path: string, options?: UnsetOptions): JsonQueryRoot<TRoot> {
    return new JsonQueryRoot(unsetByPathStrict(this.root, path, options));
  }

  /**
   * Removes multiple paths immutably.
   */
  unsetAll(
    paths: ReadonlyArray<string>,
    options?: UnsetOptions,
  ): JsonQueryRoot<TRoot> {
    return new JsonQueryRoot(unsetByPathsStrict(this.root, paths, options));
  }

  /**
   * Filters an array at path using expression syntax and writes back immutably.
   */
  filterAt<TItem = any>(
    arrayPath: string,
    expression: string,
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): JsonQueryRoot<TRoot> {
    return this.array<TItem>(arrayPath)
      .filter(expression, options)
      .toRoot(arrayPath) as JsonQueryRoot<TRoot>;
  }

  /**
   * Conditionally applies filterAt() when param is defined.
   */
  filterAtIfDefined<TItem = any>(
    arrayPath: string,
    expression: string,
    param: any,
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): JsonQueryRoot<TRoot> {
    return this.array<TItem>(arrayPath)
      .filterIfDefined(expression, param, options)
      .toRoot(arrayPath) as JsonQueryRoot<TRoot>;
  }

  /**
   * Conditionally applies filterAt() when all params are defined.
   */
  filterAtIfAllDefined<TItem = any>(
    arrayPath: string,
    expression: string,
    params: Record<string, any>,
    options?: { ignoreCase?: boolean; trim?: boolean; decimals?: number },
  ): JsonQueryRoot<TRoot> {
    return this.array<TItem>(arrayPath)
      .filterIfAllDefined(expression, params, options)
      .toRoot(arrayPath) as JsonQueryRoot<TRoot>;
  }

  /**
   * Omits object keys from the object at path and writes back immutably.
   */
  omitAt(path: string, keys: string | string[]): JsonQueryRoot<TRoot> {
    const target = getByPath(this.root as any, path, true);
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error(`Expected object at path "${path}".`);
    }

    const keyList = Array.isArray(keys) ? keys : [keys];
    const updated = { ...(target as Record<string, unknown>) };
    for (const key of keyList) {
      delete updated[key];
    }

    return new JsonQueryRoot(setByPathStrict(this.root, path, updated));
  }

  /**
   * Picks object keys from the object at path and writes back immutably.
   */
  pickAt(path: string, keys: string | string[]): JsonQueryRoot<TRoot> {
    const target = getByPath(this.root as any, path, true);
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error(`Expected object at path "${path}".`);
    }

    const keyList = Array.isArray(keys) ? keys : [keys];
    const source = target as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    for (const key of keyList) {
      if (Object.hasOwn(source, key)) {
        updated[key] = source[key];
      }
    }

    return new JsonQueryRoot(setByPathStrict(this.root, path, updated));
  }

  /**
   * Compacts values at path and writes back immutably.
   */
  compactAt(path: string, options?: CompactOptions): JsonQueryRoot<TRoot> {
    const target = getByPath(this.root as any, path, true);
    const compacted = compactValue(target, options);
    return new JsonQueryRoot(setByPathStrict(this.root, path, compacted));
  }

  /**
   * Applies grouped-object transforms at path and writes selected entries back.
   */
  objectGroupsAt(
    path: string,
    transform: (groups: ObjectGroupQuery) => ObjectGroupQuery,
  ): JsonQueryRoot<TRoot> {
    const transformed = transform(this.objectGroups(path));
    const selectedGroups = Object.fromEntries(transformed.entries());
    return new JsonQueryRoot(setByPathStrict(this.root, path, selectedGroups));
  }

  /**
   * Renames a key in the object at path and writes back immutably.
   */
  renameAt(
    path: string,
    fromKey: string,
    toKey: string,
    options?: {
      onMissing?: "ignore" | "throw";
      onExisting?: "throw" | "overwrite";
    },
  ): JsonQueryRoot<TRoot> {
    const target = getByPath(this.root as any, path, true);
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error(`Expected object at path "${path}".`);
    }

    const source = target as Record<string, unknown>;
    if (!Object.hasOwn(source, fromKey)) {
      if ((options?.onMissing ?? "ignore") === "throw") {
        throw new Error(`Key "${fromKey}" not found at path "${path}".`);
      }
      return this;
    }

    if (
      fromKey !== toKey &&
      Object.hasOwn(source, toKey) &&
      (options?.onExisting ?? "throw") === "throw"
    ) {
      throw new Error(`Key "${toKey}" already exists at path "${path}".`);
    }

    const updated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (key === fromKey) {
        updated[toKey] = value;
      } else if (
        key !== toKey ||
        (options?.onExisting ?? "throw") !== "overwrite"
      ) {
        updated[key] = value;
      }
    }

    return new JsonQueryRoot(setByPathStrict(this.root, path, updated));
  }

  /**
   * Applies a custom transform to the value at path and writes back immutably.
   */
  transformAt<TValue = unknown>(
    path: string,
    transform: (value: TValue) => TValue,
  ): JsonQueryRoot<TRoot> {
    const current = getByPath(this.root as any, path, true) as TValue;
    const next = transform(cloneForUserFn(current));
    return new JsonQueryRoot(setByPathStrict(this.root, path, next));
  }

  /**
   * Replaces matched values inside the subtree at path and writes back immutably.
   */
  replaceValueAt(
    path: string,
    fromValue: unknown,
    toValue: unknown,
    options?: ReplaceValueOptions,
  ): JsonQueryRoot<TRoot> {
    const current = getByPath(this.root as any, path, true);
    const next = replaceValueByScope(current, fromValue, toValue, options);
    return new JsonQueryRoot(setByPathStrict(this.root, path, next));
  }

  /**
   * Applies ordered replacement rules inside the subtree at path and writes back immutably.
   */
  replaceManyAt(
    path: string,
    rules: ReadonlyArray<ReplaceRule>,
    options?: ReplaceValueOptions,
  ): JsonQueryRoot<TRoot> {
    const current = getByPath(this.root as any, path, true);
    const next = replaceManyByScope(current, rules, options);
    return new JsonQueryRoot(setByPathStrict(this.root, path, next));
  }

  /**
   * Immutably sets one path/value rule on the root object.
   */
  set(
    path: string,
    value: unknown,
    options?: SetOptions,
  ): JsonQueryRoot<TRoot> {
    const scope = options?.scope ?? "top-level";
    return new JsonQueryRoot(
      (scope === "deep"
        ? setAllByPathOccurrences(this.root, path, value)
        : setTopLevelValue(this.root, path, value)) as TRoot,
    );
  }

  /**
   * Immutably applies multiple path/value rules under the root object.
   */
  setAll(
    updates: ReadonlyArray<SetAllUpdate>,
    options?: SetOptions,
  ): JsonQueryRoot<TRoot> {
    const scope = options?.scope ?? "deep";
    return new JsonQueryRoot(
      (scope === "deep"
        ? setAllByPathOccurrencesBatch(this.root, updates)
        : setTopLevelValuesBatch(this.root, updates)) as TRoot,
    );
  }

  /**
   * Returns one updated root per matched path occurrence.
   * Each result applies exactly one occurrence update independently.
   */
  setEach(path: string, value: unknown): ArrayQuery<TRoot, "bound"> {
    return ArrayQuery._bound(
      setPathOccurrencesIndividually(this.root, path, value),
    );
  }

  /**
   * Immutably replaces matched values under the root object.
   */
  replaceValue(
    fromValue: unknown,
    toValue: unknown,
    options?: ReplaceValueOptions,
  ): JsonQueryRoot<TRoot> {
    return new JsonQueryRoot(
      replaceValueByScope(this.root, fromValue, toValue, options) as TRoot,
    );
  }

  /**
   * Immutably applies ordered replacement rules under the root object.
   */
  replaceMany(
    rules: ReadonlyArray<ReplaceRule>,
    options?: ReplaceValueOptions,
  ): JsonQueryRoot<TRoot> {
    return new JsonQueryRoot(
      replaceManyByScope(this.root, rules, options) as TRoot,
    );
  }

  /**
   * Compares the root object with an expected value and returns diff summary.
   */
  diff(expected: unknown, options?: DiffOptions): DiffResult {
    return diffValues(expected, this.root, options);
  }

  /**
   * Returns true when the root satisfies all criteria under the chosen scope.
   */
  hasAll(criteria: Record<string, unknown>, options?: HasAllOptions): boolean {
    return hasAllInAny([this.root], criteria, options);
  }

  /**
   * Returns true when the root satisfies a single key/value pair under the chosen scope.
   */
  has(key: string, value: unknown, options?: HasAllOptions): boolean {
    return this.hasAll({ [key]: value }, options);
  }

  /**
   * Immutably sets exactly one match for a path under the root object.
   */
  setOne(
    path: string,
    value: unknown,
    options?: SetOneOptions,
  ): JsonQueryRoot<TRoot> {
    return new JsonQueryRoot(setOneByPath(this.root, path, value, options));
  }

  /**
   * Searches for a property/path under the root object using scope controls.
   */
  find<TValue = any>(pathOrProperty: string, options?: FindOptions) {
    return ArrayQuery._bound([this.root as any]).find<TValue>(
      pathOrProperty,
      options,
    );
  }

  /**
   * Picks one or more properties/paths from the root object and returns a flat object.
   * Keys are the provided paths, or custom keys if using an object.
   *
   * @example Single path
   * ```ts
   * const picked = query(resp).pick('result.status');
   * // => { "result.status": "OK" }
   * ```
   *
   * @example Multiple paths
   * ```ts
   * const picked = query(resp).pick(['result.status', 'result.id']);
   * // => { "result.status": "OK", "result.id": 123 }
   * ```
   *
   * @example With aliases (custom keys)
   * ```ts
   * const picked = query(resp).pick({ status: 'result.status', id: 'result.id' });
   * // => { "status": "OK", "id": 123 }
   * ```
   */
  pick(
    pathOrPaths: string | string[] | Record<string, string>,
    ...rest: string[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    if (typeof pathOrPaths === "object" && !Array.isArray(pathOrPaths)) {
      // Object format: { outputKey: 'path' }
      for (const [key, path] of Object.entries(pathOrPaths)) {
        result[key] = getByPath(this.root as any, path, true);
      }
    } else {
      // String or array format
      const paths = Array.isArray(pathOrPaths)
        ? pathOrPaths
        : [pathOrPaths, ...rest];
      for (const path of paths) {
        result[path] = getByPath(this.root as any, path, true);
      }
    }

    return result;
  }

  /**
   * Selects the root as an array (use when the passed root value is already an array).
   *
   * @example
   * ```ts
   * const results = query(itemsArray).arrayRoot().where('type').equals('Premium').all();
   * ```
   *
   * @note The returned query does not support `.path()` since root arrays don't have a named path.
   */
  arrayRoot<TItem = any>(): Omit<ArrayQuery<TItem, "bound">, "path"> & {
    exists: never;
    every: never;
  } {
    return this.array<TItem>("");
  }

  /**
   * Applies a recipe (unbound ArrayQuery with embedded path) to this data.
   * The recipe must have an embedded arrayPath (created from a bound chain's
   * .toRecipe() or from arrayPipeline() usage with path).
   *
   * @throws Error if the recipe has no embedded path.
   */
  run<TItem>(recipe: ArrayQuery<TItem, "unbound">): ArrayQuery<TItem, "bound"> {
    const path = recipe._getArrayPath();
    if (path === undefined) {
      throw new Error(
        "Cannot run a pure pipeline on JsonQueryRoot. " +
          "Use recipe.run(items) or query(data).array(path).run(recipe) instead.",
      );
    }
    const items = getByPath(this.root as any, path, true) as TItem[];
    if (!Array.isArray(items)) {
      throw new Error(`Expected array at path "${path}", got ${typeof items}.`);
    }
    // Replay the recipe's steps onto the extracted items
    const steps = recipe._getSteps();
    // Create a bound query from the items and run the recipe's steps via
    // a fresh unbound pipeline (without embedded path) to avoid double extraction.
    const purePipeline = ArrayQuery._fromSteps<TItem>([...steps]);
    return purePipeline.run(items);
  }
}

_setJsonQueryRootFactory((root) => new JsonQueryRoot(root));

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
