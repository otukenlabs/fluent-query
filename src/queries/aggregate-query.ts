/**
 * @file queries/aggregate-query.ts
 * @description AggregateQuery helper for chainable aggregations.
 */

import { getByPath } from "../helpers/path";

/**
 * Helper for chainable aggregation queries.
 * @internal
 */
export class AggregateQuery {
  private aggregations: Record<string, any> = {};

  /**
   * @param items Array of items to aggregate
   */
  constructor(private readonly items: any[]) {}

  /**
   * Add sum aggregation for a path.
   *
   * @param path Field path containing numeric values
   * @returns this for chaining
   */
  sum(path: string): this {
    this.aggregations.sum = this.items.reduce((total, item) => {
      const value = getByPath(item, path);
      const num = typeof value === "number" ? value : 0;
      return total + num;
    }, 0);
    return this;
  }

  /**
   * Add average aggregation for a path.
   *
   * @param path Field path containing numeric values
   * @returns this for chaining
   */
  average(path: string): this {
    if (this.items.length === 0) {
      this.aggregations.average = 0;
    } else {
      const sum = this.items.reduce((total, item) => {
        const value = getByPath(item, path);
        const num = typeof value === "number" ? value : 0;
        return total + num;
      }, 0);
      this.aggregations.average = sum / this.items.length;
    }
    return this;
  }

  /**
   * Add minimum aggregation for a path.
   *
   * @param path Field path containing comparable values
   * @returns this for chaining
   */
  min(path: string): this {
    if (this.items.length === 0) {
      this.aggregations.min = null;
    } else {
      const values = this.items
        .map((item) => getByPath(item, path))
        .filter(
          (v) => v !== null && v !== undefined && !Number.isNaN(Number(v)),
        )
        .map(Number);
      this.aggregations.min = values.length > 0 ? Math.min(...values) : null;
    }
    return this;
  }

  /**
   * Add maximum aggregation for a path.
   *
   * @param path Field path containing comparable values
   * @returns this for chaining
   */
  max(path: string): this {
    if (this.items.length === 0) {
      this.aggregations.max = null;
    } else {
      const values = this.items
        .map((item) => getByPath(item, path))
        .filter(
          (v) => v !== null && v !== undefined && !Number.isNaN(Number(v)),
        )
        .map(Number);
      this.aggregations.max = values.length > 0 ? Math.max(...values) : null;
    }
    return this;
  }

  /**
   * Add sumOfProducts aggregation for multiple paths.
   * Multiplies values at the given paths for each item, then sums all products.
   *
   * @param paths Field paths containing numeric values to multiply
   * @returns this for chaining
   */
  sumOfProducts(...paths: string[]): this {
    if (paths.length === 0) {
      throw new Error("sumOfProducts() requires at least one path");
    }
    const productValue = this.items.reduce((sum, item) => {
      let prod = 1;
      for (const path of paths) {
        const value = getByPath(item, path);
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new Error(
            `Invalid number at path "${path}" for product calculation`,
          );
        }
        prod *= num;
      }
      return sum + prod;
    }, 0);
    this.aggregations.sumOfProducts = productValue;
    return this;
  }

  /**
   * Add count aggregation.
   *
   * @returns this for chaining
   */
  count(): this {
    this.aggregations.count = this.items.length;
    return this;
  }

  /**
   * Get all aggregations as an object.
   *
   * @returns Object with all computed aggregations
   * @example
   * ```ts
   * const stats = query(data)
   *   .array('items')
   *   .aggregate()
   *   .sum('price')
   *   .average('price')
   *   .count()
   *   .all();
   * // => { sum: 500000, average: 62500, count: 8 }
   * ```
   */
  all(): Record<string, any> {
    return this.aggregations;
  }
}
