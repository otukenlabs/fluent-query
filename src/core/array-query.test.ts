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
      expect(result.Premium).toHaveLength(2);
      expect(result.Basic).toHaveLength(1);
      expect(result.Standard).toHaveLength(1);
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

  // ---------------------------------------------------------------------------
  // Map family
  // ---------------------------------------------------------------------------

  describe(".map()", () => {
    it("should transform each item", () => {
      const result = query(testData)
        .array("items")
        .map((item) => item.name.toUpperCase())
        .all();
      expect(result).toEqual(["ITEM A", "ITEM B", "ITEM C", "ITEM D"]);
    });

    it("should be chainable with where after map", () => {
      const result = query(testData)
        .array("items")
        .map((item) => ({ ...item, discounted: item.price * 0.9 }))
        .where("discounted")
        .greaterThan(100)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Item C");
    });

    it("should apply filters before mapping", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .map((item) => item.id)
        .all();
      expect(result).toEqual([1, 3]);
    });
  });

  describe(".map2()", () => {
    it("should extract two paths and apply fn", () => {
      const result = query(testData)
        .array("items")
        .map2("name", "price", (name, price) => `${name}: $${price}`)
        .all();
      expect(result).toEqual([
        "Item A: $100",
        "Item B: $50",
        "Item C: $150",
        "Item D: $75",
      ]);
    });
  });

  describe(".mapn()", () => {
    it("should extract N paths and apply fn", () => {
      const result = query(testData)
        .array("items")
        .mapn(
          ["id", "name", "price"],
          (id, name, price) => `#${id} ${name} ($${price})`,
        )
        .all();
      expect(result[0]).toBe("#1 Item A ($100)");
      expect(result).toHaveLength(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Reduce / Fold family
  // ---------------------------------------------------------------------------

  describe(".reduce()", () => {
    it("should fold items into a single value (sum)", () => {
      const total = query(testData)
        .array("items")
        .reduce((acc, item) => acc + item.price, 0);
      expect(total).toBe(375);
    });

    it("should fold into a string", () => {
      const names = query(testData)
        .array("items")
        .reduce((acc, item) => (acc ? `${acc}, ${item.name}` : item.name), "");
      expect(names).toBe("Item A, Item B, Item C, Item D");
    });

    it("should fold into an object", () => {
      const byId = query(testData)
        .array("items")
        .reduce(
          (acc, item) => {
            acc[item.id] = item.name;
            return acc;
          },
          {} as Record<number, string>,
        );
      expect(byId).toEqual({
        1: "Item A",
        2: "Item B",
        3: "Item C",
        4: "Item D",
      });
    });
  });

  describe(".fold()", () => {
    it("should behave identically to reduce", () => {
      const total = query(testData)
        .array("items")
        .fold((acc, item) => acc + item.price, 0);
      expect(total).toBe(375);
    });
  });

  describe(".reduce2()", () => {
    it("should fold with two extracted path values", () => {
      const total = query(testData)
        .array("items")
        .reduce2("id", "price", (acc, id, price) => acc + id * price, 0);
      // 1*100 + 2*50 + 3*150 + 4*75 = 100 + 100 + 450 + 300 = 950
      expect(total).toBe(950);
    });
  });

  describe(".fold2()", () => {
    it("should behave identically to reduce2", () => {
      const total = query(testData)
        .array("items")
        .fold2("id", "price", (acc, id, price) => acc + id * price, 0);
      expect(total).toBe(950);
    });
  });

  describe(".reducen()", () => {
    it("should fold with N extracted path values", () => {
      const result = query(testData)
        .array("items")
        .reducen(
          ["id", "name", "price"],
          (acc, id, name, price) => {
            acc.push(`#${id} ${name}: $${price}`);
            return acc;
          },
          [] as string[],
        );
      expect(result).toHaveLength(4);
      expect(result[0]).toBe("#1 Item A: $100");
    });
  });

  describe(".foldn()", () => {
    it("should behave identically to reducen", () => {
      const result = query(testData)
        .array("items")
        .foldn(
          ["id", "name"],
          (acc, id, name) => {
            acc.push(`${id}-${name}`);
            return acc;
          },
          [] as string[],
        );
      expect(result).toEqual(["1-Item A", "2-Item B", "3-Item C", "4-Item D"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Core composable primitives
  // ---------------------------------------------------------------------------

  describe(".flatMap()", () => {
    const tagData = {
      items: [
        { id: 1, tags: ["a", "b"] },
        { id: 2, tags: ["c"] },
        { id: 3, tags: [] },
        { id: 4, tags: ["d", "e", "f"] },
      ],
    };

    it("should expand 1-to-many and flatten", () => {
      const result = query(tagData)
        .array("items")
        .flatMap((item) => item.tags)
        .all();
      expect(result).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("should handle items producing zero results", () => {
      const result = query(tagData)
        .array("items")
        .flatMap((item) => (item.id === 3 ? [] : item.tags))
        .all();
      expect(result).toEqual(["a", "b", "c", "d", "e", "f"]);
    });
  });

  describe(".scan()", () => {
    it("should return running accumulation with init", () => {
      const result = query(testData)
        .array("items")
        .scan((acc, item) => acc + item.price, 0)
        .all();
      // [0, 100, 150, 300, 375]
      expect(result).toEqual([0, 100, 150, 300, 375]);
    });

    it("should have length n+1", () => {
      const result = query(testData)
        .array("items")
        .scan((acc, _item) => acc + 1, 0)
        .all();
      expect(result).toHaveLength(5); // 4 items + 1 init
    });

    it("should return [init] for empty input", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("NonExistent")
        .scan((acc, _item) => acc + 1, 0)
        .all();
      expect(result).toEqual([0]);
    });
  });

  describe(".take()", () => {
    it("should return the first n items", () => {
      const result = query(testData).array("items").take(2).all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should return all items if n >= length", () => {
      const result = query(testData).array("items").take(10).all();
      expect(result).toHaveLength(4);
    });

    it("should return empty if n <= 0", () => {
      const result = query(testData).array("items").take(0).all();
      expect(result).toHaveLength(0);
    });

    it("should apply after filters", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .take(1)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe(".drop()", () => {
    it("should skip the first n items", () => {
      const result = query(testData).array("items").drop(2).all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(4);
    });

    it("should return empty if n >= length", () => {
      const result = query(testData).array("items").drop(10).all();
      expect(result).toHaveLength(0);
    });

    it("should return all items if n <= 0", () => {
      const result = query(testData).array("items").drop(0).all();
      expect(result).toHaveLength(4);
    });
  });

  describe(".takeWhile()", () => {
    it("should take items while predicate holds", () => {
      const result = query(testData)
        .array("items")
        .takeWhile((item) => item.price <= 100)
        .all();
      // Item A (100) passes, Item B (50) passes, but first let's check order
      // items: 100, 50, 150, 75 → takeWhile(<=100) → [100, 50] then 150 breaks
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should return empty if first item fails", () => {
      const result = query(testData)
        .array("items")
        .takeWhile((item) => item.price > 200)
        .all();
      expect(result).toHaveLength(0);
    });
  });

  describe(".dropWhile()", () => {
    it("should drop items while predicate holds", () => {
      const result = query(testData)
        .array("items")
        .dropWhile((item) => item.price <= 100)
        .all();
      // Drops 100, 50 → returns [150, 75]
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(4);
    });

    it("should return all if first item fails predicate", () => {
      const result = query(testData)
        .array("items")
        .dropWhile((item) => item.price > 200)
        .all();
      expect(result).toHaveLength(4);
    });
  });

  describe(".partition()", () => {
    it("should split into matching and non-matching", () => {
      const [premium, others] = query(testData)
        .array("items")
        .partition((item) => item.type === "Premium");
      expect(premium.all()).toHaveLength(2);
      expect(others.all()).toHaveLength(2);
      expect(premium.all().every((i) => i.type === "Premium")).toBe(true);
      expect(others.all().every((i) => i.type !== "Premium")).toBe(true);
    });

    it("should return empty second group when all match", () => {
      const [matching, rest] = query(testData)
        .array("items")
        .partition((item) => item.price > 0);
      expect(matching.all()).toHaveLength(4);
      expect(rest.all()).toHaveLength(0);
    });

    it("should allow chaining on partition results", () => {
      const [premium] = query(testData)
        .array("items")
        .partition((item) => item.type === "Premium");
      const total = premium.reduce((acc, item) => acc + item.price, 0);
      expect(total).toBe(250);
    });
  });

  describe(".zip()", () => {
    it("should pair items with external array", () => {
      const labels = ["first", "second", "third", "fourth"];
      const result = query(testData).array("items").zip(labels).all();
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([testData.items[0], "first"]);
      expect(result[3]).toEqual([testData.items[3], "fourth"]);
    });

    it("should truncate to shorter array", () => {
      const labels = ["a", "b"];
      const result = query(testData).array("items").zip(labels).all();
      expect(result).toHaveLength(2);
    });

    it("should handle empty external array", () => {
      const result = query(testData).array("items").zip([]).all();
      expect(result).toHaveLength(0);
    });
  });

  describe(".zipWith()", () => {
    it("should combine items with external array using fn", () => {
      const multipliers = [2, 3, 1, 4];
      const result = query(testData)
        .array("items")
        .zipWith(multipliers, (item, mult) => item.price * mult)
        .all();
      expect(result).toEqual([200, 150, 150, 300]);
    });

    it("should truncate to shorter array", () => {
      const multipliers = [2];
      const result = query(testData)
        .array("items")
        .zipWith(multipliers, (item, mult) => item.price * mult)
        .all();
      expect(result).toEqual([200]);
    });
  });
});
