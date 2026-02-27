/**
 * @file core/query.ts
 * @description Main query entry point and JsonQueryRoot class.
 */

import { getByPath } from "../helpers/path";
import { ArrayQuery } from "./array-query";
import { ObjectGroupQuery } from "../queries/object-group-query";

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
 * .contains('pre') // partial match
 * .ignoreCase() // ignore case
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
  array<TItem = any>(path: string): ArrayQuery<TItem, "bound"> {
    const v = getByPath(this.root as any, path);
    if (!Array.isArray(v)) {
      throw new Error(
        `Expected array at path "${path}", but found ${typeof v}.`,
      );
    }
    return ArrayQuery._bound<TItem>(v as TItem[], {
      arrayPath: path,
    });
  }

  /**
   * Select any object by path and filter its child objects.
   *
   * @example
   * ```ts
   * const items = query(resp)
   * .objectGroups('data.sections')
   * .include(['section1', 'section2'])
   * .arrays('items');
   * ```
   */
  objectGroups(path: string): ObjectGroupQuery {
    const v = getByPath(this.root as any, path);
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`Expected object at path "${path}".`);
    }
    return new ObjectGroupQuery(v as Record<string, unknown>, path);
  }

  /**
   * Returns the underlying root value.
   * Useful when you want to step out of fluent mode.
   */
  raw(): TRoot {
    return this.root;
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
        result[key] = getByPath(this.root as any, path);
      }
    } else {
      // String or array format
      const paths = Array.isArray(pathOrPaths)
        ? pathOrPaths
        : [pathOrPaths, ...rest];
      for (const path of paths) {
        result[path] = getByPath(this.root as any, path);
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
  arrayRoot<TItem = any>(): Omit<ArrayQuery<TItem, "bound">, "path"> {
    return this.array<TItem>("");
  }

  /**
   * Applies a recipe (unbound ArrayQuery with embedded path) to this data.
   * The recipe must have an embedded arrayPath (created from a bound chain's
   * .toRecipe() or from arrayPipeline() usage with path).
   *
   * @throws Error if the recipe has no embedded path.
   */
  run<TItem>(
    recipe: ArrayQuery<TItem, "unbound">,
  ): ArrayQuery<TItem, "bound"> {
    const path = recipe._getArrayPath();
    if (path === undefined) {
      throw new Error(
        "Cannot run a pure pipeline on JsonQueryRoot. " +
          "Use recipe.run(items) or query(data).array(path).run(recipe) instead.",
      );
    }
    const items = getByPath(this.root as any, path) as TItem[];
    if (!Array.isArray(items)) {
      throw new Error(
        `Expected array at path "${path}", got ${typeof items}.`,
      );
    }
    // Replay the recipe's steps onto the extracted items
    const steps = recipe._getSteps();
    // Create a bound query from the items and run the recipe's steps via
    // a fresh unbound pipeline (without embedded path) to avoid double extraction.
    const purePipeline = ArrayQuery._fromSteps<TItem>([...steps]);
    return purePipeline.run(items);
  }
}
