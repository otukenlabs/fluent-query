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

    it("should support case-insensitive matching (default)", () => {
      const result = query(testData)
        .array("users")
        .where("name")
        .equals("alice")
        .all();
      expect(result).toHaveLength(1);
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

    it("should be case-insensitive by default", () => {
      const result = query(testData)
        .array("users")
        .where("email")
        .contains("EXAMPLE")
        .all();
      expect(result).toHaveLength(3);
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

    it("should support ne() as alias for not equals", () => {
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
