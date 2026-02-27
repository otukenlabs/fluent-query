import { query } from "../index";

describe("ArrayQuery", () => {
  const testData = {
    items: [
      { id: 1, type: "Premium", price: 100, name: "Item A" },
      { id: 2, type: "Basic", price: 50, name: "Item B" },
      { id: 3, type: "Premium", price: 150, name: "Item C" },
      { id: 4, type: "Standard", price: 75, name: "Item D" },
    ],
  };

  describe(".where().equals()", () => {
    it("should filter items by exact match", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it("should return empty array if no matches", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("NonExistent")
        .all();
      expect(result).toHaveLength(0);
    });
  });

  describe(".where().contains()", () => {
    it("should filter items by substring (case-insensitive by default)", () => {
      const result = query(testData)
        .array("items")
        .where("name")
        .contains("item")
        .all();
      expect(result).toHaveLength(4);
    });

    it("should support case-sensitive contains", () => {
      const result = query(testData)
        .array("items")
        .where("name")
        .caseSensitive()
        .contains("Item")
        .all();
      expect(result).toHaveLength(4);
    });
  });

  describe(".where().greaterThan()", () => {
    it("should filter items by numeric comparison", () => {
      const result = query(testData)
        .array("items")
        .where("price")
        .greaterThan(75)
        .all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });
  });

  describe(".where().lessThan()", () => {
    it("should filter items less than a value", () => {
      const result = query(testData)
        .array("items")
        .where("price")
        .lessThan(100)
        .all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(4);
    });
  });

  describe(".whereNot()", () => {
    it("should negate the filter", () => {
      const result = query(testData)
        .array("items")
        .whereNot("type")
        .equals("Premium")
        .all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(4);
    });
  });

  describe(".filter()", () => {
    it("should apply filter expressions", () => {
      const result = query(testData)
        .array("items")
        .filter("type == 'Premium'")
        .all();
      expect(result).toHaveLength(2);
    });

    it("should support numeric comparisons in filter", () => {
      const result = query(testData)
        .array("items")
        .filter("price >= 100")
        .all();
      expect(result).toHaveLength(2);
    });

    it("should support and logic in filter", () => {
      const result = query(testData)
        .array("items")
        .filter("type == 'Premium' and price > 120")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });

  describe(".first()", () => {
    it("should return the first matching item", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .first();
      expect(result.id).toBe(1);
    });

    it("should throw if no matches", () => {
      expect(() => {
        query(testData)
          .array("items")
          .where("type")
          .equals("NonExistent")
          .first();
      }).toThrow();
    });
  });

  describe(".one()", () => {
    it("should return item when exactly one matches", () => {
      const result = query(testData).array("items").where("id").equals(1).one();
      expect(result.id).toBe(1);
    });

    it("should throw if zero matches", () => {
      expect(() => {
        query(testData).array("items").where("id").equals(999).one();
      }).toThrow();
    });

    it("should throw if multiple matches", () => {
      expect(() => {
        query(testData).array("items").where("type").equals("Premium").one();
      }).toThrow();
    });
  });

  describe(".random()", () => {
    it("should return a random matching item", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .random();
      expect(result.type).toBe("Premium");
    });
  });

  describe(".count()", () => {
    it("should return the count of matching items", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .count();
      expect(result).toBe(2);
    });
  });

  describe(".sum()", () => {
    it("should sum numeric values", () => {
      const result = query(testData).array("items").sum("price");
      expect(result).toBe(375);
    });
  });

  describe(".average()", () => {
    it("should calculate average of numeric values", () => {
      const result = query(testData).array("items").average("price");
      expect(result).toBe(93.75);
    });
  });

  describe(".min() and .max()", () => {
    it("should find min and max values", () => {
      const min = query(testData).array("items").min("price");
      const max = query(testData).array("items").max("price");
      expect(min).toBe(50);
      expect(max).toBe(150);
    });
  });

  describe(".distinct()", () => {
    it("should return distinct values", () => {
      const result = query(testData).array("items").distinct("type");
      expect(result).toHaveLength(3);
      // distinct returns objects, not just the field values
      expect(result.some((item: any) => item.type === "Premium")).toBe(true);
      expect(result.some((item: any) => item.type === "Basic")).toBe(true);
      expect(result.some((item: any) => item.type === "Standard")).toBe(true);
    });
  });

  describe(".groupBy()", () => {
    it("should group items by a field", () => {
      const result = query(testData).array("items").groupBy("type");
      expect(Object.keys(result)).toHaveLength(3);
      expect(result["Premium"]).toHaveLength(2);
      expect(result["Basic"]).toHaveLength(1);
      expect(result["Standard"]).toHaveLength(1);
    });
  });

  describe(".pluck()", () => {
    it("should extract values from a field", () => {
      const result = query(testData).array("items").pluck("id").all();
      expect(result).toEqual([1, 2, 3, 4]);
    });
  });

  describe(".pick()", () => {
    it("should select specific fields from items", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .pick(["id", "name"]);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).not.toHaveProperty("type");
    });

    it("should support object notation for renaming", () => {
      const result = query(testData)
        .array("items")
        .where("id")
        .equals(1)
        .pick({ itemId: "id", itemName: "name" });
      expect(result[0]).toHaveProperty("itemId", 1);
      expect(result[0]).toHaveProperty("itemName", "Item A");
    });
  });

  describe("chaining", () => {
    it("should support multiple where clauses", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .where("price")
        .greaterThan(100)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });
});
