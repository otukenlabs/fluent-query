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
