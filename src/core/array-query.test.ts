import { arrayPipeline, query } from "../index";

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
        .ignoreCase(false)
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

  describe(".filterIfDefined() and .filterIfAllDefined()", () => {
    it("should skip filterIfDefined when param is undefined", () => {
      const result = query(testData)
        .array("items")
        .filterIfDefined("price > 100", undefined)
        .all();
      expect(result).toHaveLength(4);
    });

    it("should apply filterIfDefined when param is defined", () => {
      const result = query(testData)
        .array("items")
        .filterIfDefined("price > 100", 100)
        .all();
      expect(result.every((i) => i.price > 100)).toBe(true);
    });

    it("should support logical operators the same as filter", () => {
      const result = query(testData)
        .array("items")
        .filterIfDefined("type == 'Premium' and price > 120", true)
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it("should support substring values like 'orange'", () => {
      const result = query(testData)
        .array("items")
        .filterIfDefined("name contains orange", true)
        .all();
      expect(result).toHaveLength(0);
    });

    it("should apply filterIfAllDefined when all params are defined", () => {
      const result = query(testData)
        .array("items")
        .filterIfAllDefined("price > 100", [150, "Premium"])
        .all();
      expect(result).toHaveLength(1);
    });

    it("should skip filterIfAllDefined when any param is undefined", () => {
      const result = query(testData)
        .array("items")
        .filterIfAllDefined("price > 100", [150, undefined])
        .all();
      expect(result).toHaveLength(4);
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

    it("should filter plucked values by runtime type", () => {
      const data = {
        items: [{ value: 1 }, { value: "3" }, { value: "john" }, { value: 5 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .ofType("number")
        .all();

      expect(result).toEqual([1, 5]);
    });

    it("should support object, null, and array type filters", () => {
      const data = {
        items: [
          { value: { id: 1 } },
          { value: null },
          { value: [1, 2] },
          { value: "x" },
        ],
      };

      const plucked = query(data).array("items").pluck("value");

      expect(plucked.ofType("object").all()).toEqual([{ id: 1 }]);
      expect(plucked.ofType("null").all()).toEqual([null]);
      expect(plucked.ofType("array").all()).toEqual([[1, 2]]);
    });

    it("should apply abs() to numeric values", () => {
      const data = {
        items: [{ value: -3 }, { value: 2 }, { value: -1.5 }],
      };

      const result = query(data).array("items").pluck("value").abs().all();

      expect(result).toEqual([3, 2, 1.5]);
    });

    it("should throw when abs() receives non-number values", () => {
      const data = {
        items: [{ value: -3 }, { value: "2" }],
      };

      expect(() => {
        query(data).array("items").pluck("value").abs().all();
      }).toThrow("Use ofType('number') or number() first");
    });

    it("should clamp values into the provided range", () => {
      const data = {
        items: [{ value: -10 }, { value: 40 }, { value: 120 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .clamp(0, 100)
        .all();

      expect(result).toEqual([0, 40, 100]);
    });

    it("should throw when clamp bounds are invalid", () => {
      const data = {
        items: [{ value: 10 }],
      };

      expect(() => {
        query(data).array("items").pluck("value").clamp(10, 0).all();
      }).toThrow("expects min to be <= max");
    });

    it("should scale values by factor", () => {
      const data = {
        items: [{ value: 1.2 }, { value: 3 }, { value: -0.5 }],
      };

      const result = query(data).array("items").pluck("value").scale(10).all();

      expect(result).toEqual([12, 30, -5]);
    });

    it("should offset values by delta", () => {
      const data = {
        items: [{ value: 300 }, { value: 310 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .offset(-273.15)
        .all();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo(26.85, 10);
      expect(result[1]).toBeCloseTo(36.85, 10);
    });

    it("should round number values to fixed decimals", () => {
      const data = {
        items: [{ value: 1.234 }, { value: 5.678 }, { value: 9.994 }],
      };

      const result = query(data).array("items").pluck("value").round(2).all();

      expect(result).toEqual([1.23, 5.68, 9.99]);
    });

    it("should support half-even mode for decimal-place ties", () => {
      const data = {
        items: [{ value: 1.25 }, { value: 1.35 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .round(1, { mode: "halfEven" })
        .all();

      expect(result).toEqual([1.2, 1.4]);
    });

    it("should keep half-up as default mode for decimal-place ties", () => {
      const data = {
        items: [{ value: 1.25 }, { value: 1.35 }],
      };

      const result = query(data).array("items").pluck("value").round(1).all();

      expect(result).toEqual([1.3, 1.4]);
    });

    it("should round number values to significant digits", () => {
      const data = {
        items: [{ value: 1234.56 }, { value: 0.012345 }, { value: 999.5 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .roundSignificant(3)
        .all();

      expect(result).toEqual([1230, 0.0123, 1000]);
    });

    it("should support half-even mode for significant-digit ties", () => {
      const data = {
        items: [{ value: 125 }, { value: 135 }, { value: 124 }, { value: 136 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .roundSignificant(2, { mode: "halfEven" })
        .all();

      expect(result).toEqual([120, 140, 120, 140]);
    });

    it("should keep half-up as default mode for significant-digit ties", () => {
      const data = {
        items: [{ value: 125 }, { value: 135 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .roundSignificant(2)
        .all();

      expect(result).toEqual([130, 140]);
    });

    it("should throw when rounding non-number values", () => {
      const data = {
        items: [{ value: 1.234 }, { value: "2.345" }],
      };

      expect(() => {
        query(data).array("items").pluck("value").round(2).all();
      }).toThrow("Use ofType('number') or number() first");
    });

    it("should support first/last/nth/one/count terminals", () => {
      const values = query(testData).array("items").pluck("id");
      const single = query(testData)
        .array("items")
        .where("id")
        .equals(1)
        .pluck("id");

      expect(values.first()).toBe(1);
      expect(values.last()).toBe(4);
      expect(values.nth(2)).toBe(3);
      expect(single.one("exactly one")).toBe(1);
      expect(
        query(testData)
          .array("items")
          .where("id")
          .equals(1)
          .pluck("id")
          .count(),
      ).toBe(1);
    });

    it("should throw for invalid pluck terminals", () => {
      const empty = query(testData)
        .array("items")
        .where("id")
        .equals(999)
        .pluck("id");

      expect(() => empty.first()).toThrow("No values found for first()");
      expect(() => empty.last()).toThrow("No values found for last()");
      expect(() => empty.random()).toThrow("No values found for random()");
      expect(() => empty.nth(0)).toThrow("out of bounds");
      expect(() => empty.one()).toThrow(
        "Expected exactly one value, but found zero",
      );
    });

    it("should convert plucked values to strings", () => {
      const data = {
        items: [{ value: 1 }, { value: null }, { value: true }],
      };

      const result = query(data).array("items").pluck("value").string().all();

      expect(result).toEqual(["1", "", "true"]);
    });

    it("should preserve explicit undefined leaf values", () => {
      const data = {
        items: [{ value: undefined }, { value: 5 }],
      };

      const result = query(data).array("items").pluck("value").all();

      expect(result).toEqual([undefined, 5]);
    });

    it("should throw when string() receives object values", () => {
      const data = {
        items: [{ value: { id: 1 } }],
      };

      expect(() => {
        query(data).array("items").pluck("value").string().all();
      }).toThrow("Cannot convert object to string");
    });

    it("should convert plucked values to numbers", () => {
      const data = {
        items: [{ value: "10" }, { value: 20 }, { value: "3.5" }],
      };

      const result = query(data).array("items").pluck("value").number().all();

      expect(result).toEqual([10, 20, 3.5]);
    });

    it("should throw when number() receives null/undefined or NaN", () => {
      const hasNull = {
        items: [{ value: null }],
      };
      const hasNaN = {
        items: [{ value: "hello" }],
      };

      expect(() => {
        query(hasNull).array("items").pluck("value").number().all();
      }).toThrow("Cannot convert null to number");

      expect(() => {
        query(hasNaN).array("items").pluck("value").number().all();
      }).toThrow("Value is NaN after conversion");
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

  describe("Index/Path/Aggregate helpers", () => {
    it("should support index() terminals", () => {
      const idx = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .index();
      expect(idx.all()).toEqual([0, 2]);
      expect(idx.first()).toBe(0);
      expect([0, 2]).toContain(idx.random());
      expect(
        query(testData).array("items").where("id").equals(1).index().one(),
      ).toBe(0);
    });

    it("should support path() terminals", () => {
      const paths = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .path();
      expect(paths.all()).toEqual(["items[0]", "items[2]"]);
      expect(paths.first()).toBe("items[0]");
      expect(paths.last()).toBe("items[2]");
      expect(paths.nth(1)).toBe("items[2]");
      expect(["items[0]", "items[2]"]).toContain(paths.random());
      expect(
        query(testData).array("items").where("id").equals(1).path().one(),
      ).toBe("items[0]");
    });

    it("should support aggregate() chain", () => {
      const stats = query(testData)
        .array("items")
        .aggregate()
        .sum("price")
        .average("price")
        .min("price")
        .max("price")
        .count()
        .sumOfProducts("id", "price")
        .all();

      expect(stats).toEqual({
        sum: 375,
        average: 93.75,
        min: 50,
        max: 150,
        count: 4,
        sumOfProducts: 950,
      });
    });
  });

  describe("JsonQueryRoot helpers", () => {
    it("should support root pick() with aliases", () => {
      const root = {
        result: { status: "OK", id: 123 },
      };

      const picked = query(root).pick({
        status: "result.status",
        id: "result.id",
      });
      expect(picked).toEqual({ status: "OK", id: 123 });
    });

    it("should support arrayRoot()", () => {
      const rootArray = [
        { id: 1, type: "Premium" },
        { id: 2, type: "Basic" },
      ];

      const result = query(rootArray)
        .arrayRoot<{ id: number; type: string }>()
        .where("type")
        .equals("Premium")
        .all();
      expect(result).toEqual([{ id: 1, type: "Premium" }]);
    });

    it("should support objectGroups() include/exclude and arrays()", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
          c: { items: [{ id: 4 }] },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .arrays<{ id: number }>("items")
        .pluck("id")
        .all();

      expect(result).toEqual([1, 2]);
    });

    it("should support objectGroups() entries/values/random helpers", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }] },
          b: { items: [{ id: 2 }] },
        },
      };

      const groups = query(root).objectGroups("sections");
      const entries = groups.entries();
      const values = groups.values();

      expect(entries).toHaveLength(2);
      expect(values).toHaveLength(2);

      const [key, value] = groups.randomEntry();
      expect(["a", "b"]).toContain(key);
      expect(value).toHaveProperty("items");

      const randomValue = groups.randomValue();
      expect(randomValue).toHaveProperty("items");
    });

    it("should throw for random helpers when include/exclude leaves no groups", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }] },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["missing"])
        .exclude(["a"]);

      expect(() => groups.randomEntry()).toThrow(
        "No group entries found for randomEntry().",
      );
      expect(() => groups.randomValue()).toThrow(
        "No group entries found for randomEntry().",
      );
    });

    it("should throw when objectGroups flatArray path is not an array", () => {
      const root = {
        sections: {
          a: { notItems: 1 },
        },
      };

      expect(() => {
        query(root).objectGroups("sections").flatArray("notItems");
      }).toThrow('Expected array at path "notItems" in group "a".');
    });
  });

  describe("Additional branch coverage", () => {
    it("should support root pick string/array forms and raw()", () => {
      const root = { result: { status: "OK", id: 123 } };

      expect(query(root).pick("result.status")).toEqual({
        "result.status": "OK",
      });
      expect(query(root).pick(["result.status", "result.id"])).toEqual({
        "result.status": "OK",
        "result.id": 123,
      });
      expect(query(root).raw()).toBe(root);
    });

    it("should throw when objectGroups target is not object and run() path is not array", () => {
      expect(() =>
        query({ sections: [] as any[] }).objectGroups("sections"),
      ).toThrow('Expected object at path "sections".');

      const fakeRecipe = {
        _getArrayPath: () => "scalar",
        _getSteps: () => [],
      } as any;
      expect(() => query({ scalar: 123 }).run(fakeRecipe)).toThrow(
        'Expected array at path "scalar", got number.',
      );
    });

    it("should cover conditional helper variants", () => {
      const result = query(testData)
        .array("items")
        .greaterThanOrEqualIfDefined("price", 100)
        .lessThanIfDefined("price", 150)
        .lessThanOrEqualIfDefined("price", 100)
        .all();

      expect(result.map((x) => x.id)).toEqual([1]);
    });

    it("should cover negated conditional string helpers", () => {
      const result = query(testData)
        .array("items")
        .notContainsIfDefined("name", "Item B")
        .notStartsWithIfDefined("name", "Item A")
        .notEndsWithIfDefined("name", "D")
        .all();

      expect(result.map((x) => x.id)).toEqual([3]);
    });

    it("should cover aggregate edge and error branches", () => {
      expect(query(testData).array("items").where("id").gt(0).every()).toBe(
        true,
      );
      expect(
        query(testData).array("items").where("id").equals(1).any().id,
      ).toBe(1);
      expect(
        query(testData).array("items").where("id").equals(999).average("price"),
      ).toBe(0);
      expect(
        query(testData).array("items").where("id").equals(999).min("price"),
      ).toBeNull();
      expect(
        query(testData).array("items").where("id").equals(999).max("price"),
      ).toBeNull();

      expect(() => query(testData).array("items").sumOfProducts()).toThrow(
        "sumOfProducts() requires at least one path",
      );
      expect(() =>
        query({ items: [{ a: 1, b: "x" }] })
          .array("items")
          .sumOfProducts("a", "b"),
      ).toThrow('Invalid number at path "b" for product calculation');
    });

    it("should cover distinct deep-search failures", () => {
      expect(() =>
        query({ items: [{ a: 1 }] })
          .array("items")
          .distinct("x"),
      ).toThrow("does not exist in item (deep search)");

      expect(() =>
        query({ items: [{ a: { id: 1 }, b: { id: 2 } }] })
          .array("items")
          .distinct("id"),
      ).toThrow("matched multiple values");
    });

    it("should cover findAll and randomWithPath empty error", () => {
      const data = {
        items: [
          { id: 1, nested: { value: "a" } },
          { id: 2, nested: { value: "b" } },
        ],
      };

      expect(query(data).array("items").findAll("id").all()).toEqual([1, 2]);
      expect(() =>
        query(data).array("items").findAll("nested.value").all(),
      ).toThrow(
        'Path "nested.value" does not exist: property "nested" not found.',
      );
      expect(() =>
        query(testData).array("items").where("id").equals(999).randomWithPath(),
      ).toThrow("No matches found for randomWithPath().");
    });

    it("should cover path/allWithIndex metadata fallback branches", () => {
      const q: any = query({ items: [{ id: 1 }] }).array("items");

      q.metadata = {
        groupsRootPath: "sections",
        arrayPath: "items",
        itemMetadata: [],
      };
      q._executeFilter = () => [{ id: 999 }];
      expect(q.path().all()).toEqual(["[0]"]);

      q._executeFilter = () => [q.items[0]];
      expect(q.path().all()).toEqual(["[0]"]);

      q._executeFilter = () => [{ id: 999 }];
      expect(q.allWithIndex()).toEqual([[-1, { id: 999 }]]);
    });

    it("should cover nth() bound and unbound branches", () => {
      expect(query(testData).array("items").nth(2).id).toBe(3);
      expect(() => query(testData).array("items").nth(999)).toThrow(
        "out of bounds",
      );

      const unbound: any = arrayPipeline<{ id: number }>();
      const next = unbound.nth(0);
      expect(next).toBeDefined();
    });

    it("should cover bound-only guard branches on unbound pipeline", () => {
      const pipe: any = arrayPipeline<{ id: number }>();

      expect(() => pipe.aggregate()).toThrow(
        "aggregate() is only available on bound queries.",
      );
      expect(() => pipe.pluck("id")).toThrow(
        "pluck() is only available on bound queries.",
      );
      expect(() => pipe.findAll("id")).toThrow(
        "findAll() is only available on bound queries.",
      );
      expect(() => pipe.pick("id")).toThrow(
        "pick() is only available on bound queries.",
      );
      expect(() => pipe.path()).toThrow(
        "path() is only available on bound queries.",
      );
      expect(() => pipe.index()).toThrow(
        "index() is only available on bound queries.",
      );
      expect(() => pipe.allWithIndex()).toThrow(
        "allWithIndex() is only available on bound queries.",
      );
      expect(() => pipe.randomWithPath()).toThrow(
        "randomWithPath() is only available on bound queries.",
      );
    });
  });
});
