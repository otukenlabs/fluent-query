import { query } from "../index";

describe("WhereBuilder", () => {
  const testData = {
    users: [
      { name: "Alice", email: "alice@example.com", active: true },
      { name: "Bob", email: "bob@example.com", active: false },
      { name: "Charlie", email: "charlie@example.com", active: true },
    ],
  };

  describe(".equals()", () => {
    it("should match exact values", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .equals("Alice")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    it("should be case-sensitive by default", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .equals("alice")
        .all();
      expect(result).toHaveLength(0);
    });

    it("should support case-sensitive matching", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .ignoreCase(false)
        .equals("alice")
        .all();
      expect(result).toHaveLength(0);
    });

    it("should support case-sensitive matching via inline options", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .equals("alice", { ignoreCase: false })
        .all();
      expect(result).toHaveLength(0);
    });

    it("should match numeric field value with numeric string", () => {
      const result = query({
        items: [
          { id: 1, price: "150.0000" },
          { id: 2, price: 100 },
          { id: 3, price: "100" },
        ],
      })
        .array("items")
        .where("price")
        .equals(100)
        .all();
      expect(result).toHaveLength(2); // items 2 and 3
      expect(result.map((i) => i.id)).toEqual([2, 3]);
    });

    it("should match numeric-string field with numeric value", () => {
      const result = query({
        items: [
          { id: 1, price: "150.00" },
          { id: 2, price: "100.0" },
          { id: 3, price: 100 },
        ],
      })
        .array("items")
        .where("price")
        .equals(100)
        .all();
      expect(result).toHaveLength(2); // items 2 and 3
    });

    it("should not throw on null equality with numeric value", () => {
      const result = query({
        items: [
          { id: 1, price: null },
          { id: 2, price: 100 },
        ],
      })
        .array("items")
        .where("price")
        .equals(100)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should match string-to-string equality without coercion", () => {
      const result = query({
        items: [
          { id: 1, price: "150.00" },
          { id: 2, price: "150" },
          { id: 3, price: 150 },
        ],
      })
        .array("items")
        .where("price")
        .equals("150.00")
        .all();
      expect(result).toHaveLength(1); // only exact string match
      expect(result[0].id).toBe(1);
    });

    it("should coerce numeric-string field when comparing with numeric value", () => {
      const result = query({
        items: [
          { id: 1, price: "150.00" },
          { id: 2, price: "100.0" },
          { id: 3, price: 100 },
        ],
      })
        .array("items")
        .where("price")
        .equals(100)
        .all();
      expect(result).toHaveLength(2); // items 2 and 3 (both parse to 100)
      expect(result.map((i) => i.id)).toEqual([2, 3]);
    });

    it("should allow disabling numeric-string coercion for equals", () => {
      const result = query({
        items: [
          { id: 1, price: "100" },
          { id: 2, price: 100 },
        ],
      })
        .array("items")
        .where("price")
        .equals(100, { coerceNumericStrings: false })
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should handle floating point number comparisons", () => {
      const result = query({
        items: [
          { id: 1, price: "99.99" },
          { id: 2, price: "99.99" },
          { id: 3, price: 99.99 },
          { id: 4, price: "100.00" },
        ],
      })
        .array("items")
        .where("price")
        .equals(99.99)
        .all();
      expect(result).toHaveLength(3); // items 1, 2, 3
      expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it("should handle floating point comparisons with greaterThan", () => {
      const result = query({
        items: [
          { id: 1, price: "99.50" },
          { id: 2, price: "100.01" },
          { id: 3, price: 100.1 },
        ],
      })
        .array("items")
        .where("price")
        .greaterThan(100)
        .all();
      expect(result).toHaveLength(2); // items 2, 3
      expect(result.map((i) => i.id)).toEqual([2, 3]);
    });
  });

  describe(".contains()", () => {
    it("should match substrings", () => {
      const result = query(testData)
        .array("users")
        .where("email")
        .contains("example")
        .all();
      expect(result).toHaveLength(3);
    });

    it("should be case-sensitive by default", () => {
      const result = query(testData)
        .array("users")
        .where("email")
        .contains("EXAMPLE")
        .all();
      expect(result).toHaveLength(0);
    });

    it("should allow inline options to override ignoreCase() chain setting", () => {
      const result = query(testData)
        .array("users")
        .where("email")
        .ignoreCase()
        .contains("EXAMPLE", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(0);
    });

    it("should support case-sensitive matching via inline options", () => {
      const result = query(testData)
        .array("users")
        .where("email")
        .contains("EXAMPLE", { ignoreCase: false })
        .all();
      expect(result).toHaveLength(0);
    });
  });

  describe(".startsWith()", () => {
    it("should match strings starting with prefix", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .startsWith("A")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    it("should support case-sensitive matching via inline options", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .startsWith("a", { ignoreCase: false })
        .all();
      expect(result).toHaveLength(0);
    });

    it("should respect trim: true for values with leading whitespace", () => {
      const data = {
        users: [
          { name: " Antony Santos" },
          { name: "Bryant Edwards" },
          { name: "Anthony Soprano" },
        ],
      };

      const result = query(data)
        .array("users")
        .where("name")
        .startsWith("ant", { ignoreCase: true, trim: true })
        .all();

      expect(result.map((x) => x.name)).toEqual([
        " Antony Santos",
        "Anthony Soprano",
      ]);
    });

    it("should respect trim: true for negated startsWith", () => {
      const data = {
        users: [
          { id: 1, name: " Antony Santos" },
          { id: 2, name: "Bryant Edwards" },
          { id: 3, name: "Anthony Soprano" },
        ],
      };

      const result = query(data)
        .array("users")
        .where("name")
        .not()
        .startsWith("ant", { ignoreCase: true, trim: true })
        .all();

      expect(result.map((x) => x.id)).toEqual([2]);
    });
  });

  describe(".endsWith()", () => {
    it("should match strings ending with suffix", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .endsWith("ie")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Charlie");
    });

    it("should support case-sensitive matching via inline options", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .endsWith("IE", { ignoreCase: false })
        .all();
      expect(result).toHaveLength(0);
    });
  });

  describe(".not()", () => {
    it("should negate the filter", () => {
      const result = query(testData)
        .array("users")
        .where("active")
        .not()
        .equals(true)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });
  });

  describe("comparison aliases", () => {
    const numericData = {
      users: [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 35 },
      ],
    };

    it("should support eq() as alias for equals()", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .eq("Alice")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    it("should support notEquals() for not equals", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .notEquals("Alice")
        .all();
      expect(result).toHaveLength(2);
      expect(result.some((u) => u.name === "Alice")).toBe(false);
    });

    it("should support ne() as alias for notEquals()", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .ne("Alice")
        .all();
      expect(result).toHaveLength(2);
      expect(result.some((u) => u.name === "Alice")).toBe(false);
    });

    it("should support gt() as alias for greaterThan()", () => {
      const result = query(numericData)
        .array("users")
        .where("age")
        .gt(30)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Charlie");
    });

    it("should support gte() as alias for greaterThanOrEqual()", () => {
      const result = query(numericData)
        .array("users")
        .where("age")
        .gte(30)
        .all();
      expect(result).toHaveLength(2);
    });

    it("should support lt() as alias for lessThan()", () => {
      const result = query(numericData)
        .array("users")
        .where("age")
        .lt(30)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    it("should support lte() as alias for lessThanOrEqual()", () => {
      const result = query(numericData)
        .array("users")
        .where("age")
        .lte(30)
        .all();
      expect(result).toHaveLength(2);
    });

    it("should compare numeric-string fields directly", () => {
      const result = query({
        users: [
          { name: "Alice", price: "150.0000" },
          { name: "Bob", price: "99.5000" },
          { name: "Charlie", price: 120 },
        ],
      })
        .array("users")
        .where("price")
        .greaterThan(100)
        .all();

      expect(result.map((user) => user.name)).toEqual(["Alice", "Charlie"]);
    });

    it("should treat nullish numeric fields as zero by default", () => {
      const result = query({
        users: [
          { name: "Alice", price: null },
          { name: "Bob", price: undefined },
          { name: "Charlie", price: "2" },
        ],
      })
        .array("users")
        .where("price")
        .lessThan(1)
        .all();

      expect(result.map((user) => user.name)).toEqual(["Alice", "Bob"]);
    });

    it("should throw for non-numeric string fields in numeric comparisons", () => {
      expect(() =>
        query({
          users: [{ name: "Alice", price: "not-a-number" }],
        })
          .array("users")
          .where("price")
          .greaterThan(100)
          .all(),
      ).toThrow("requires a finite number or numeric string");
    });

    it("should allow nullish handling to be switched to throwing", () => {
      expect(() =>
        query({
          users: [{ name: "Alice", price: null }],
        })
          .array("users")
          .where("price")
          .greaterThan(100, { nullAsZero: false })
          .all(),
      ).toThrow("Pass { nullAsZero: true }");
    });

    it("should support in() as whereIn() terminal alias", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .in(["Alice", "Charlie"])
        .all();

      expect(result).toHaveLength(2);
      expect(result.map((u) => u.name)).toEqual(["Alice", "Charlie"]);
    });

    it("should allow disabling numeric-string coercion for in()", () => {
      const result = query({
        users: [
          { id: 1, score: "100" },
          { id: 2, score: 100 },
        ],
      })
        .array("users")
        .where("score")
        .in([100], { coerceNumericStrings: false })
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should support not().in() as negated membership", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .not()
        .in(["Alice", "Charlie"])
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });

    it("should support notIn() as shorthand for not().in()", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .notIn(["Alice", "Charlie"])
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });

    it("should support between() for inclusive numeric ranges", () => {
      const result = query({
        users: [
          { id: 1, score: "49" },
          { id: 2, score: "50" },
          { id: 3, score: 75 },
          { id: 4, score: "100" },
          { id: 5, score: "101" },
        ],
      })
        .array("users")
        .where("score")
        .between(50, 100)
        .all();

      expect(result.map((user) => user.id)).toEqual([2, 3, 4]);
    });

    it("should support negated between() via not()", () => {
      const result = query({
        users: [
          { id: 1, score: 49 },
          { id: 2, score: 50 },
          { id: 3, score: 75 },
          { id: 4, score: 100 },
          { id: 5, score: 101 },
        ],
      })
        .array("users")
        .where("score")
        .not()
        .between(50, 100)
        .all();

      expect(result.map((user) => user.id)).toEqual([1, 5]);
    });

    it("should throw for between() when min is greater than max", () => {
      expect(() =>
        query({ users: [{ score: 10 }] })
          .array("users")
          .where("score")
          .between(100, 50)
          .all(),
      ).toThrow(
        'between("score") requires min to be less than or equal to max.',
      );
    });

    it("should throw for in() with empty values", () => {
      expect(() =>
        query(testData)
          .array("users")
          .where("name")
          .in([] as any[]),
      ).toThrow('whereIn("name") requires a non-empty array of values.');
    });
  });

  describe(".ignoreCase()", () => {
    it("should toggle case sensitivity", () => {
      const ignoreCase = query(testData)
        .array("users")
        .where("name")
        .ignoreCase()
        .equals("ALICE")
        .all();
      expect(ignoreCase).toHaveLength(1);

      const strictCase = query(testData)
        .array("users")
        .where("name")
        .ignoreCase(false)
        .equals("ALICE")
        .all();
      expect(strictCase).toHaveLength(0);
    });
  });

  describe(".trim() and .noTrim()", () => {
    const dataWithSpaces = {
      items: [{ name: "Alice" }, { name: "Bob" }],
    };

    it("should trim whitespace by default", () => {
      const result = query(dataWithSpaces)
        .array("items")
        .where("name")
        .equals("  Alice  ")
        .all();
      expect(result).toHaveLength(1);
    });

    it("should not trim if noTrim() is called", () => {
      const result = query(dataWithSpaces)
        .array("items")
        .where("name")
        .noTrim()
        .equals("  Alice  ")
        .all();
      expect(result).toHaveLength(0);
    });

    it("should re-enable trimming when trim() is called", () => {
      const result = query(dataWithSpaces)
        .array("items")
        .where("name")
        .noTrim()
        .trim()
        .equals("  Alice  ")
        .all();
      expect(result).toHaveLength(1);
    });
  });
});
