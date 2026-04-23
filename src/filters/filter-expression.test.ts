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

    it("supports symbol operators without strict spacing", () => {
      expect(parseFilterExpression("type=='Basic'")).toEqual({
        field: "type",
        operator: "==",
        value: "Basic",
      });

      expect(parseFilterExpression("price>=100")).toEqual({
        field: "price",
        operator: ">=",
        value: 100,
      });
    });

    it("throws on invalid expression format", () => {
      expect(() => parseFilterExpression("invalid")).toThrow(
        "Invalid filter expression",
      );
    });

    it("throws with migration guidance for binary not syntax", () => {
      expect(() => parseFilterExpression("status not 'Active'")).toThrow(
        'Binary "not" is not supported. Use "!=" instead',
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
      // With numeric-string support, ==, !=, >, >=, <, <= all use $where for coercion
      const eqClause = expressionToSiftClause("x", "==", 1);
      expect(typeof eqClause.x.$where).toBe("function");
      expect(eqClause.x.$where.call({ x: 1 })).toBe(true);
      expect(eqClause.x.$where.call({ x: "1" })).toBe(true);
      expect(eqClause.x.$where.call({ x: 2 })).toBe(false);

      const neqClause = expressionToSiftClause("x", "!=", 1);
      expect(typeof neqClause.x.$where).toBe("function");
      expect(neqClause.x.$where.call({ x: 1 })).toBe(false);
      expect(neqClause.x.$where.call({ x: "1" })).toBe(false);
      expect(neqClause.x.$where.call({ x: 2 })).toBe(true);

      // Greater-than operators with numeric strings
      const gtClause = expressionToSiftClause("x", ">", 5);
      expect(typeof gtClause.$where).toBe("function");
      expect(gtClause.$where.call({ x: 10 })).toBe(true);
      expect(gtClause.$where.call({ x: "10" })).toBe(true);
      expect(gtClause.$where.call({ x: "10.5" })).toBe(true);
      expect(gtClause.$where.call({ x: 3 })).toBe(false);
      expect(gtClause.$where.call({ x: "3" })).toBe(false);

      const gteClause = expressionToSiftClause("x", ">=", 5);
      expect(typeof gteClause.$where).toBe("function");
      expect(gteClause.$where.call({ x: 5 })).toBe(true);
      expect(gteClause.$where.call({ x: "5" })).toBe(true);
      expect(gteClause.$where.call({ x: 3 })).toBe(false);

      // Less-than operators with numeric strings
      const ltClause = expressionToSiftClause("x", "<", 5);
      expect(typeof ltClause.$where).toBe("function");
      expect(ltClause.$where.call({ x: 3 })).toBe(true);
    });

    it("handles string-to-string equality without numeric coercion", () => {
      // When comparing two strings (simple equality, no $where)
      const clause = expressionToSiftClause("price", "==", "150.00");
      expect(clause.price).toBe("150.00"); // direct value assignment
    });

    it("handles numeric comparison with string field values", () => {
      // Numeric comparison creates $where for coercion
      const clause = expressionToSiftClause("price", "==", 100);
      expect(typeof clause.price.$where).toBe("function");
      expect(clause.price.$where.call({ price: "100.00" })).toBe(true);
      expect(clause.price.$where.call({ price: "100" })).toBe(true);
      expect(clause.price.$where.call({ price: 100 })).toBe(true);
      expect(clause.price.$where.call({ price: "100.01" })).toBe(false);

      const lteClause = expressionToSiftClause("x", "<=", 5);
      expect(typeof lteClause.$where).toBe("function");
      expect(lteClause.$where.call({ x: 5 })).toBe(true);
      expect(lteClause.$where.call({ x: "5" })).toBe(true);
      expect(lteClause.$where.call({ x: 10 })).toBe(false);
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

      expect(starts.name.source.startsWith("^\\s*")).toBe(true);
      expect(ends.name.source.endsWith("\\s*$")).toBe(true);
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

    it("treats && and || as aliases for and/or", () => {
      const split = splitLogicalOperators(
        "city=='NY'&&age>=21 || active==true",
      );

      expect(split.expressions).toEqual([
        "city=='NY'",
        "age>=21",
        "active==true",
      ]);
      expect(split.operators).toEqual(["and", "or"]);
    });

    it("splits logical operators without strict spacing when boundaries are clear", () => {
      const split = splitLogicalOperators(
        "price>=100 andtype=='x' or type=='Basic'",
      );

      expect(split.expressions).toEqual([
        "price>=100 andtype=='x'",
        "type=='Basic'",
      ]);
      expect(split.operators).toEqual(["or"]);

      const splitNoSpaceAroundAnd = splitLogicalOperators(
        "city=='NY'and age>=21",
      );
      expect(splitNoSpaceAroundAnd.expressions).toEqual([
        "city=='NY'",
        "age>=21",
      ]);
      expect(splitNoSpaceAroundAnd.operators).toEqual(["and"]);
    });

    it("throws when no valid expressions exist", () => {
      expect(() => parseCompositeFilterExpression("   ")).toThrow(
        'No valid expressions found in filter: "   "',
      );
    });

    it("parses a single expression", () => {
      const clause = parseCompositeFilterExpression("age >= 21");
      // Numeric comparison operators now use $where for string coercion
      expect(typeof clause.$where).toBe("function");
      expect(clause.$where.call({ age: 21 })).toBe(true);
      expect(clause.$where.call({ age: "21" })).toBe(true);
      expect(clause.$where.call({ age: 20 })).toBe(false);
    });

    it("parses mixed and/or with precedence", () => {
      const clause = parseCompositeFilterExpression(
        "city == 'NY' and age >= 21 or active == true",
      );

      // Validate structure has the $or and $and operators
      expect(clause.$or).toBeDefined();
      expect(clause.$or).toHaveLength(2);
      expect(clause.$or[0].$and).toBeDefined();
      // First branch: city == 'NY' and age >= 21
      expect(clause.$or[0].$and[0].city).toBe("NY");
      expect(typeof clause.$or[0].$and[1].$where).toBe("function");
      // Second branch: active == true
      expect(clause.$or[1].active).toBe(true);
    });

    it("parses composite expressions without strict spacing around operators", () => {
      const clause = parseCompositeFilterExpression("city=='NY'and age>=21");

      expect(clause.$and).toBeDefined();
      expect(clause.$and).toHaveLength(2);
      expect(clause.$and[0].city).toBe("NY");
      expect(typeof clause.$and[1].$where).toBe("function");
      expect(clause.$and[1].$where.call({ age: 21 })).toBe(true);
    });

    it("supports unary logical not with keyword and parentheses", () => {
      const clause = parseCompositeFilterExpression(
        "not (city == 'NY' and age >= 21)",
      );

      expect(clause.$nor).toBeDefined();
      expect(clause.$nor).toHaveLength(1);
      expect(clause.$nor[0].$and).toBeDefined();
      expect(clause.$nor[0].$and[0].city).toBe("NY");
      expect(typeof clause.$nor[0].$and[1].$where).toBe("function");
    });

    it("supports unary logical ! and symbol logical operators", () => {
      const clause = parseCompositeFilterExpression(
        "!(city=='NY' && age>=21) || active==true",
      );

      expect(clause.$or).toBeDefined();
      expect(clause.$or).toHaveLength(2);
      expect(clause.$or[0].$nor).toBeDefined();
      expect(clause.$or[0].$nor[0].$and).toBeDefined();
      expect(clause.$or[0].$nor[0].$and[0].city).toBe("NY");
      expect(typeof clause.$or[0].$nor[0].$and[1].$where).toBe("function");
      expect(clause.$or[1].active).toBe(true);
    });

    it("applies precedence: not > and > or", () => {
      const clause = parseCompositeFilterExpression(
        "not city == 'NY' and age >= 21 or active == true",
      );

      expect(clause.$or).toBeDefined();
      expect(clause.$or).toHaveLength(2);
      expect(clause.$or[0].$and).toBeDefined();
      expect(clause.$or[0].$and[0].$nor).toBeDefined();
      expect(clause.$or[0].$and[0].$nor[0].city).toBe("NY");
      expect(typeof clause.$or[0].$and[1].$where).toBe("function");
      expect(clause.$or[1].active).toBe(true);
    });

    it("throws on mismatched parentheses", () => {
      expect(() =>
        parseCompositeFilterExpression("(city == 'NY' and age >= 21"),
      ).toThrow("Mismatched parentheses in filter expression.");
    });
  });
});
