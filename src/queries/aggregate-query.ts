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
    options?: {
      decimals?: number;
      coerceNumericStrings?: boolean;
      preRoundDecimals?: number;
      preRoundSignificantDigits?: number;
      preRoundMode?: "halfUp" | "halfEven";
      finalRoundSignificantDigits?: number;
      finalRoundMode?: "halfUp" | "halfEven";
    },
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

    const total = this.items.reduce((sum, item) => {
      const value = path === "" ? item : getByPath(item, path, true);
      let num = 0;
      if (typeof value === "number" && Number.isFinite(value)) {
        num = preRoundNumericValue(value);
      } else if (
        options?.coerceNumericStrings !== false &&
        typeof value === "string"
      ) {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (trimmed !== "" && Number.isFinite(parsed)) {
          num = preRoundNumericValue(parsed);
        }
      }
      return sum + num;
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
      this.aggregations.sum = roundToSignificant(
        total,
        finalRoundSignificantDigits,
      );
      return this;
    }

    if (decimals === undefined) {
      this.aggregations.sum = total;
      return this;
    }

    this.aggregations.sum = roundToDecimals(total, decimals);
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
    options?: {
      decimals?: number;
      coerceNumericStrings?: boolean;
      preRoundDecimals?: number;
      preRoundSignificantDigits?: number;
      preRoundMode?: "halfUp" | "halfEven";
      finalRoundSignificantDigits?: number;
      finalRoundMode?: "halfUp" | "halfEven";
    },
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

    if (this.items.length === 0) {
      this.aggregations.average = 0;
    } else {
      const sum = this.items.reduce((total, item) => {
        const value = path === "" ? item : getByPath(item, path, true);
        let num = 0;
        if (typeof value === "number" && Number.isFinite(value)) {
          num = preRoundNumericValue(value);
        } else if (
          options?.coerceNumericStrings !== false &&
          typeof value === "string"
        ) {
          const trimmed = value.trim();
          const parsed = Number(trimmed);
          if (trimmed !== "" && Number.isFinite(parsed)) {
            num = preRoundNumericValue(parsed);
          }
        }
        return total + num;
      }, 0);

      const avg = sum / this.items.length;
      const roundToDecimals = (
        value: number,
        roundDecimals: number,
      ): number => {
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
        this.aggregations.average = roundToSignificant(
          avg,
          finalRoundSignificantDigits,
        );
      } else if (decimals === undefined) {
        this.aggregations.average = avg;
      } else {
        this.aggregations.average = roundToDecimals(avg, decimals);
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
