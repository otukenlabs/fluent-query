import {
  expressionToSiftClause,
  parseFilterExpression,
} from "./filter-expression";
import {
  parseCompositeFilterExpression,
  splitLogicalOperators,
} from "./logical-operators";

describe("filter-expression utilities", () => {
  describe("parseFilterExpression", () => {
    it("parses quoted strings, numbers, booleans, null, undefined, and bare words", () => {
      expect(parseFilterExpression("name == 'Alice'")).toEqual({
        field: "name",
        operator: "==",
        value: "Alice",
      });

      expect(parseFilterExpression('name == "Bob"')).toEqual({
        field: "name",
        operator: "==",
        value: "Bob",
      });

      expect(parseFilterExpression("price >= 10.5")).toEqual({
        field: "price",
        operator: ">=",
        value: 10.5,
      });

      expect(parseFilterExpression("active == true")).toEqual({
        field: "active",
        operator: "==",
        value: true,
      });

      expect(parseFilterExpression("active == false")).toEqual({
        field: "active",
        operator: "==",
        value: false,
      });

      expect(parseFilterExpression("middleName == null")).toEqual({
        field: "middleName",
        operator: "==",
        value: null,
      });

      expect(parseFilterExpression("nickname == undefined")).toEqual({
        field: "nickname",
        operator: "==",
        value: undefined,
      });

      expect(parseFilterExpression("status == active")).toEqual({
        field: "status",
        operator: "==",
        value: "active",
      });
    });

    it("lowercases operator tokens and supports startsWith/endsWith", () => {
      expect(parseFilterExpression("name startsWith Pre").operator).toBe(
        "startswith",
      );
      expect(parseFilterExpression("name endsWith ium").operator).toBe(
        "endswith",
      );
    });

    it("throws on invalid expression format", () => {
      expect(() => parseFilterExpression("invalid")).toThrow(
        "Invalid filter expression",
      );
    });
  });

  describe("expressionToSiftClause", () => {
    it("handles equality/inequality with decimals via $where", () => {
      const eqClause = expressionToSiftClause("price", "==", 1.23, {
        decimals: 2,
      });
      const neqClause = expressionToSiftClause("price", "!=", 1.23, {
        decimals: 2,
      });

      expect(typeof eqClause.price.$where).toBe("function");
      expect(eqClause.price.$where.call({ price: 1.234 })).toBe(true);
      expect(eqClause.price.$where.call({ price: 1.2 })).toBe(false);
      expect(eqClause.price.$where.call({ price: "1.23" })).toBe(false);

      expect(typeof neqClause.price.$where).toBe("function");
      expect(neqClause.price.$where.call({ price: 1.234 })).toBe(false);
      expect(neqClause.price.$where.call({ price: 1.2 })).toBe(true);
      expect(neqClause.price.$where.call({ price: "1.23" })).toBe(true);
    });

    it("handles direct comparison operators", () => {
      expect(expressionToSiftClause("x", "==", 1)).toEqual({ x: 1 });
      expect(expressionToSiftClause("x", "!=", 1)).toEqual({
        x: { $ne: 1 },
      });
      expect(expressionToSiftClause("x", "not", 1)).toEqual({
        x: { $ne: 1 },
      });
      expect(expressionToSiftClause("x", ">", 1)).toEqual({ x: { $gt: 1 } });
      expect(expressionToSiftClause("x", ">=", 1)).toEqual({
        x: { $gte: 1 },
      });
      expect(expressionToSiftClause("x", "<", 1)).toEqual({ x: { $lt: 1 } });
      expect(expressionToSiftClause("x", "<=", 1)).toEqual({
        x: { $lte: 1 },
      });
    });

    it("builds regex clauses with trim/ignoreCase options", () => {
      const containsDefault = expressionToSiftClause(
        "name",
        "contains",
        "  ab ",
      );
      const containsStrict = expressionToSiftClause(
        "name",
        "contains",
        "  ab ",
        {
          ignoreCase: false,
          trim: false,
        },
      );
      const starts = expressionToSiftClause("name", "startswith", "  pre ");
      const ends = expressionToSiftClause("name", "endswith", "  fix ");

      expect(containsDefault.name).toBeInstanceOf(RegExp);
      expect(containsDefault.name.flags.includes("i")).toBe(true);
      expect(containsDefault.name.source).toContain("ab");

      expect(containsStrict.name.flags.includes("i")).toBe(false);
      expect(containsStrict.name.source).toContain("  ab ");

      expect(starts.name.source.startsWith("^")).toBe(true);
      expect(ends.name.source.endsWith("$")).toBe(true);
    });

    it("throws on unknown operators", () => {
      expect(() => expressionToSiftClause("x", "???", 1)).toThrow(
        'Unknown operator: "???"',
      );
    });
  });

  describe("logical operators", () => {
    it("splits by and/or while preserving quoted text", () => {
      const split = splitLogicalOperators(
        "title contains 'rock and roll' or city == 'New York' and age >= 18",
      );

      expect(split.expressions).toEqual([
        "title contains 'rock and roll'",
        "city == 'New York'",
        "age >= 18",
      ]);
      expect(split.operators).toEqual(["or", "and"]);
    });

    it("throws when no valid expressions exist", () => {
      expect(() => parseCompositeFilterExpression("   ")).toThrow(
        'No valid expressions found in filter: "   "',
      );
    });

    it("parses a single expression", () => {
      const clause = parseCompositeFilterExpression("age >= 21");
      expect(clause).toEqual({ age: { $gte: 21 } });
    });

    it("parses mixed and/or left-to-right", () => {
      const clause = parseCompositeFilterExpression(
        "city == 'NY' and age >= 21 or active == true",
      );

      expect(clause).toEqual({
        $or: [
          {
            $and: [{ city: "NY" }, { age: { $gte: 21 } }],
          },
          { active: true },
        ],
      });
    });
  });
});
