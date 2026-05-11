import {
  buildNumericComparisonClause,
  buildNumericEqualityClause,
  coerceNumericEqualityValue,
} from "./numeric-comparison";

describe("numeric-comparison helpers", () => {
  describe("coerceNumericEqualityValue", () => {
    it("coerces finite numbers and numeric strings", () => {
      expect(coerceNumericEqualityValue(10)).toBe(10);
      expect(coerceNumericEqualityValue(" 10.5 ")).toBe(10.5);
    });

    it("throws for empty strings and non-numeric values", () => {
      expect(() => coerceNumericEqualityValue("   ")).toThrow(
        "received an empty string",
      );
      expect(() => coerceNumericEqualityValue("abc")).toThrow(
        "requires a number or numeric string",
      );
      expect(() => coerceNumericEqualityValue(Infinity)).toThrow(
        "requires a finite number",
      );
      expect(() => coerceNumericEqualityValue(undefined)).toThrow(
        "requires a number or numeric string",
      );
    });
  });

  describe("buildNumericComparisonClause", () => {
    it("supports all operators with nested paths", () => {
      const source = { price: "100.5" };

      expect(
        buildNumericComparisonClause("price", "gt", 100).$where.call(source),
      ).toBe(true);
      expect(
        buildNumericComparisonClause("price", "gte", 100.5).$where.call(source),
      ).toBe(true);
      expect(
        buildNumericComparisonClause("price", "lt", 101).$where.call(source),
      ).toBe(true);
      expect(
        buildNumericComparisonClause("price", "lte", 100.5).$where.call(source),
      ).toBe(true);
    });

    it("supports self-path comparisons", () => {
      const clause = buildNumericComparisonClause("", "gt", 5);
      expect(clause.$where.call("6")).toBe(true);
      expect(clause.$where.call(3)).toBe(false);
    });

    it("throws for non-finite target", () => {
      expect(() =>
        buildNumericComparisonClause("price", "gt", Number.NaN),
      ).toThrow(
        'Numeric comparison target for path "price" must be a finite number.',
      );
    });

    it("handles nullish values with nullAsZero option", () => {
      const defaultClause = buildNumericComparisonClause("missing", "gte", 0);
      expect(() => defaultClause.$where.call({})).not.toThrow();

      const strictClause = buildNumericComparisonClause("missing", "gt", 0, {
        nullAsZero: false,
      });
      expect(() => strictClause.$where.call({})).toThrow(
        'Numeric comparison at path "missing" received undefined',
      );
    });

    it("respects coerceNumericStrings option", () => {
      const strictClause = buildNumericComparisonClause("price", "gt", 5, {
        coerceNumericStrings: false,
      });
      expect(() => strictClause.$where.call({ price: "6" })).toThrow(
        "requires a finite number",
      );

      const emptyStringClause = buildNumericComparisonClause("price", "gt", 5);
      expect(() => emptyStringClause.$where.call({ price: "   " })).toThrow(
        "received an empty string",
      );
    });
  });

  describe("buildNumericEqualityClause", () => {
    it("matches numeric and numeric-string fields", () => {
      const clause = buildNumericEqualityClause("price", 100);

      expect(clause.$where.call({ price: "100.00" })).toBe(true);
      expect(clause.$where.call({ price: 100 })).toBe(true);
      expect(clause.$where.call({ price: "101" })).toBe(false);
      expect(clause.$where.call({ price: null })).toBe(false);
      expect(clause.$where.call({ price: "abc" })).toBe(false);
    });

    it("supports self-path equality", () => {
      const clause = buildNumericEqualityClause("", "42");
      expect(clause.$where.call(42)).toBe(true);
      expect(clause.$where.call("42.0")).toBe(true);
      expect(clause.$where.call("not-number")).toBe(false);
    });

    it("wraps invalid search-value errors", () => {
      expect(() => buildNumericEqualityClause("price", "abc")).toThrow(
        'Numeric equality search value for path "price"',
      );
    });
  });
});
