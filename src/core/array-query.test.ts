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
    it("should be case-sensitive by default", () => {
      const result = query(testData)
        .array("items")
        .where("name")
        .contains("item")
        .all();
      expect(result).toHaveLength(0);
    });

    it("should support case-insensitive contains when enabled", () => {
      const result = query(testData)
        .array("items")
        .where("name")
        .ignoreCase()
        .contains("item")
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

  describe(".whereNotIn()", () => {
    it("should exclude items whose value is in the provided list", () => {
      const result = query(testData)
        .array("items")
        .whereNotIn("type", ["Premium", "Standard"])
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("Basic");
    });

    it("should throw for empty values array", () => {
      expect(() =>
        query(testData).array("items").whereNotIn("type", []),
      ).toThrow('whereNotIn("type") requires a non-empty array of values.');
    });

    it("should support numeric string coercion with numeric values", () => {
      const result = query(testData)
        .array("items")
        .whereIn("price", [100, 50])
        .all();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should support whereNotIn with numeric string coercion", () => {
      const result = query(testData)
        .array("items")
        .whereNotIn("price", [100, 50])
        .all();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(4);
    });

    it("should allow disabling numeric string coercion for whereIn/whereNotIn", () => {
      const data = {
        items: [
          { id: 1, price: "100" },
          { id: 2, price: "50" },
          { id: 3, price: 100 },
          { id: 4, price: 50 },
        ],
      };

      const inResult = query(data)
        .array("items")
        .whereIn("price", [100, 50], { coerceNumericStrings: false })
        .all();

      const notInResult = query(data)
        .array("items")
        .whereNotIn("price", [100, 50], { coerceNumericStrings: false })
        .all();

      expect(inResult).toHaveLength(2);
      expect(inResult.map((x) => x.id)).toEqual([3, 4]);
      expect(notInResult).toHaveLength(2);
      expect(notInResult.map((x) => x.id)).toEqual([1, 2]);
    });
  });

  describe(".whereMissing() and .whereExists()", () => {
    const data = {
      items: [
        { id: 1, type: "Premium", category: "A" },
        { id: 2, type: "Basic" },
        { id: 3, type: "Premium", category: "B" },
      ],
    };

    it("should filter items where key does not exist", () => {
      const result = query(data).array("items").whereMissing("category").all();
      expect(result.map((item) => item.id)).toEqual([2]);
    });

    it("should filter items where key exists", () => {
      const result = query(data).array("items").whereExists("category").all();
      expect(result.map((item) => item.id)).toEqual([1, 3]);
    });

    it("should filter items where all keys in array are missing", () => {
      const multiData = {
        items: [
          { id: 1, type: "Premium", category: "A", tag: "x" },
          { id: 2, type: "Basic" },
          { id: 3, type: "Standard", category: "B" },
        ],
      };
      const result = query(multiData)
        .array("items")
        .whereMissing(["category", "tag"])
        .all();
      expect(result.map((item) => item.id)).toEqual([2]);
    });

    it("should filter items where all keys in array exist", () => {
      const multiData = {
        items: [
          { id: 1, type: "Premium", category: "A", tag: "x" },
          { id: 2, type: "Basic" },
          { id: 3, type: "Standard", category: "B" },
        ],
      };
      const result = query(multiData)
        .array("items")
        .whereExists(["category", "tag"])
        .all();
      expect(result.map((item) => item.id)).toEqual([1]);
    });
  });

  describe(".exists() and .every() direct selection guards", () => {
    it("should throw when called directly after array()", () => {
      expect(() => (query(testData).array("items") as any).exists()).toThrow(
        "exists() cannot be called directly after array(), flatArray(), or arrays(). Add a narrowing step first (for example where(), whereIn(), whereExists(), filter(), take(), or drop()).",
      );
      expect(() => (query(testData).array("items") as any).every()).toThrow(
        "every() cannot be called directly after array(), flatArray(), or arrays(). Add a narrowing step first (for example where(), whereIn(), whereExists(), filter(), take(), or drop()).",
      );
    });

    it("should still allow exists() and every() after narrowing", () => {
      expect(
        query(testData).array("items").where("id").equals(1).exists(),
      ).toBe(true);
      expect(query(testData).array("items").where("id").gt(0).every()).toBe(
        true,
      );
    });

    it("should throw when called directly after flatArray() or arrays()", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1, type: "Premium" }] },
          b: { items: [{ id: 2, type: "Basic" }] },
        },
      };

      expect(() =>
        (
          query(root).objectGroups("sections").flatArray("items") as any
        ).exists(),
      ).toThrow(
        "exists() cannot be called directly after array(), flatArray(), or arrays(). Add a narrowing step first (for example where(), whereIn(), whereExists(), filter(), take(), or drop()).",
      );
      expect(() =>
        (query(root).objectGroups("sections").arrays("items") as any).every(),
      ).toThrow(
        "every() cannot be called directly after array(), flatArray(), or arrays(). Add a narrowing step first (for example where(), whereIn(), whereExists(), filter(), take(), or drop()).",
      );
    });
  });

  describe(".whereAny()", () => {
    it("should match items when any criterion is satisfied", () => {
      const result = query(testData)
        .array("items")
        .whereAny({ type: "Basic", price: 150 })
        .all();

      expect(result).toHaveLength(2);
      expect(result.map((item) => item.id)).toEqual([2, 3]);
    });

    it("should throw for empty criteria", () => {
      expect(() => query(testData).array("items").whereAny({})).toThrow(
        "whereAny() requires at least one criterion.",
      );
    });
  });

  describe(".whereNone()", () => {
    it("should match items when none of the criteria are satisfied", () => {
      const result = query(testData)
        .array("items")
        .whereNone({ type: "Premium", name: "Item D" })
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should throw for empty criteria", () => {
      expect(() => query(testData).array("items").whereNone({})).toThrow(
        "whereNone() requires at least one criterion.",
      );
    });
  });

  describe(".whereSelf()", () => {
    it("should filter primitive items by item value", () => {
      const result = query([1, 2, 3, 4, 3])
        .arrayRoot<number>()
        .whereSelf()
        .equals(3)
        .all();

      expect(result).toEqual([3, 3]);
    });

    it("should support non-equality operators on primitive items", () => {
      const result = query([1, 2, 3, 4, 3])
        .arrayRoot<number>()
        .whereSelf()
        .gt(2)
        .all();

      expect(result).toEqual([3, 4, 3]);
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

  describe(".sort()", () => {
    it("should sort primitive items by item value when path is omitted", () => {
      const result = query([1, 2, 4, 5]).arrayRoot<number>().sort().all();
      expect(result).toEqual([1, 2, 4, 5]);

      const desc = query([1, 2, 4, 5])
        .arrayRoot<number>()
        .sort(undefined, { direction: "desc" })
        .all();
      expect(desc).toEqual([5, 4, 2, 1]);
    });

    it("should sort primitive items by item value when path is empty", () => {
      const desc = query([1, 2, 4, 5])
        .arrayRoot<number>()
        .sort("", { direction: "desc" })
        .all();
      expect(desc).toEqual([5, 4, 2, 1]);
    });

    it("should place nullish values first/last via sort nulls option", () => {
      const source = [1, undefined, 2, null] as Array<
        number | null | undefined
      >;

      const first = query(source)
        .arrayRoot<number | null | undefined>()
        .sort("", { direction: "asc", nulls: "first" })
        .all();
      expect(first).toEqual([undefined, null, 1, 2]);

      const last = query(source)
        .arrayRoot<number | null | undefined>()
        .sort("", { direction: "desc", nulls: "last" })
        .all();
      expect(last).toEqual([2, 1, undefined, null]);
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

    it("should respect ignoreCase(false) in containsIfDefined", () => {
      const result = query(testData)
        .array("items")
        .containsIfDefined("name", "item", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(0);
    });

    it("should respect ignoreCase(false) in startsWithIfDefined", () => {
      const result = query(testData)
        .array("items")
        .startsWithIfDefined("name", "item", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(0);
    });

    it("should respect ignoreCase(false) in endsWithIfDefined", () => {
      const result = query(testData)
        .array("items")
        .endsWithIfDefined("name", "a", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(0);
    });

    it("should respect ignoreCase(false) in notContainsIfDefined", () => {
      const result = query(testData)
        .array("items")
        .notContainsIfDefined("name", "item", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(4);
    });

    it("should respect ignoreCase(false) in whereIfDefined", () => {
      const result = query(testData)
        .array("items")
        .whereIfDefined("type", "premium", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(0);
    });

    it("should respect ignoreCase(false) in whereNotIfDefined", () => {
      const result = query(testData)
        .array("items")
        .whereNotIfDefined("type", "premium", { ignoreCase: false })
        .all();

      expect(result).toHaveLength(4);
    });

    it("should respect trim(true) in notStartsWithIfDefined", () => {
      const data = {
        items: [
          { id: 1, name: " Antony Santos" },
          { id: 2, name: "Bryant Edwards" },
          { id: 3, name: "Anthony Soprano" },
        ],
      };

      const result = query(data)
        .array("items")
        .notStartsWithIfDefined("name", "ant", {
          ignoreCase: true,
          trim: true,
        })
        .all();

      expect(result.map((x) => x.id)).toEqual([2]);
    });

    it("should tolerate no-space symbolic operators in filter expressions", () => {
      const minPrice = 50;
      const result = query(testData)
        .array("items")
        .filterIfDefined("price >= $minPrice and type=='Basic'", minPrice)
        .all();

      expect(result.map((x) => x.id)).toEqual([2]);
    });

    it("should apply filterIfAllDefined when all params are defined", () => {
      const result = query(testData)
        .array("items")
        .filterIfAllDefined("price > 100", { min: 150, type: "Premium" })
        .all();
      expect(result).toHaveLength(1);
    });

    it("should skip filterIfAllDefined when any param is undefined", () => {
      const result = query(testData)
        .array("items")
        .filterIfAllDefined("price > 100", { min: 150, type: undefined })
        .all();
      expect(result).toHaveLength(4);
    });

    it("should bind a single named placeholder in filterIfDefined", () => {
      const minPrice = 100;
      const result = query(testData)
        .array("items")
        .filterIfDefined("price >= $minPrice", minPrice)
        .all();

      expect(result.map((x) => x.id)).toEqual([1, 3]);
    });

    it("should bind named placeholders from object params in filterIfAllDefined", () => {
      const result = query(testData)
        .array("items")
        .filterIfAllDefined("price >= $min and type == $type", {
          min: 100,
          type: "Premium",
        })
        .all();

      expect(result.map((x) => x.id)).toEqual([1, 3]);
    });

    it("should throw when array params are passed to filterIfAllDefined", () => {
      expect(() => {
        query(testData)
          .array("items")
          .filterIfAllDefined("price >= $min and type == $type", [
            100,
            "Premium",
          ] as any)
          .all();
      }).toThrow("filterIfAllDefined() expects an object map of params");
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

    it("should coerce numeric-string values for sum", () => {
      const result = query({
        items: [
          { id: 1, price: "100" },
          { id: 2, price: "50.5" },
          { id: 3, price: 24.5 },
          { id: 4, price: "not-a-number" },
        ],
      })
        .array("items")
        .sum("price");

      expect(result).toBe(175);
    });

    it("should allow disabling numeric-string coercion for sum", () => {
      const result = query({
        items: [
          { id: 1, price: "100" },
          { id: 2, price: "50" },
          { id: 3, price: 25 },
        ],
      })
        .array("items")
        .sum("price", { coerceNumericStrings: false });

      expect(result).toBe(25);
    });

    it("should sum primitive numeric arrays when path is omitted", () => {
      const result = query([1, 2, 3, 4]).arrayRoot<number>().sum();
      expect(result).toBe(10);
    });

    it("should support decimals option for sum", () => {
      const result = query([1.005, 2.005]).arrayRoot<number>().sum("", {
        decimals: 2,
      });
      expect(result).toBe(3.01);
    });
  });

  describe(".average()", () => {
    it("should calculate average of numeric values", () => {
      const result = query(testData).array("items").average("price");
      expect(result).toBe(93.75);
    });

    it("should coerce numeric-string values for average", () => {
      const result = query({
        items: [
          { id: 1, price: "100" },
          { id: 2, price: "50" },
          { id: 3, price: 50 },
          { id: 4, price: "not-a-number" },
        ],
      })
        .array("items")
        .average("price");

      expect(result).toBe(50);
    });

    it("should allow disabling numeric-string coercion for average", () => {
      const result = query({
        items: [
          { id: 1, price: "100" },
          { id: 2, price: "50" },
          { id: 3, price: 50 },
          { id: 4, price: 25 },
        ],
      })
        .array("items")
        .average("price", { coerceNumericStrings: false });

      expect(result).toBe(18.75);
    });

    it("should average primitive numeric arrays when path is omitted", () => {
      const result = query([1, 2, 3, 4]).arrayRoot<number>().average();
      expect(result).toBe(2.5);
    });

    it("should support decimals option for average", () => {
      const result = query([1, 2]).arrayRoot<number>().average("", {
        decimals: 0,
      });
      expect(result).toBe(2);
    });
  });

  describe(".min() and .max()", () => {
    it("should find min and max values", () => {
      const min = query(testData).array("items").min("price");
      const max = query(testData).array("items").max("price");
      expect(min).toBe(50);
      expect(max).toBe(150);
    });

    it("should find min and max on primitive numeric arrays when path is omitted", () => {
      const min = query([3, 1, 9, 2]).arrayRoot<number>().min();
      const max = query([3, 1, 9, 2]).arrayRoot<number>().max();
      expect(min).toBe(1);
      expect(max).toBe(9);
    });
  });

  describe(".distinct()", () => {
    it("should return distinct values", () => {
      const result = query(testData).array("items").distinct("type").all();
      expect(result).toHaveLength(3);
      // distinct returns objects, not just the field values
      expect(result.some((item: any) => item.type === "Premium")).toBe(true);
      expect(result.some((item: any) => item.type === "Basic")).toBe(true);
      expect(result.some((item: any) => item.type === "Standard")).toBe(true);
    });

    it("should remove duplicates by deep structural equality when no path is provided", () => {
      const data = {
        items: [
          { id: 1, type: "Premium" },
          { id: 2, type: "Basic" },
          { id: 1, type: "Premium" },
        ],
      };

      const result = query(data).array("items").distinct().all();

      expect(result).toEqual([
        { id: 1, type: "Premium" },
        { id: 2, type: "Basic" },
      ]);
    });

    it("should treat object key order as equal for no-path distinct", () => {
      const data = {
        items: [
          { id: 1, meta: { a: 1, b: 2 } },
          { id: 1, meta: { b: 2, a: 1 } },
        ],
      };

      const result = query(data).array("items").distinct().all();

      expect(result).toEqual([{ id: 1, meta: { a: 1, b: 2 } }]);
    });

    it("should allow chaining terminals after distinct", () => {
      const distinctQuery = query(testData).array("items").distinct("type");

      expect(distinctQuery.count()).toBe(3);

      const randomItem = distinctQuery.random();
      expect(["Premium", "Basic", "Standard"]).toContain(randomItem.type);
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

    it("should optionally coerce numeric strings for abs()", () => {
      const data = {
        items: [{ value: "-3" }, { value: "2.5" }, { value: -1.5 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .abs({ coerceNumericStrings: true })
        .all();

      expect(result).toEqual([3, 2.5, 1.5]);
    });

    it("should throw when abs() receives non-number values", () => {
      const data = {
        items: [{ value: -3 }, { value: "not-a-number" }],
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

    it("should optionally coerce numeric strings for clamp()", () => {
      const data = {
        items: [{ value: "-10" }, { value: "40" }, { value: 120 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .clamp(0, 100, { coerceNumericStrings: true })
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

    it("should optionally coerce numeric strings for scale()", () => {
      const data = {
        items: [{ value: "1.2" }, { value: "3" }, { value: -0.5 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .scale(10, { coerceNumericStrings: true })
        .all();

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

    it("should optionally coerce numeric strings for offset()", () => {
      const data = {
        items: [{ value: "300" }, { value: "310.5" }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .offset(-273.15, { coerceNumericStrings: true })
        .all();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo(26.85, 10);
      expect(result[1]).toBeCloseTo(37.35, 10);
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
        items: [{ value: 1.234 }, { value: "oops" }],
      };

      expect(() => {
        query(data).array("items").pluck("value").round(2).all();
      }).toThrow("Use ofType('number') or number() first");
    });

    it("should allow disabling numeric-string coercion for scale()", () => {
      const data = {
        items: [{ value: "1.2" }, { value: 3 }],
      };

      expect(() => {
        query(data)
          .array("items")
          .pluck("value")
          .scale(10, { coerceNumericStrings: false })
          .all();
      }).toThrow("Use ofType('number') or number() first");
    });

    it("should optionally coerce numeric strings for round()", () => {
      const data = {
        items: [{ value: "1.234" }, { value: "2.345" }, { value: 3.333 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .round(2, { coerceNumericStrings: true })
        .all();

      expect(result).toEqual([1.23, 2.35, 3.33]);
    });

    it("should optionally coerce numeric strings for roundSignificant()", () => {
      const data = {
        items: [{ value: "1234.56" }, { value: "0.012345" }, { value: 999.5 }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .roundSignificant(3, { coerceNumericStrings: true })
        .all();

      expect(result).toEqual([1230, 0.0123, 1000]);
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

    it("should convert plucked strings to lower case", () => {
      const data = {
        items: [{ value: "ALIce" }, { value: "bOB" }, { value: null }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .string({ case: "lower" })
        .all();

      expect(result).toEqual(["alice", "bob", ""]);
    });

    it("should convert plucked strings to upper case", () => {
      const data = {
        items: [{ value: "ALIce" }, { value: "bOB" }, { value: undefined }],
      };

      const result = query(data)
        .array("items")
        .pluck("value")
        .string({ case: "upper" })
        .all();

      expect(result).toEqual(["ALICE", "BOB", ""]);
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
        .pick(["id", "name"])
        .all();
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
        .pick({ itemId: "id", itemName: "name" })
        .all();
      expect(result[0]).toHaveProperty("itemId", 1);
      expect(result[0]).toHaveProperty("itemName", "Item A");
    });
  });

  describe(".omit()", () => {
    it("should omit fields from matching object items", () => {
      const result = query(testData)
        .array("items")
        .where("type")
        .equals("Premium")
        .omit(["price", "type"])
        .all();

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty("price");
      expect(result[0]).not.toHaveProperty("type");
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
    });
  });

  describe(".compact()", () => {
    it("should remove null/undefined items by default", () => {
      const data = {
        items: [1, null, 2, undefined, 3],
      };

      const result = query(data)
        .array<number | null | undefined>("items")
        .compact()
        .all();
      expect(result).toEqual([1, 2, 3]);
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

    it("should not mutate original items when callback mutates input item", () => {
      const data = {
        items: [{ id: 1, profile: { name: "Alice" } }],
      };

      query(data)
        .array("items")
        .map((item: any) => {
          item.profile.name = "CHANGED";
          return item;
        })
        .all();

      expect(data.items[0].profile.name).toBe("Alice");
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

    it("should not mutate original source when callback mutates extracted object", () => {
      const data = {
        items: [{ id: 1, config: { label: "Original" } }],
      };

      query(data)
        .array("items")
        .map2("id", "config", (_id, config: any) => {
          config.label = "Mutated";
          return config.label;
        })
        .all();

      expect(data.items[0].config.label).toBe("Original");
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

  describe(".expand()", () => {
    const nestedData = {
      items: [
        { id: 1, meter: [{ value: 10 }, { value: 20 }] },
        { id: 2, meter: [{ value: 30 }] },
      ],
    };

    it("should expand nested arrays from a path", () => {
      const result = query(nestedData).array("items").expand("meter").all();
      expect(result).toEqual([{ value: 10 }, { value: 20 }, { value: 30 }]);
    });

    it("should throw if path does not resolve to an array", () => {
      expect(() => query(nestedData).array("items").expand("id").all()).toThrow(
        'expand("id") expected an array at path for each item',
      );
    });
  });

  describe(".expand() with recursive option", () => {
    const treeData = {
      items: [
        {
          id: 1,
          children: [
            { id: "a", children: [{ id: "a1", children: [] }] },
            { id: "b", children: [] },
          ],
        },
        {
          id: 2,
          children: [{ id: "c", children: [] }],
        },
      ],
    };

    it("should recursively expand nested arrays from a path", () => {
      const result = query(treeData)
        .array("items")
        .expand("children", { recursive: true })
        .all();
      expect(result.map((node: any) => node.id)).toEqual(["a", "a1", "b", "c"]);
    });

    it("should throw if root path does not resolve to an array", () => {
      expect(() =>
        query(treeData).array("items").expand("id", { recursive: true }).all(),
      ).toThrow('expand("id") expected an array at path for each item');
    });

    it("should treat missing/non-array descendant path as leaf by default", () => {
      const invalidTree = {
        items: [
          {
            children: [{ id: "a", children: [{ id: "a1" }] }],
          },
        ],
      };

      const result = query(invalidTree)
        .array("items")
        .expand("children", { recursive: true })
        .all();

      expect(result.map((node: any) => node.id)).toEqual(["a", "a1"]);
    });

    it("should throw if descendant path does not resolve to an array in strict mode", () => {
      const invalidTree = {
        items: [
          {
            children: [{ id: "a", children: [{ id: "a1" }] }],
          },
        ],
      };

      expect(() =>
        query(invalidTree)
          .array("items")
          .expand("children", { recursive: true, strict: true })
          .all(),
      ).toThrow(
        'expand("children") expected an array at path for each descendant',
      );
    });
  });

  describe(".setAll()", () => {
    it("should set all path occurrences within each selected item immutably", () => {
      const source = {
        items: [
          {
            id: 1,
            type: "Premium",
            transformer: { size: { value: 1 } },
            nested: {
              transformer: { size: { value: 2 } },
            },
          },
          {
            id: 2,
            type: "Basic",
            transformer: { size: { value: 3 } },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .where("type")
        .equals("Premium")
        .setAll([{ path: "transformer.size.value", value: 999 }])
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].transformer.size.value).toBe(999);
      expect(result[0].nested.transformer.size.value).toBe(999);
      expect(source.items[0].transformer.size.value).toBe(1);
      expect(source.items[0].nested!.transformer.size.value).toBe(2);
      expect(source.items[1].transformer.size.value).toBe(3);
    });

    it("should support batch updates in one call", () => {
      const source = {
        items: [
          {
            id: 1,
            type: "Premium",
            transformer: { size: { value: 1 } },
            nested: {
              transformer: { size: { value: 2 } },
            },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .setAll([
          { path: "transformer.size.value", value: 111 },
          { path: "type", value: "VIP" },
        ])
        .all();

      expect(result[0].transformer.size.value).toBe(111);
      expect(result[0].nested.transformer.size.value).toBe(111);
      expect(result[0].type).toBe("VIP");
      expect(source.items[0].transformer.size.value).toBe(1);
      expect(source.items[0].nested!.transformer.size.value).toBe(2);
      expect(source.items[0].type).toBe("Premium");
    });

    it("should support top-level scope for batch updates", () => {
      const source = {
        items: [
          {
            type: "Premium",
            nested: { type: "Inner" },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .setAll([{ path: "type", value: "VIP" }], { scope: "top-level" })
        .all();

      expect(result[0].type).toBe("VIP");
      expect(result[0].nested.type).toBe("Inner");
      expect(source.items[0].type).toBe("Premium");
    });
  });

  describe(".setEach()", () => {
    it("should return one updated item per matched occurrence", () => {
      const source = {
        items: [
          {
            id: 1,
            transformer: { size: { value: 1 } },
            nested: { transformer: { size: { value: 2 } } },
          },
        ],
      };

      const variants = query(source)
        .array("items")
        .setEach("transformer.size.value", 9)
        .all();

      expect(variants).toHaveLength(2);
      expect(variants[0].transformer.size.value).toBe(9);
      expect(variants[0].nested.transformer.size.value).toBe(2);
      expect(variants[1].transformer.size.value).toBe(1);
      expect(variants[1].nested.transformer.size.value).toBe(9);
      expect(source.items[0].transformer.size.value).toBe(1);
      expect(source.items[0].nested.transformer.size.value).toBe(2);
    });

    it("should throw when there are no matches", () => {
      const source = {
        items: [{ id: 1, type: "Premium" }],
      };

      expect(() =>
        query(source).array("items").setEach("transformer.size.value", 9).all(),
      ).toThrow(
        'setEach() found no matches for path "transformer.size.value".',
      );
      expect(source.items[0].type).toBe("Premium");
    });
  });

  describe(".set()", () => {
    it("should set top-level keys only and keep nested values unchanged", () => {
      const source = {
        items: [
          {
            id: 1,
            type: "Premium",
            nested: { type: "Inner" },
          },
        ],
      };

      const result = query(source).array("items").set("type", "VIP").all();

      expect(result[0].type).toBe("VIP");
      expect(result[0].nested.type).toBe("Inner");
      expect(source.items[0].type).toBe("Premium");
      expect(source.items[0].nested.type).toBe("Inner");
    });

    it("should support one top-level update in one call", () => {
      const source = {
        items: [
          {
            id: 1,
            type: "Premium",
            status: "old",
          },
        ],
      };

      const result = query(source).array("items").set("type", "VIP").all();

      expect(result[0].type).toBe("VIP");
      expect(result[0].status).toBe("old");
      expect(source.items[0].type).toBe("Premium");
      expect(source.items[0].status).toBe("old");
    });

    it("should support deep scope for a single path rule", () => {
      const source = {
        items: [
          {
            transformer: { size: { value: 1 } },
            nested: { transformer: { size: { value: 2 } } },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .set("transformer.size.value", 222, { scope: "deep" })
        .all();

      expect(result[0].transformer.size.value).toBe(222);
      expect(result[0].nested.transformer.size.value).toBe(222);
      expect(source.items[0].transformer.size.value).toBe(1);
      expect(source.items[0].nested.transformer.size.value).toBe(2);
    });

    it("should throw when set() receives nested paths", () => {
      const source = {
        items: [{ id: 1, nested: { value: 1 } }],
      };

      expect(() =>
        query(source).array("items").set("nested.value", 2).all(),
      ).toThrow("set() only supports top-level keys");
    });
  });

  describe(".setOne()", () => {
    it("should throw by default when deep path has multiple matches", () => {
      const source = {
        items: [
          {
            a: { value: 1 },
            b: { value: 2 },
          },
        ],
      };

      expect(() =>
        query(source).array("items").setOne("value", 9).all(),
      ).toThrow("setOne() found 2 matches");
    });

    it("should update only first deep match when onMultiple is first", () => {
      const source = {
        items: [
          {
            a: { value: 1 },
            b: { value: 2 },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .setOne("value", 9, { onMultiple: "first" })
        .all();

      expect(result[0].a.value).toBe(9);
      expect(result[0].b.value).toBe(2);
      expect(source.items[0].a.value).toBe(1);
      expect(source.items[0].b.value).toBe(2);
    });

    it("should support top-level scope", () => {
      const source = {
        items: [
          {
            type: "Premium",
            nested: { type: "Inner" },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .setOne("type", "VIP", { scope: "top-level" })
        .all();

      expect(result[0].type).toBe("VIP");
      expect(result[0].nested.type).toBe("Inner");
    });
  });

  describe(".replaceValue()", () => {
    it("should replace deep true values regardless of key", () => {
      const source = {
        items: [
          {
            id: 1,
            active: true,
            nested: { enabled: true, meta: { flag: false } },
            tags: ["x", true],
          },
        ],
      };

      const result = query(source).array("items").replaceValue(true, "Y").all();

      expect(result[0].active).toBe("Y");
      expect(result[0].nested.enabled).toBe("Y");
      expect(result[0].nested.meta.flag).toBe(false);
      expect(result[0].tags).toEqual(["x", "Y"]);
      expect(source.items[0].active).toBe(true);
      expect(source.items[0].nested.enabled).toBe(true);
      expect(source.items[0].tags).toEqual(["x", true]);
    });

    it("should replace only top-level values when scope is top-level", () => {
      const source = {
        items: [
          {
            id: 1,
            active: true,
            nested: { enabled: true },
            tags: ["x", true],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceValue(true, false, { scope: "top-level" })
        .all();

      expect(result[0].active).toBe(false);
      expect(result[0].nested.enabled).toBe(true);
      expect(result[0].tags).toEqual(["x", true]);
    });

    it("should remain chainable after replaceValue", () => {
      const source = {
        items: [
          { id: 1, active: true, status: "open" },
          { id: 2, active: false, status: "open" },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceValue(true, "Y")
        .where("active")
        .equals("Y")
        .where("status")
        .equals("open")
        .all();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].active).toBe("Y");
    });

    it("should replace only included keys when keySelection mode is include", () => {
      const source = {
        items: [
          {
            active: true,
            enabled: true,
            nested: { enabled: true, active: true },
            tags: [true],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceValue(true, "Y", {
          keySelection: { mode: "include", keys: ["enabled"] },
        })
        .all();

      expect(result[0].enabled).toBe("Y");
      expect(result[0].nested.enabled).toBe("Y");
      expect(result[0].active).toBe(true);
      expect(result[0].nested.active).toBe(true);
      expect(result[0].tags).toEqual([true]);
    });

    it("should skip excluded keys when keySelection mode is exclude", () => {
      const source = {
        items: [
          {
            active: true,
            enabled: true,
            nested: { enabled: true, active: true },
            tags: [true],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceValue(true, "Y", {
          keySelection: { mode: "exclude", keys: ["active"] },
        })
        .all();

      expect(result[0].enabled).toBe("Y");
      expect(result[0].nested.enabled).toBe("Y");
      expect(result[0].active).toBe(true);
      expect(result[0].nested.active).toBe(true);
      expect(result[0].tags).toEqual(["Y"]);
    });

    it("should throw when keySelection has no keys", () => {
      const source = {
        items: [{ active: true }],
      };

      expect(() =>
        query(source)
          .array("items")
          .replaceValue(true, "Y", {
            keySelection: { mode: "include", keys: [] },
          })
          .all(),
      ).toThrow(
        "replaceValue() keySelection.keys must include at least one key",
      );
    });

    it("should apply ordered multi-rule replacement", () => {
      const source = {
        items: [
          {
            enabled: true,
            active: false,
            nested: { enabled: true, active: false },
            tags: [true, false],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceMany([
          { from: false, to: "N" },
          { from: true, to: "Y" },
        ])
        .all();

      expect(result[0].enabled).toBe("Y");
      expect(result[0].active).toBe("N");
      expect(result[0].nested.enabled).toBe("Y");
      expect(result[0].nested.active).toBe("N");
      expect(result[0].tags).toEqual(["Y", "N"]);
    });

    it("should apply global keySelection for all rules in replaceMany", () => {
      const source = {
        items: [
          {
            enabled: true,
            active: false,
            nested: { enabled: true, active: false },
            tags: [true, false],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .replaceMany(
          [
            { from: false, to: "N" },
            { from: true, to: "Y" },
          ],
          {
            keySelection: { mode: "include", keys: ["enabled"] },
          },
        )
        .all();

      expect(result[0].enabled).toBe("Y");
      expect(result[0].nested.enabled).toBe("Y");
      expect(result[0].active).toBe(false);
      expect(result[0].nested.active).toBe(false);
      expect(result[0].tags).toEqual([true, false]);
    });

    it("should support toRoot() for write-back then diff", () => {
      const json1 = {
        payload: {
          items: [
            { id: 2, enabled: false },
            { id: 1, enabled: true },
          ],
        },
      };

      const json2 = {
        payload: {
          items: [
            { id: 1, enabled: "Y" },
            { id: 2, enabled: "N" },
          ],
        },
      };

      const result = query(json1)
        .array("payload.items")
        .sort("id", { direction: "asc" })
        .replaceMany([
          { from: false, to: "N" },
          { from: true, to: "Y" },
        ])
        .toRoot()
        .diff(json2);

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
    });

    it("should support toRoot(path) explicit write-back target", () => {
      const source = {
        payload: {
          raw: [{ id: 3 }, { id: 1 }, { id: 2 }],
          normalized: [],
        },
      };

      const updated = query(source)
        .array("payload.raw")
        .sort("id", { direction: "asc" })
        .toRoot("payload.normalized")
        .unwrap() as typeof source;

      expect(updated.payload.raw).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
      expect(updated.payload.normalized).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });
  });

  describe(".diff()", () => {
    it("should return equal=true with empty mismatches for identical rows", () => {
      const source = {
        items: [{ id: 1, profile: { name: "Alice" }, tags: ["a", "b"] }],
      };

      const result = query(source)
        .array("items")
        .diff({ id: 1, profile: { name: "Alice" }, tags: ["a", "b"] });

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
      expect(result.truncated).toBeUndefined();
    });

    it("should include itemIndex metadata for row mismatches", () => {
      const source = {
        items: [
          { id: 1, profile: { name: "Alice" } },
          { id: 2, profile: { name: "Bob" } },
        ],
      };

      const result = query(source)
        .array("items")
        .diff({ id: 1, profile: { name: "Alice" } });

      expect(result.equal).toBe(false);
      expect(result.mismatches.some((m) => m.itemIndex === 1)).toBe(true);
    });

    it("should emit array-order-mismatch by default for same-content different-order arrays", () => {
      const source = {
        items: [{ values: [{ id: 1 }, { id: 2 }] }],
      };

      const result = query(source)
        .array("items")
        .diff({ values: [{ id: 2 }, { id: 1 }] });

      expect(result.equal).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].reason).toBe("array-order-mismatch");
      expect(result.mismatches[0].path).toBe("values");
    });

    it("should support unorderedArrays=true", () => {
      const source = {
        items: [{ values: [{ id: 1 }, { id: 2 }] }],
      };

      const result = query(source)
        .array("items")
        .diff({ values: [{ id: 2 }, { id: 1 }] }, { unorderedArrays: true });

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
    });

    it("should support wildcard scoped unorderedArrays patterns", () => {
      const source = {
        items: [
          {
            sections: {
              a: { items: [{ id: 1 }, { id: 2 }] },
            },
            stable: [{ id: 1 }, { id: 2 }],
          },
        ],
      };

      const result = query(source)
        .array("items")
        .diff(
          {
            sections: {
              a: { items: [{ id: 2 }, { id: 1 }] },
            },
            stable: [{ id: 2 }, { id: 1 }],
          },
          { unorderedArrays: ["sections.*.items"] },
        );

      expect(result.equal).toBe(false);
      expect(
        result.mismatches.some(
          (m) => m.path === "stable" && m.reason === "array-order-mismatch",
        ),
      ).toBe(true);
      expect(
        result.mismatches.some(
          (m) =>
            m.path === "sections.a.items" &&
            m.reason === "array-order-mismatch",
        ),
      ).toBe(false);
    });

    it("should enforce maxMismatches and set truncated", () => {
      const source = {
        items: [
          { id: 1, x: 1 },
          { id: 2, x: 2 },
          { id: 3, x: 3 },
        ],
      };

      const result = query(source)
        .array("items")
        .diff({ id: 0, x: 0 }, { maxMismatches: 2 });

      expect(result.equal).toBe(false);
      expect(result.mismatches.length).toBe(2);
      expect(result.truncated).toBe(true);
    });

    it("should ignore exact paths via ignorePaths", () => {
      const source = {
        items: [
          {
            id: 1,
            meta: { updatedAt: "2026-03-01T00:00:00Z", stable: "ok" },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .diff(
          {
            id: 1,
            meta: { updatedAt: "2026-03-02T00:00:00Z", stable: "ok" },
          },
          { ignorePaths: ["meta.updatedAt"] },
        );

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
    });

    it("should ignore deep wildcard paths via ignorePaths", () => {
      const source = {
        items: [
          {
            section: {
              meter: {
                panel: {
                  updatedAt: "2026-03-01T00:00:00Z",
                },
              },
              status: "active",
            },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .diff(
          {
            section: {
              meter: {
                panel: {
                  updatedAt: "2026-03-05T00:00:00Z",
                },
              },
              status: "active",
            },
          },
          { ignorePaths: ["**.meter.panel.updatedAt"] },
        );

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
    });

    it("should ignore missing/extra key mismatches for ignored paths", () => {
      const source = {
        items: [
          {
            id: 1,
            meta: { updatedAt: "2026-03-01T00:00:00Z" },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .diff(
          {
            id: 1,
            meta: {},
          },
          { ignorePaths: ["meta.updatedAt"] },
        );

      expect(result.equal).toBe(true);
      expect(result.mismatches).toEqual([]);
    });
  });

  describe(".hasAll()", () => {
    it("should return true when a selected row matches all pairs at top level", () => {
      const source = {
        items: [
          { id: 1, type: "Premium", status: "active" },
          { id: 2, type: "Basic", status: "active" },
        ],
      };

      const result = query(source)
        .array("items")
        .hasAll({ type: "Premium", status: "active" });

      expect(result).toBe(true);
    });

    it("should return true when pairs are split across different nested objects in deep scope", () => {
      const source = {
        items: [
          {
            id: 1,
            a: { type: "Premium" },
            b: { status: "active" },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .hasAll({ type: "Premium", status: "active" }, { scope: "deep" });

      expect(result).toBe(true);
    });

    it("should support deep matching when criteria appears on the same descendant object", () => {
      const source = {
        items: [
          {
            id: 1,
            details: {
              profile: { type: "Premium", status: "active" },
            },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .hasAll({ type: "Premium", status: "active" }, { scope: "deep" });

      expect(result).toBe(true);
    });
  });

  describe(".has()", () => {
    it("should return true for top-level single key/value matches", () => {
      const source = {
        items: [
          { id: 1, type: "Premium", status: "active" },
          { id: 2, type: "Basic", status: "active" },
        ],
      };

      const result = query(source).array("items").has("type", "Premium");

      expect(result).toBe(true);
    });

    it("should support deep scope for single key/value matches", () => {
      const source = {
        items: [
          {
            id: 1,
            details: {
              profile: { type: "Premium" },
            },
          },
        ],
      };

      const result = query(source)
        .array("items")
        .has("type", "Premium", { scope: "deep" });

      expect(result).toBe(true);
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

    it("should support aggregate() decimals options and primitive-array pathless summaries", () => {
      const primitives = { prices: [9.99, 10.01, 14.5] };
      const primitiveStats = query(primitives)
        .array("prices")
        .aggregate()
        .sum("", { decimals: 2 })
        .average("", { decimals: 2 })
        .all();

      expect(primitiveStats).toEqual({
        sum: 34.5,
        average: 11.5,
      });

      const items = {
        items: [
          { price: 10.019, qty: 2.111 },
          { price: 3.333, qty: 3.777 },
        ],
      };

      const productStats = query(items)
        .array("items")
        .aggregate()
        .sumOfProducts("price", "qty", { decimals: 2 })
        .all();

      expect(productStats).toEqual({
        sumOfProducts: 33.74,
      });
    });

    it("should coerce numeric-string values in aggregate sum/average by default", () => {
      const stats = query({
        items: [{ price: "100" }, { price: "50.5" }, { price: 24.5 }],
      })
        .array("items")
        .aggregate()
        .sum("price")
        .average("price")
        .all();

      expect(stats.sum).toBe(175);
      expect(stats.average).toBeCloseTo(58.333333333333336, 12);
    });

    it("should allow disabling numeric-string coercion in aggregate sum/average", () => {
      const stats = query({
        items: [{ price: "100" }, { price: "50" }, { price: 25 }],
      })
        .array("items")
        .aggregate()
        .sum("price", { coerceNumericStrings: false })
        .average("price", { coerceNumericStrings: false })
        .all();

      expect(stats.sum).toBe(25);
      expect(stats.average).toBeCloseTo(8.333333333333334, 12);
    });

    it("should validate decimals options in aggregate() helper", () => {
      expect(() =>
        query(testData)
          .array("items")
          .aggregate()
          .sum("price", { decimals: -1 }),
      ).toThrow("sum() options.decimals expects an integer between 0 and 100.");

      expect(() =>
        query(testData)
          .array("items")
          .aggregate()
          .average("price", { decimals: 1.5 }),
      ).toThrow(
        "average() options.decimals expects an integer between 0 and 100.",
      );

      expect(() =>
        query(testData)
          .array("items")
          .aggregate()
          .sumOfProducts("id", "price", { decimals: 101 }),
      ).toThrow(
        "sumOfProducts() options.decimals expects an integer between 0 and 100.",
      );
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

    it("should support root sortAt() for in-place write-back at path", () => {
      const root = {
        payload: {
          raw: [{ id: 3 }, { id: 1 }, { id: 2 }],
          normalized: [],
        },
      };

      const updated = query(root)
        .sortAt("payload.raw", "id", { direction: "asc" })
        .unwrap() as typeof root;

      expect(updated.payload.raw).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(root.payload.raw).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
      expect(updated.payload.normalized).toEqual([]);
    });

    it("should throw when sortAt() path is not an array", () => {
      const root = {
        payload: {
          raw: { id: 1 },
        },
      };

      expect(() => query(root).sortAt("payload.raw", "id")).toThrow(
        'Expected array at path "payload.raw", but found object.',
      );
    });

    it("should support root sortAt() nulls option forwarding", () => {
      const root = {
        payload: {
          raw: [{ id: 3 }, { id: null }, { id: 1 }],
        },
      };

      const updated = query(root)
        .sortAt("payload.raw", "id", { direction: "asc", nulls: "first" })
        .unwrap() as typeof root;

      expect(updated.payload.raw).toEqual([{ id: null }, { id: 1 }, { id: 3 }]);
      expect(root.payload.raw).toEqual([{ id: 3 }, { id: null }, { id: 1 }]);
    });

    it("should support root unset() and unsetAll() with missing-path options", () => {
      const root = {
        payload: {
          user: { id: 1, name: "Ada", ssn: "111" },
          items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        },
      };

      const updated = query(root)
        .unset("payload.user.ssn")
        .unset("payload.items[1]")
        .unsetAll(["payload.user.missing", "payload.missing"], {
          onMissing: "ignore",
        })
        .unwrap() as typeof root;

      expect(updated.payload.user).toEqual({ id: 1, name: "Ada" });
      expect(updated.payload.items).toEqual([{ id: 1 }, { id: 3 }]);

      expect(() =>
        query(root).unset("payload.user.missing", { onMissing: "throw" }),
      ).toThrow(
        'Path "payload.user.missing" does not exist: property "missing" not found.',
      );
    });

    it("should support root filterAt() family", () => {
      const root = {
        payload: {
          items: [
            { id: 1, type: "Premium", price: 120 },
            { id: 2, type: "Basic", price: 40 },
            { id: 3, type: "Premium", price: 90 },
          ],
        },
      };

      const filtered = query(root)
        .filterAt("payload.items", "type == 'Premium' and price >= 100")
        .unwrap() as typeof root;

      expect(filtered.payload.items).toEqual([
        { id: 1, type: "Premium", price: 120 },
      ]);

      const minPrice: number | undefined = undefined;
      const gated = query(root)
        .filterAtIfDefined("payload.items", "price >= $min", minPrice)
        .unwrap() as typeof root;
      expect(gated.payload.items).toEqual(root.payload.items);

      const allDefined = query(root)
        .filterAtIfAllDefined(
          "payload.items",
          "price >= $min and price <= $max",
          { min: 80, max: 120 },
        )
        .unwrap() as typeof root;
      expect(allDefined.payload.items.map((i) => i.id)).toEqual([1, 3]);
    });

    it("should support root omitAt() and pickAt()", () => {
      const root = {
        payload: {
          user: { id: 1, name: "Ada", email: "a@x.com", role: "admin" },
        },
      };

      const omitted = query(root)
        .omitAt("payload.user", ["email", "role"])
        .unwrap() as typeof root;
      expect(omitted.payload.user).toEqual({ id: 1, name: "Ada" });

      const picked = query(root)
        .pickAt("payload.user", ["id", "name"])
        .unwrap() as typeof root;
      expect(picked.payload.user).toEqual({ id: 1, name: "Ada" });
    });

    it("should support root compactAt()", () => {
      const root = {
        payload: {
          values: [1, null, 2, undefined, 3],
        },
      };

      const updated = query(root)
        .compactAt("payload.values")
        .unwrap() as typeof root;
      expect(updated.payload.values).toEqual([1, 2, 3]);
    });

    it("should support root objectGroupsAt() and renameAt()/transformAt()", () => {
      const root = {
        sections: {
          a: { status: "active", score: 10, private: true },
          b: { status: "archived", score: 20, private: true },
        },
        payload: {
          user: { first_name: "Ada", age: 30 },
          values: [1, 2, 3],
        },
      };

      const transformedGroups = query(root)
        .objectGroupsAt("sections", (groups) =>
          groups.where("status").equals("active").omit(["private"]),
        )
        .unwrap() as typeof root;
      expect(transformedGroups.sections).toEqual({
        a: { status: "active", score: 10 },
      });

      const renamed = query(root)
        .renameAt("payload.user", "first_name", "firstName")
        .unwrap() as typeof root;
      expect(renamed.payload.user).toEqual({ firstName: "Ada", age: 30 });

      const transformed = query(root)
        .transformAt<number[]>("payload.values", (values) =>
          values.map((v) => v * 2),
        )
        .unwrap() as typeof root;
      expect(transformed.payload.values).toEqual([2, 4, 6]);
    });

    it("should support root setAll() immutably", () => {
      const root = {
        sections: {
          a: {
            transformer: { size: { value: 1 } },
            nested: { transformer: { size: { value: 2 } } },
          },
          b: {
            transformer: { size: { value: 3 } },
          },
        },
      };

      const updated = query(root)
        .setAll([{ path: "transformer.size.value", value: 77 }])
        .unwrap() as typeof root;

      expect(updated.sections.a.transformer.size.value).toBe(77);
      expect(updated.sections.a.nested.transformer.size.value).toBe(77);
      expect(updated.sections.b.transformer.size.value).toBe(77);
      expect(root.sections.a.transformer.size.value).toBe(1);
      expect(root.sections.a.nested.transformer.size.value).toBe(2);
      expect(root.sections.b.transformer.size.value).toBe(3);
    });

    it("should support root set() for top-level keys", () => {
      const root = {
        status: "old",
        sections: {
          a: { status: "nested" },
        },
      };

      const updated = query(root).set("status", "new").unwrap() as typeof root;

      expect(updated.status).toBe("new");
      expect(updated.sections.a.status).toBe("nested");
      expect(root.status).toBe("old");
    });

    it("should support root set() for one top-level key", () => {
      const root = {
        status: "old",
        flag: false,
      };

      const updated = query(root).set("status", "new").unwrap() as typeof root;

      expect(updated.status).toBe("new");
      expect(updated.flag).toBe(false);
      expect(root.status).toBe("old");
      expect(root.flag).toBe(false);
    });

    it("should support root setOne() deep first mode", () => {
      const root = {
        a: { value: 1 },
        b: { value: 2 },
      };

      const updated = query(root)
        .setOne("value", 7, { onMultiple: "first" })
        .unwrap() as typeof root;

      expect(updated.a.value).toBe(7);
      expect(updated.b.value).toBe(2);
      expect(root.a.value).toBe(1);
    });

    it("should throw on root setOne() deep default when multiple", () => {
      const root = {
        a: { value: 1 },
        b: { value: 2 },
      };

      expect(() => query(root).setOne("value", 7).unwrap()).toThrow(
        "setOne() found 2 matches",
      );
    });

    it("should support root setAll() batch updates", () => {
      const root = {
        sections: {
          a: {
            transformer: { size: { value: 1 } },
          },
        },
        status: "old",
      };

      const updated = query(root)
        .setAll([
          { path: "transformer.size.value", value: 88 },
          { path: "status", value: "new" },
        ])
        .unwrap() as typeof root;

      expect(updated.sections.a.transformer.size.value).toBe(88);
      expect(updated.status).toBe("new");
      expect(root.sections.a.transformer.size.value).toBe(1);
      expect(root.status).toBe("old");
    });

    it("should support root setEach() one-by-one variants", () => {
      const root = {
        sections: {
          a: {
            transformer: { size: { value: 1 } },
            nested: { transformer: { size: { value: 2 } } },
          },
        },
      };

      const variants = query(root).setEach("transformer.size.value", 55).all();

      expect(variants).toHaveLength(2);
      expect(variants[0].sections.a.transformer.size.value).toBe(55);
      expect(variants[0].sections.a.nested.transformer.size.value).toBe(2);
      expect(variants[1].sections.a.transformer.size.value).toBe(1);
      expect(variants[1].sections.a.nested.transformer.size.value).toBe(55);
      expect(root.sections.a.transformer.size.value).toBe(1);
      expect(root.sections.a.nested.transformer.size.value).toBe(2);
    });

    it("should support root replaceValue()", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            nested: { enabled: true },
          },
        },
      };

      const updated = query(root)
        .replaceValue(true, "Y")
        .unwrap() as typeof root;

      expect(updated.sections.a.enabled).toBe("Y");
      expect(updated.sections.a.nested.enabled).toBe("Y");
      expect(root.sections.a.enabled).toBe(true);
      expect(root.sections.a.nested.enabled).toBe(true);
    });

    it("should support root replaceValue() with keySelection", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            active: true,
            nested: { enabled: true, active: true },
          },
        },
      };

      const updated = query(root)
        .replaceValue(true, "Y", {
          keySelection: { mode: "include", keys: ["enabled"] },
        })
        .unwrap() as typeof root;

      expect(updated.sections.a.enabled).toBe("Y");
      expect(updated.sections.a.nested.enabled).toBe("Y");
      expect(updated.sections.a.active).toBe(true);
      expect(updated.sections.a.nested.active).toBe(true);
    });

    it("should support root replaceValueAt() for targeted subtree replacement", () => {
      const root = {
        payload: {
          settings: {
            enabled: true,
            nested: { enabled: true, active: false },
          },
          untouched: { enabled: true },
        },
      };

      const updated = query(root)
        .replaceValueAt("payload.settings", true, "Y")
        .unwrap() as typeof root;

      expect(updated.payload.settings.enabled).toBe("Y");
      expect(updated.payload.settings.nested.enabled).toBe("Y");
      expect(updated.payload.settings.nested.active).toBe(false);
      expect(updated.payload.untouched.enabled).toBe(true);
      expect(root.payload.settings.enabled).toBe(true);
      expect(root.payload.settings.nested.enabled).toBe(true);
    });

    it("should support root replaceManyAt() for targeted subtree replacement", () => {
      const root = {
        payload: {
          settings: {
            enabled: true,
            active: false,
            nested: { enabled: true, active: false },
          },
          untouched: { enabled: true, active: false },
        },
      };

      const updated = query(root)
        .replaceManyAt("payload.settings", [
          { from: false, to: "N" },
          { from: true, to: "Y" },
        ])
        .unwrap() as typeof root;

      expect(updated.payload.settings.enabled).toBe("Y");
      expect(updated.payload.settings.active).toBe("N");
      expect(updated.payload.settings.nested.enabled).toBe("Y");
      expect(updated.payload.settings.nested.active).toBe("N");
      expect(updated.payload.untouched.enabled).toBe(true);
      expect(updated.payload.untouched.active).toBe(false);
      expect(root.payload.settings.enabled).toBe(true);
      expect(root.payload.settings.active).toBe(false);
    });

    it("should support root replaceMany()", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            active: false,
            nested: { enabled: true, active: false },
          },
        },
      };

      const updated = query(root)
        .replaceMany([
          { from: false, to: "N" },
          { from: true, to: "Y" },
        ])
        .unwrap() as typeof root;

      expect(updated.sections.a.enabled).toBe("Y");
      expect(updated.sections.a.active).toBe("N");
      expect(updated.sections.a.nested.enabled).toBe("Y");
      expect(updated.sections.a.nested.active).toBe("N");
      expect(root.sections.a.enabled).toBe(true);
      expect(root.sections.a.active).toBe(false);
    });

    it("should support root find()", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
        },
      };

      expect(query(root).find<number>("id").all()).toEqual([1, 2, 3]);
    });

    it("should support root diff()", () => {
      const root = {
        sections: {
          a: { value: 1 },
        },
      };

      const result = query(root).diff({
        sections: {
          a: { value: 2 },
        },
      });

      expect(result.equal).toBe(false);
      expect(result.mismatches.some((m) => m.path === "sections.a.value")).toBe(
        true,
      );
    });

    it("should support root hasAll()", () => {
      const root = {
        sections: {
          a: {
            profile: { type: "Premium", status: "active" },
          },
        },
      };

      expect(
        query(root).hasAll(
          { type: "Premium", status: "active" },
          { scope: "deep" },
        ),
      ).toBe(true);
      expect(query(root).hasAll({ type: "Premium" })).toBe(false);
      expect(query(root).has("type", "Premium", { scope: "deep" })).toBe(true);
    });

    it("should support root find() with scope=top-level", () => {
      const root = {
        id: 99,
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
        },
      };

      expect(
        query(root).find<number>("id", { scope: "top-level" }).all(),
      ).toEqual([99]);
    });

    it("should support objectGroups() include/exclude and flatArray()", () => {
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
        .flatArray<{ id: number }>("items")
        .pluck("id")
        .all();

      expect(result).toEqual([1, 2]);
    });

    it("should support objectGroups() include()/exclude() with single string keys", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
          c: { items: [{ id: 4 }] },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .include("a")
        .exclude("c")
        .flatArray<{ id: number }>("items")
        .pluck("id")
        .all();

      expect(result).toEqual([1, 2]);
    });

    it("should support objectGroups().arrays() as an alias of flatArray()", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .arrays<{ id: number }>("items")
        .pluck("id")
        .all();

      expect(result).toEqual([1, 2, 3]);
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

    it("should support objectGroups().where() and whereNot() builders", () => {
      const root = {
        sections: {
          a: { type: "Premium", priority: 3 },
          b: { type: "Basic", priority: 1 },
          c: { type: "Premium", priority: 2 },
        },
      };

      const filtered = query(root)
        .objectGroups("sections")
        .where("type")
        .equals("Premium")
        .whereNot("priority")
        .lessThan(3)
        .entries();

      expect(filtered).toEqual([["a", { type: "Premium", priority: 3 }]]);
    });

    it("should support objectGroups().where().equals() on numeric strings", () => {
      const root = {
        sections: {
          a: { price: "150.00" },
          b: { price: 100 },
          c: { price: "100" },
          d: { price: null },
        },
      };

      const filtered = query(root)
        .objectGroups("sections")
        .where("price")
        .equals(100)
        .entries();

      expect(filtered).toHaveLength(2); // b and c
      expect(filtered.map((e) => e[0])).toEqual(["b", "c"]);
    });

    it("should support objectGroups() numeric comparisons on numeric strings", () => {
      const root = {
        sections: {
          a: { price: "150.0000" },
          b: { price: "80.0000" },
          c: { price: null },
        },
      };

      const filtered = query(root)
        .objectGroups("sections")
        .where("price")
        .greaterThan(100)
        .entries();

      expect(filtered).toEqual([["a", { price: "150.0000" }]]);
    });

    it("should throw for objectGroups() nullish numeric values when nullAsZero is disabled", () => {
      const root = {
        sections: {
          a: { price: null },
        },
      };

      expect(() =>
        query(root)
          .objectGroups("sections")
          .where("price")
          .greaterThan(100, { nullAsZero: false })
          .entries(),
      ).toThrow("Pass { nullAsZero: true }");
    });

    it("should support objectGroups().whereIn(), whereNotIn(), whereAll(), whereAny(), whereNone()", () => {
      const root = {
        sections: {
          a: { type: "Premium", status: "active", priority: 3 },
          b: { type: "Basic", status: "active", priority: 1 },
          c: { type: "Premium", status: "archived", priority: 2 },
        },
      };

      const groups = query(root).objectGroups("sections");

      expect(
        groups
          .whereIn("type", ["Premium"])
          .entries()
          .map(([key]) => key),
      ).toEqual(["a", "c"]);

      expect(
        groups
          .whereNotIn("status", ["archived"])
          .entries()
          .map(([key]) => key),
      ).toEqual(["a", "b"]);

      expect(
        groups
          .whereAll({ type: "Premium", status: "active" })
          .entries()
          .map(([key]) => key),
      ).toEqual(["a"]);

      expect(
        groups
          .whereAny({ type: "Basic", priority: 2 })
          .entries()
          .map(([key]) => key),
      ).toEqual(["b", "c"]);

      expect(
        groups
          .whereNone({ status: "archived", priority: 1 })
          .entries()
          .map(([key]) => key),
      ).toEqual(["a"]);

      expect(() => groups.whereIn("type", [])).toThrow(
        'whereIn("type") requires a non-empty array of values.',
      );
      expect(() => groups.whereNotIn("type", [])).toThrow(
        'whereNotIn("type") requires a non-empty array of values.',
      );
      expect(() => groups.whereAny({})).toThrow(
        "whereAny() requires at least one criterion.",
      );
      expect(() => groups.whereNone({})).toThrow(
        "whereNone() requires at least one criterion.",
      );
    });

    it("should support objectGroups().filter() and filterIfDefined()", () => {
      const root = {
        sections: {
          a: { type: "Premium", priority: 3 },
          b: { type: "Basic", priority: 1 },
          c: { type: "Premium", priority: 2 },
        },
      };

      const groups = query(root).objectGroups("sections");

      expect(
        groups
          .filter("type == 'Premium' and priority >= 2")
          .entries()
          .map(([key]) => key),
      ).toEqual(["a", "c"]);

      expect(
        groups
          .filterIfDefined("priority >= $min", 3)
          .entries()
          .map(([key]) => key),
      ).toEqual(["a"]);

      expect(groups.filterIfDefined("priority >= $min", undefined)).toBe(
        groups,
      );
    });

    it("should support objectGroups().sort() for ordered entries and values", () => {
      const root = {
        sections: {
          a: { type: "Premium", priority: 3 },
          b: { type: "Basic", priority: 1 },
          c: { type: "Premium", priority: 2 },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b", "c"])
        .sort("priority", { direction: "desc" });

      expect(groups.entries().map(([key]) => key)).toEqual(["a", "c", "b"]);
      expect(
        (groups.values() as Array<{ priority: number }>).map((v) => v.priority),
      ).toEqual([3, 2, 1]);
    });

    it("should support objectGroups().sort() by value when path is omitted", () => {
      const root = {
        sections: {
          a: 3,
          b: 1,
          c: 2,
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .sort(undefined, { direction: "desc" });

      expect(groups.entries().map(([key]) => key)).toEqual(["a", "c", "b"]);
      expect(groups.values()).toEqual([3, 2, 1]);
    });

    it("should support objectGroups().sort() nulls option", () => {
      const root = {
        sections: {
          a: 3,
          b: null,
          c: 1,
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .sort(undefined, { direction: "asc", nulls: "first" });

      expect(groups.entries().map(([key]) => key)).toEqual(["b", "c", "a"]);
      expect(groups.values()).toEqual([null, 1, 3]);
    });

    it("should support objectGroups().pick() and keep chaining before terminal", () => {
      const root = {
        sections: {
          a: { type: "Premium", priority: 3, meta: { owner: "u1" } },
          b: { type: "Basic", priority: 1, meta: { owner: "u2" } },
          c: { type: "Premium", priority: 2, meta: { owner: "u3" } },
        },
      };

      const entries = query(root)
        .objectGroups("sections")
        .where("type")
        .equals("Premium")
        .pick({ p: "priority", owner: "meta.owner" })
        .sort("p", { direction: "desc" })
        .entries();

      expect(entries).toEqual([
        ["a", { p: 3, owner: "u1" }],
        ["c", { p: 2, owner: "u3" }],
      ]);
    });

    it("should support objectGroups().omit() and compact()", () => {
      const root = {
        sections: {
          a: { type: "Premium", score: 3, note: null },
          b: { type: "Basic", score: 1, note: undefined },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .omit(["score"])
        .compact();

      expect(groups.entries()).toEqual([
        ["a", { type: "Premium" }],
        ["b", { type: "Basic" }],
      ]);
    });

    it("should support objectGroups().setAll() and preserve include/exclude state", () => {
      const root = {
        sections: {
          a: {
            items: [
              {
                transformer: { size: { value: 1 } },
                nested: { transformer: { size: { value: 2 } } },
              },
            ],
          },
          b: {
            items: [{ transformer: { size: { value: 3 } } }],
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .setAll([{ path: "transformer.size.value", value: 500 }]);

      const values = groups
        .arrays<{
          transformer: { size: { value: number } };
          nested?: any;
        }>("items")
        .pluck("transformer.size.value")
        .all();

      expect(groups.entries()).toHaveLength(1);
      expect(values).toEqual([500]);
      expect(root.sections.a.items[0].transformer.size.value).toBe(1);
      expect(root.sections.a.items[0].nested.transformer.size.value).toBe(2);
      expect(root.sections.b.items[0].transformer.size.value).toBe(3);
    });

    it("should support objectGroups().set() for top-level keys", () => {
      const root = {
        sections: {
          a: {
            status: "old",
            items: [{ status: "nested" }],
          },
          b: {
            status: "old-b",
            items: [{ status: "nested-b" }],
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .set("status", "new");

      const values = groups.arrays<{ status: string }>("items").all();

      expect(groups.entries()).toHaveLength(1);
      expect(values[0].status).toBe("nested");
      expect(root.sections.a.status).toBe("old");
      expect(root.sections.a.items[0].status).toBe("nested");
      expect(root.sections.b.status).toBe("old-b");
    });

    it("should support objectGroups().setOne() deep first mode", () => {
      const root = {
        sections: {
          a: {
            x: { value: 1 },
            y: { value: 2 },
          },
          b: {
            x: { value: 3 },
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .setOne("value", 9, { onMultiple: "first" });

      const selected = groups.values() as Array<{
        x: { value: number };
        y: { value: number };
      }>;
      expect(selected[0].x.value).toBe(9);
      expect(selected[0].y.value).toBe(2);
      expect(root.sections.a.x.value).toBe(1);
      expect(root.sections.a.y.value).toBe(2);
      expect(root.sections.b.x.value).toBe(3);
    });

    it("should support objectGroups().setAll() batch updates", () => {
      const root = {
        sections: {
          a: {
            items: [{ transformer: { size: { value: 1 } }, type: "Premium" }],
          },
          b: {
            items: [{ transformer: { size: { value: 3 } }, type: "Basic" }],
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .setAll([
          { path: "transformer.size.value", value: 700 },
          { path: "type", value: "VIP" },
        ]);

      const values = groups
        .arrays<{
          transformer: { size: { value: number } };
          type: string;
        }>("items")
        .all();

      expect(groups.entries()).toHaveLength(1);
      expect(values[0].transformer.size.value).toBe(700);
      expect(values[0].type).toBe("VIP");
      expect(root.sections.a.items[0].transformer.size.value).toBe(1);
      expect(root.sections.a.items[0].type).toBe("Premium");
      expect(root.sections.b.items[0].transformer.size.value).toBe(3);
      expect(root.sections.b.items[0].type).toBe("Basic");
    });

    it("should support objectGroups().setEach() for selected groups", () => {
      const root = {
        sections: {
          a: {
            items: [
              {
                transformer: { size: { value: 1 } },
                nested: { transformer: { size: { value: 2 } } },
              },
            ],
          },
          b: {
            items: [{ transformer: { size: { value: 3 } } }],
          },
        },
      };

      const variants = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .setEach("transformer.size.value", 123)
        .all();

      expect(variants).toHaveLength(2);
      expect(variants[0].items[0].transformer.size.value).toBe(123);
      expect(variants[0].items[0].nested.transformer.size.value).toBe(2);
      expect(variants[1].items[0].transformer.size.value).toBe(1);
      expect(variants[1].items[0].nested.transformer.size.value).toBe(123);
      expect(root.sections.a.items[0].transformer.size.value).toBe(1);
      expect(root.sections.a.items[0].nested.transformer.size.value).toBe(2);
      expect(root.sections.b.items[0].transformer.size.value).toBe(3);
    });

    it("should block objectGroups().flatArray().toRoot() at type level and runtime", () => {
      const root = {
        sections: {
          a: {
            items: [{ type: "Premium" }],
          },
        },
      };

      const groupedItems = query(root)
        .objectGroups("sections")
        .flatArray("items");

      expect(() => (groupedItems as any).toRoot()).toThrow(
        "toRoot() is not supported for grouped arrays. Use JsonQueryRoot.setAll()/setOne() to write back explicitly.",
      );
    });

    it("should support objectGroups().replaceValue() with include/exclude", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            nested: { enabled: true },
          },
          b: {
            enabled: true,
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .replaceValue(true, false);

      const selected = groups.values() as Array<{
        enabled: boolean;
        nested?: { enabled: boolean };
      }>;

      expect(groups.entries()).toHaveLength(1);
      expect(selected[0].enabled).toBe(false);
      expect(selected[0].nested?.enabled).toBe(false);
      expect(root.sections.a.enabled).toBe(true);
      expect(root.sections.a.nested.enabled).toBe(true);
      expect(root.sections.b.enabled).toBe(true);
    });

    it("should support objectGroups().replaceValue() with keySelection", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            active: true,
            nested: { enabled: true, active: true },
          },
          b: {
            enabled: true,
            active: true,
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .replaceValue(true, "Y", {
          keySelection: { mode: "include", keys: ["enabled"] },
        });

      const selected = groups.values() as Array<{
        enabled: string;
        active: boolean;
        nested?: { enabled: string; active: boolean };
      }>;

      expect(groups.entries()).toHaveLength(1);
      expect(selected[0].enabled).toBe("Y");
      expect(selected[0].nested?.enabled).toBe("Y");
      expect(selected[0].active).toBe(true);
      expect(selected[0].nested?.active).toBe(true);
      expect(root.sections.a.enabled).toBe(true);
      expect(root.sections.a.nested.enabled).toBe(true);
      expect(root.sections.b.enabled).toBe(true);
    });

    it("should support objectGroups().replaceMany() with global keySelection", () => {
      const root = {
        sections: {
          a: {
            enabled: true,
            active: false,
            nested: { enabled: true, active: false },
          },
          b: {
            enabled: true,
            active: false,
          },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"])
        .replaceMany(
          [
            { from: false, to: "N" },
            { from: true, to: "Y" },
          ],
          {
            keySelection: { mode: "include", keys: ["enabled"] },
          },
        );

      const selected = groups.values() as Array<{
        enabled: string;
        active: boolean;
        nested?: { enabled: string; active: boolean };
      }>;

      expect(groups.entries()).toHaveLength(1);
      expect(selected[0].enabled).toBe("Y");
      expect(selected[0].nested?.enabled).toBe("Y");
      expect(selected[0].active).toBe(false);
      expect(selected[0].nested?.active).toBe(false);
      expect(root.sections.a.enabled).toBe(true);
      expect(root.sections.a.active).toBe(false);
      expect(root.sections.b.enabled).toBe(true);
      expect(root.sections.b.active).toBe(false);
    });

    it("should support objectGroups().find() with include/exclude", () => {
      const root = {
        sections: {
          a: { items: [{ id: 1 }, { id: 2 }] },
          b: { items: [{ id: 3 }] },
          c: { items: [{ id: 4 }] },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .include(["a", "b", "c"])
        .exclude(["b"])
        .find<number>("id")
        .all();

      expect(result).toEqual([1, 2, 4]);
    });

    it("should support objectGroups().diff() with groupKey metadata", () => {
      const root = {
        sections: {
          a: { value: 1 },
          b: { value: 2 },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .diff({ value: 1 });

      expect(result.equal).toBe(false);
      expect(result.mismatches.some((m) => m.groupKey === "b")).toBe(true);
    });

    it("should support objectGroups().hasAll() with include/exclude", () => {
      const root = {
        sections: {
          a: { profile: { type: "Premium", status: "active" } },
          b: { profile: { type: "Basic", status: "active" } },
        },
      };

      const groups = query(root)
        .objectGroups("sections")
        .include(["a", "b"])
        .exclude(["b"]);

      expect(
        groups.hasAll({ type: "Premium", status: "active" }, { scope: "deep" }),
      ).toBe(true);
      expect(groups.hasAll({ type: "Premium" })).toBe(false);
      expect(groups.has("type", "Premium", { scope: "deep" })).toBe(true);
    });

    it("should support objectGroups().find() with scope=top-level", () => {
      const root = {
        sections: {
          a: { id: 10, items: [{ id: 1 }, { id: 2 }] },
          b: { id: 20, items: [{ id: 3 }] },
          c: { id: 30, items: [{ id: 4 }] },
        },
      };

      const result = query(root)
        .objectGroups("sections")
        .include(["a", "b", "c"])
        .exclude(["b"])
        .find<number>("id", { scope: "top-level" })
        .all();

      expect(result).toEqual([10, 30]);
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
        query(root).objectGroups("sections").flatArray("notItems").all();
      }).toThrow('Expected array at path "notItems" in group "a".');
    });
  });

  describe("Additional branch coverage", () => {
    it("should support root pick string/array forms and unwrap()", () => {
      const root = { result: { status: "OK", id: 123 } };

      expect(query(root).pick("result.status")).toEqual({
        "result.status": "OK",
      });
      expect(query(root).pick(["result.status", "result.id"])).toEqual({
        "result.status": "OK",
        "result.id": 123,
      });
      expect(query(root).unwrap()).toBe(root);
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

    it("should cover find and randomWithPath empty error", () => {
      const data = {
        items: [
          { id: 1, nested: { value: "a" } },
          { id: 2, nested: { value: "b" } },
        ],
      };

      expect(query(data).array("items").find("id").all()).toEqual([1, 2]);
      expect(
        query(data)
          .array("items")
          .find("nested.value", { scope: "top-level" })
          .all(),
      ).toEqual(["a", "b"]);
      expect(() =>
        query(data).array("items").find("nested.value").all(),
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
      expect(() => pipe.find("id")).toThrow(
        "find() is only available on bound queries.",
      );
      const pickedPipe = pipe.pick("id");
      expect(pickedPipe).toBeDefined();
      expect(pickedPipe.run([{ id: 1 }, { id: 2 }]).all()).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
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
