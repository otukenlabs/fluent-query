/**
 * @file queries/value-array-query.ts
 * @description ValueArrayQuery helper for chainable value array queries.
 */

/**
 * Helper for chainable value array queries.
 * Provides methods for selecting, converting, and accessing values from arrays.
 * @internal
 */
export class ValueArrayQuery<TValue = any> {
  /**
   * @param values Array of values from pluck() or findAll()
   */
  constructor(private readonly values: TValue[]) {}

  /**
   * Get all values as a plain array.
   *
   * @returns Array of all values
   */
  all(): TValue[] {
    return this.values;
  }

  /**
   * Get the first value.
   *
   * @returns The first value
   * @throws Throws if array is empty
   */
  first(): TValue {
    if (this.values.length === 0) {
      throw new Error("No values found for first()");
    }
    return this.values[0];
  }

  /**
   * Get the last value.
   *
   * @returns The last value
   * @throws Throws if array is empty
   */
  last(): TValue {
    if (this.values.length === 0) {
      throw new Error("No values found for last()");
    }
    return this.values[this.values.length - 1];
  }

  /**
   * Get a random value.
   *
   * @returns A randomly selected value
   * @throws Throws if array is empty
   */
  random(): TValue {
    if (this.values.length === 0) {
      throw new Error("No values found for random()");
    }
    return this.values[Math.floor(Math.random() * this.values.length)];
  }

  /**
   * Get the value at a specific index.
   *
   * @param index Zero-based index
   * @returns The value at the given index
   * @throws Throws if index is out of bounds
   */
  nth(index: number): TValue {
    if (index < 0 || index >= this.values.length) {
      throw new Error(
        `Index ${index} out of bounds. Found ${this.values.length} values.`,
      );
    }
    return this.values[index];
  }

  /**
   * Get the value when exactly one exists.
   *
   * @param message Optional custom error message
   * @returns The single value
   * @throws Throws if zero or more than one values exist
   */
  one(message?: string): TValue {
    if (this.values.length === 0) {
      throw new Error(message || "Expected exactly one value, but found zero");
    }
    if (this.values.length > 1) {
      throw new Error(
        message ||
          `Expected exactly one value, but found ${this.values.length}`,
      );
    }
    return this.values[0];
  }

  /**
   * Get the count of values.
   *
   * @returns Number of values in the array
   */
  count(): number {
    return this.values.length;
  }

  /**
   * Keeps only values matching the provided runtime type.
   * No coercion is performed.
   *
   * Supported types: string, number, boolean, bigint, symbol, undefined,
   * function, object, null, array.
   *
   * @param type Runtime type to keep
   * @returns ValueArrayQuery with values of the requested type
   * @example
   * ```ts
   * query(data).array('items').pluck('value').ofType('number').all()
   * // [1, '3', 'john', 5] → [1, 5]
   * ```
   */
  ofType(
    type:
      | "string"
      | "number"
      | "boolean"
      | "bigint"
      | "symbol"
      | "undefined"
      | "function"
      | "object"
      | "null"
      | "array",
  ): ValueArrayQuery<any> {
    const filtered = this.values.filter((value) => {
      if (type === "null") return value === null;
      if (type === "array") return Array.isArray(value);
      if (type === "object") {
        return (
          value !== null && !Array.isArray(value) && typeof value === "object"
        );
      }
      return typeof value === type;
    });

    return new ValueArrayQuery(filtered);
  }

  /**
   * Applies Math.abs() to all number values.
   *
   * @returns ValueArrayQuery with absolute number values
   * @throws Throws if any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('delta').abs().all()
   * // [-3, 2, -1.5] → [3, 2, 1.5]
   * ```
   */
  abs(): ValueArrayQuery<number> {
    const absolute = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot apply abs() to non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      return Math.abs(value);
    });

    return new ValueArrayQuery(absolute);
  }

  /**
   * Limits number values into the inclusive range [min, max].
   *
   * @param min Lower bound (inclusive)
   * @param max Upper bound (inclusive)
   * @returns ValueArrayQuery with clamped number values
   * @throws Throws if bounds are invalid or any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('score').clamp(0, 100).all()
   * // [-10, 40, 120] → [0, 40, 100]
   * ```
   */
  clamp(min: number, max: number): ValueArrayQuery<number> {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error("clamp(min, max) expects finite number bounds.");
    }
    if (min > max) {
      throw new Error("clamp(min, max) expects min to be <= max.");
    }

    const clamped = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot apply clamp() to non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      return Math.min(max, Math.max(min, value));
    });

    return new ValueArrayQuery(clamped);
  }

  /**
   * Multiplies each number value by the provided factor.
   *
   * @param factor Multiplication factor
   * @returns ValueArrayQuery with scaled number values
   * @throws Throws if factor is invalid or any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('value').scale(10).all()
   * // [1.2, 3, -0.5] → [12, 30, -5]
   * ```
   */
  scale(factor: number): ValueArrayQuery<number> {
    if (!Number.isFinite(factor)) {
      throw new Error("scale(factor) expects a finite number factor.");
    }

    const scaled = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot apply scale() to non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      return value * factor;
    });

    return new ValueArrayQuery(scaled);
  }

  /**
   * Adds the provided delta to each number value.
   *
   * @param delta Additive offset
   * @returns ValueArrayQuery with offset number values
   * @throws Throws if delta is invalid or any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('temperature').offset(-273.15).all()
   * // [300, 310] → [26.85, 36.85]
   * ```
   */
  offset(delta: number): ValueArrayQuery<number> {
    if (!Number.isFinite(delta)) {
      throw new Error("offset(delta) expects a finite number delta.");
    }

    const offsetValues = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot apply offset() to non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      return value + delta;
    });

    return new ValueArrayQuery(offsetValues);
  }

  /**
   * Rounds number values to a fixed number of decimal places.
   *
   * @param decimals Number of decimal places (integer between 0 and 100)
   * @param options Rounding mode (`halfUp` by default, or `halfEven`)
   * @returns ValueArrayQuery with rounded number values
   * @throws Throws if decimals is out of range or any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('price').round(2).all()
   * // [1.234, 5.678] → [1.23, 5.68]
   * ```
   */
  round(
    decimals: number,
    options?: { mode?: "halfUp" | "halfEven" },
  ): ValueArrayQuery<number> {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
      throw new Error("round(decimals) expects an integer between 0 and 100.");
    }

    const mode = options?.mode ?? "halfUp";

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

    const factor = 10 ** decimals;
    const rounded = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot round non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      if (mode === "halfEven") {
        return roundHalfEven(value * factor) / factor;
      }
      return Math.round(value * factor) / factor;
    });

    return new ValueArrayQuery(rounded);
  }

  /**
   * Rounds number values to a fixed number of significant digits.
   *
   * @param digits Number of significant digits (integer between 1 and 100)
   * @param options Rounding mode (`halfUp` by default, or `halfEven`)
   * @returns ValueArrayQuery with rounded number values
   * @throws Throws if digits is out of range or any value is not a finite number
   * @example
   * ```ts
   * query(data).array('items').pluck('value').roundSignificant(3).all()
   * // [1234.56, 0.012345] → [1230, 0.0123]
   * ```
   */
  roundSignificant(
    digits: number,
    options?: { mode?: "halfUp" | "halfEven" },
  ): ValueArrayQuery<number> {
    if (!Number.isInteger(digits) || digits < 1 || digits > 100) {
      throw new Error(
        "roundSignificant(digits) expects an integer between 1 and 100.",
      );
    }

    const mode = options?.mode ?? "halfUp";

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

    const roundToSignificantHalfEven = (
      value: number,
      significantDigits: number,
    ): number => {
      if (value === 0) return 0;

      const exponent = Math.floor(Math.log10(Math.abs(value)));
      const scale = 10 ** (significantDigits - 1 - exponent);
      const scaled = value * scale;
      const roundedScaled = roundHalfEven(scaled);
      return roundedScaled / scale;
    };

    const rounded = this.values.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Cannot round non-finite number value: ${JSON.stringify(value)}. Use ofType('number') or number() first.`,
        );
      }
      if (mode === "halfEven") {
        return roundToSignificantHalfEven(value, digits);
      }
      return Number(value.toPrecision(digits));
    });

    return new ValueArrayQuery(rounded);
  }

  /**
   * Convert all values to strings.
   * Returns a new ValueArrayQuery with string values.
   * Converts null/undefined to empty string. Throws for objects.
   *
   * @returns ValueArrayQuery with string values
   * @throws Throws if any value is an object (arrays or plain objects)
   * @example
   * ```ts
   * query(data).array('items').pluck('id').string().all()
   * // [1, 2, 3] → ['1', '2', '3']
   * ```
   *
   * @example Null/undefined handling
   * ```ts
   * query(data).array('items').pluck('name').string().all()
   * // [null, 'Alice', undefined] → ['', 'Alice', '']
   * ```
   */
  string(): ValueArrayQuery<string> {
    const converted = this.values.map((value) => {
      // Convert null/undefined to empty string
      if (value === null || value === undefined) {
        return "";
      }
      // Throw for objects and arrays
      if (typeof value === "object") {
        throw new Error(
          `Cannot convert object to string: ${JSON.stringify(value)}. Objects must be converted manually.`,
        );
      }
      return String(value);
    });
    return new ValueArrayQuery(converted);
  }

  /**
   * Convert all values to numbers.
   * Returns a new ValueArrayQuery with number values.
   *
   * @returns ValueArrayQuery with number values
   * @throws Throws if any value cannot be converted to a valid number
   * @example
   * ```ts
   * query(data).array('items').pluck('price').number().all()
   * // ['10', '20', '30'] → [10, 20, 30]
   * ```
   */
  number(): ValueArrayQuery<number> {
    const converted = this.values.map((value) => {
      if (value === null || value === undefined) {
        throw new Error(
          `Cannot convert ${value} to number. Use filter to remove null/undefined values.`,
        );
      }
      const num = Number(value);
      if (Number.isNaN(num)) {
        throw new Error(
          `Cannot convert "${value}" to number. Value is NaN after conversion.`,
        );
      }
      return num;
    });
    return new ValueArrayQuery(converted);
  }
}
