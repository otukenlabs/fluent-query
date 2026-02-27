/**
 * @file queries/index-query.ts
 * @description IndexQuery helper for chainable index operations.
 */

/**
 * Helper class for chainable index operations.
 * Provides terminal methods to access indices of filtered items.
 *
 * @template TItem The type of items in the collection
 */
export class IndexQuery {
  /**
   * @param indices Array of indices matching the filter criteria
   */
  constructor(private readonly indices: number[]) {}

  /**
   * Get all indices of matching items.
   *
   * @returns Array of all matching indices
   * @example
   * ```ts
   * const indices = query(data)
   * .array('users')
   * .where('status')
   * .equals('active')
   * .index()
   * .all();
   * // Returns: [0, 2, 4]
   * ```
   */
  all(): number[] {
    return this.indices;
  }

  /**
   * Get the first index of matching items.
   *
   * @returns The first matching index
   * @throws Throws if no items match the criteria
   * @example
   * ```ts
   * const firstIdx = query(data)
   * .array('users')
   * .where('role')
   * .equals('admin')
   * .index()
   * .first();
   * ```
   */
  first(): number {
    if (this.indices.length === 0) {
      throw new Error("No matching items found");
    }
    return this.indices[0];
  }

  /**
   * Get a random index from matching items.
   *
   * @returns A randomly selected index from matching items
   * @throws Throws if no items match the criteria
   * @example
   * ```ts
   * const randomIdx = query(data)
   * .array('products')
   * .where('inStock')
   * .equals(true)
   * .index()
   * .random();
   * ```
   */
  random(): number {
    if (this.indices.length === 0) {
      throw new Error("No matching items found");
    }
    return this.indices[Math.floor(Math.random() * this.indices.length)];
  }

  /**
   * Get the index when exactly one item matches.
   *
   * @param message Optional custom error message
   * @returns The index of the single matching item
   * @throws Throws if zero or more than one items match the criteria
   * @example
   * ```ts
   * const idx = query(data)
   * .array('configs')
   * .where('name')
   * .equals('primary')
   * .index()
   * .one('Expected exactly one primary config');
   * ```
   */
  one(message?: string): number {
    if (this.indices.length === 0) {
      throw new Error(
        message || "Expected exactly one matching item, but found zero",
      );
    }
    if (this.indices.length > 1) {
      throw new Error(
        message ||
          `Expected exactly one matching item, but found ${this.indices.length}`,
      );
    }
    return this.indices[0];
  }
}
