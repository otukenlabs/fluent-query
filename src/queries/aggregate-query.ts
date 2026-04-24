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
   * @param path Field path containing numeric values (optional for primitive arrays)
   * @param options Optional rounding options
   * @returns this for chaining
   */
  sum(
    path: string = "",
    options?: { decimals?: number; coerceNumericStrings?: boolean },
  ): this {
    const decimals = options?.decimals;
    if (
      decimals !== undefined &&
      (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)
    ) {
      throw new Error(
        "sum() options.decimals expects an integer between 0 and 100.",
      );
    }

    const total = this.items.reduce((sum, item) => {
      const value = path === "" ? item : getByPath(item, path, true);
      let num = 0;
      if (typeof value === "number" && Number.isFinite(value)) {
        num = value;
      } else if (
        options?.coerceNumericStrings !== false &&
        typeof value === "string"
      ) {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed !== "" && Number.isFinite(parsed)) {
          num = parsed;
        }
      }
      return sum + num;
    }, 0);

    if (decimals === undefined) {
      this.aggregations.sum = total;
      return this;
    }

    const factor = 10 ** decimals;
    this.aggregations.sum = Math.round(total * factor) / factor;
    return this;
  }

  /**
   * Add average aggregation for a path.
   *
   * @param path Field path containing numeric values (optional for primitive arrays)
   * @param options Optional rounding options
   * @returns this for chaining
   */
  average(
    path: string = "",
    options?: { decimals?: number; coerceNumericStrings?: boolean },
  ): this {
    const decimals = options?.decimals;
    if (
      decimals !== undefined &&
      (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)
    ) {
      throw new Error(
        "average() options.decimals expects an integer between 0 and 100.",
      );
    }

    if (this.items.length === 0) {
      this.aggregations.average = 0;
    } else {
      const sum = this.items.reduce((total, item) => {
        const value = path === "" ? item : getByPath(item, path, true);
        let num = 0;
        if (typeof value === "number" && Number.isFinite(value)) {
          num = value;
        } else if (
          options?.coerceNumericStrings !== false &&
          typeof value === "string"
        ) {
          const trimmed = value.trim();
          const parsed = Number(trimmed);
          if (trimmed !== "" && Number.isFinite(parsed)) {
            num = parsed;
          }
        }
        return total + num;
      }, 0);

      const avg = sum / this.items.length;
      if (decimals === undefined) {
        this.aggregations.average = avg;
      } else {
        const factor = 10 ** decimals;
        this.aggregations.average = Math.round(avg * factor) / factor;
      }
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
        .map((item) => getByPath(item, path, true))
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
        .map((item) => getByPath(item, path, true))
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
   * @param options Optional rounding options
   * @returns this for chaining
   */
  sumOfProducts(...paths: string[]): this;
  sumOfProducts(
    ...args: [...paths: string[], options: { decimals?: number }]
  ): this;
  sumOfProducts(...args: Array<string | { decimals?: number }>): this {
    const maybeOptions = args[args.length - 1];
    const hasOptionsObject =
      typeof maybeOptions === "object" &&
      maybeOptions !== null &&
      !Array.isArray(maybeOptions);

    const options = hasOptionsObject
      ? (maybeOptions as { decimals?: number })
      : undefined;
    const paths = (hasOptionsObject ? args.slice(0, -1) : args) as string[];

    if (paths.length === 0) {
      throw new Error("sumOfProducts() requires at least one path");
    }

    const decimals = options?.decimals;
    if (
      decimals !== undefined &&
      (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)
    ) {
      throw new Error(
        "sumOfProducts() options.decimals expects an integer between 0 and 100.",
      );
    }

    const productValue = this.items.reduce((sum, item) => {
      let prod = 1;
      for (const path of paths) {
        const value = getByPath(item, path, true);
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

    if (decimals === undefined) {
      this.aggregations.sumOfProducts = productValue;
      return this;
    }

    const factor = 10 ** decimals;
    this.aggregations.sumOfProducts =
      Math.round(productValue * factor) / factor;
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
