/**
 * @file queries/path-query.ts
 * @description PathQuery helper for chainable path operations.
 */

/**
 * Helper for chainable path queries.
 * @internal
 */
export class PathQuery {
  /**
   * @param paths Array of paths matching the filter criteria
   */
  constructor(private readonly paths: string[]) {}

  /**
   * Get all paths of matching items.
   *
   * @returns Array of all matching paths
   * @example
   * ```ts
   * const paths = query(data)
   * .array('users')
   * .where('status')
   * .equals('active')
   * .path()
   * .all();
   * // Returns: ["users[0]", "users[2]", "users[4]"]
   * ```
   */
  all(): string[] {
    return this.paths;
  }

  /**
   * Get the first path of matching items.
   *
   * @returns The first matching path
   * @throws Throws if no items match the criteria
   */
  first(): string {
    if (this.paths.length === 0) {
      throw new Error("No matching items found");
    }
    return this.paths[0];
  }

  /**
   * Get the last path of matching items.
   *
   * @returns The last matching path
   * @throws Throws if no items match the criteria
   */
  last(): string {
    if (this.paths.length === 0) {
      throw new Error("No matching items found");
    }
    return this.paths[this.paths.length - 1];
  }

  /**
   * Get a random path from matching items.
   *
   * @returns A randomly selected path from matching items
   * @throws Throws if no items match the criteria
   */
  random(): string {
    if (this.paths.length === 0) {
      throw new Error("No matching items found");
    }
    return this.paths[Math.floor(Math.random() * this.paths.length)];
  }

  /**
   * Get the path at a specific index.
   *
   * @param index Zero-based index
   * @returns The path at the given index
   * @throws Throws if index is out of bounds
   */
  nth(index: number): string {
    if (index < 0 || index >= this.paths.length) {
      throw new Error(
        `Index ${index} out of bounds. Found ${this.paths.length} paths.`,
      );
    }
    return this.paths[index];
  }

  /**
   * Get the path when exactly one item matches.
   *
   * @param message Optional custom error message
   * @returns The path of the single matching item
   * @throws Throws if zero or more than one items match the criteria
   */
  one(message?: string): string {
    if (this.paths.length === 0) {
      throw new Error(
        message || "Expected exactly one matching item, but found zero",
      );
    }
    if (this.paths.length > 1) {
      throw new Error(
        message ||
          `Expected exactly one matching item, but found ${this.paths.length}`,
      );
    }
    return this.paths[0];
  }
}
