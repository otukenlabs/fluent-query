import { arrayPipeline, query } from "../index";

interface Item {
  id: number;
  type: string;
  price: number;
  name: string;
  category?: string;
}

const datasetA: Item[] = [
  { id: 1, type: "Premium", price: 500, name: "Alpha" },
  { id: 2, type: "Basic", price: 50, name: "Beta" },
  { id: 3, type: "Premium", price: 300, name: "Gamma" },
  { id: 4, type: "Standard", price: 100, name: "Delta" },
  { id: 5, type: "Premium", price: 150, name: "Epsilon" },
];

const datasetB: Item[] = [
  { id: 10, type: "Premium", price: 800, name: "Zeta" },
  { id: 11, type: "Basic", price: 25, name: "Eta" },
  { id: 12, type: "Premium", price: 200, name: "Theta" },
];

// ── arrayPipeline (unbound mode) ────────────────────────────────────────

describe("arrayPipeline (unbound mode)", () => {
  describe("empty pipeline", () => {
    it("returns all items unchanged", () => {
      const pipe = arrayPipeline<Item>();
      const result = pipe.run(datasetA).all();
      expect(result).toEqual(datasetA);
    });
  });

  describe("single filter step", () => {
    it("applies a filter expression", () => {
      const pipe = arrayPipeline<Item>().filter("type == 'Premium'");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result.every((i) => i.type === "Premium")).toBe(true);
    });
  });

  describe("where().equals() chain", () => {
    it("records and replays a where-equals chain", () => {
      const pipe = arrayPipeline<Item>().where("type").equals("Premium");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(1);
    });
  });

  describe("where() with modifiers", () => {
    it("applies caseSensitive modifier", () => {
      const pipe = arrayPipeline<Item>()
        .where("type")
        .caseSensitive()
        .equals("premium");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(0);
    });

    it("applies not modifier", () => {
      const pipe = arrayPipeline<Item>().where("type").not().equals("Premium");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(2);
      expect(result.some((i) => i.type === "Premium")).toBe(false);
    });

    it("applies contains with ignoreCase", () => {
      const pipe = arrayPipeline<Item>()
        .where("name")
        .ignoreCase()
        .contains("alpha");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alpha");
    });
  });

  describe("whereNot().equals()", () => {
    it("excludes matching items", () => {
      const pipe = arrayPipeline<Item>().whereNot("type").equals("Basic");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(4);
      expect(result.every((i) => i.type !== "Basic")).toBe(true);
    });
  });

  describe("multiple chained where steps", () => {
    it("applies multiple where filters in sequence", () => {
      const pipe = arrayPipeline<Item>()
        .where("type")
        .equals("Premium")
        .where("price")
        .greaterThan(200);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });
  });

  describe("sort + filter + take combined", () => {
    it("filters, sorts descending, and takes top N", () => {
      const pipe = arrayPipeline<Item>()
        .where("type")
        .equals("Premium")
        .sort("price", "desc")
        .take(2);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(500);
      expect(result[1].price).toBe(300);
    });
  });

  describe("reuse on multiple datasets", () => {
    it("runs the same pipeline on different data", () => {
      const premiums = arrayPipeline<Item>().where("type").equals("Premium");

      const resultA = premiums.run(datasetA).all();
      const resultB = premiums.run(datasetB).all();

      expect(resultA).toHaveLength(3);
      expect(resultB).toHaveLength(2);
      expect(resultA[0].id).toBe(1);
      expect(resultB[0].id).toBe(10);
    });
  });

  describe("map changes element type", () => {
    it("maps items and allows further pipeline steps", () => {
      const pipe = arrayPipeline<Item>()
        .where("type")
        .equals("Premium")
        .map((item) => ({ label: item.name, cost: item.price }));

      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ label: "Alpha", cost: 500 });
    });
  });

  describe("run() returns full ArrayQuery", () => {
    it("exposes all terminal methods", () => {
      const pipe = arrayPipeline<Item>().where("type").equals("Premium");
      const aq = pipe.run(datasetA);

      expect(aq.count()).toBe(3);
      expect(aq.first().id).toBe(1);
      expect(aq.last().id).toBe(5);
      expect(aq.exists()).toBe(true);
      expect(aq.sum("price")).toBe(950);
    });
  });

  describe("whereIn", () => {
    it("filters items with value in a set", () => {
      const pipe = arrayPipeline<Item>().whereIn("type", [
        "Premium",
        "Standard",
      ]);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(4);
    });
  });

  describe("whereSift", () => {
    it("applies a raw sift query", () => {
      const pipe = arrayPipeline<Item>().whereSift({
        $or: [{ type: /premium/i }, { type: /basic/i }],
      });
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(4);
    });
  });

  describe("whereIfPresent with null", () => {
    it("skips the filter when value is null", () => {
      const pipe = arrayPipeline<Item>().whereIfPresent("type", null);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(5);
    });

    it("applies the filter when value is provided", () => {
      const pipe = arrayPipeline<Item>().whereIfPresent("type", "Premium");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
    });
  });

  describe("whereNotIfPresent with null", () => {
    it("skips the filter when value is null", () => {
      const pipe = arrayPipeline<Item>().whereNotIfPresent("type", null);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(5);
    });
  });

  describe("drop", () => {
    it("skips the first n items", () => {
      const pipe = arrayPipeline<Item>().drop(3);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(4);
    });
  });

  describe("takeWhile / dropWhile", () => {
    it("takes while predicate holds", () => {
      const sorted = [...datasetA].sort((a, b) => a.price - b.price);
      const pipe = arrayPipeline<Item>().takeWhile((item) => item.price < 200);
      const result = pipe.run(sorted).all();
      expect(result.every((i) => i.price < 200)).toBe(true);
    });
  });

  describe("flatMap", () => {
    it("flattens mapped results", () => {
      const data = [
        { id: 1, tags: ["a", "b"] },
        { id: 2, tags: ["c"] },
      ];
      const pipe = arrayPipeline<(typeof data)[0]>().flatMap(
        (item) => item.tags,
      );
      const result = pipe.run(data).all();
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("scan", () => {
    it("produces running accumulator values", () => {
      const pipe = arrayPipeline<Item>().scan(
        (acc, item) => acc + item.price,
        0,
      );
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(6); // n+1 including init
      expect(result[0]).toBe(0);
      expect(result[result.length - 1]).toBe(1100);
    });
  });

  describe("zip", () => {
    it("pairs items with another array", () => {
      const labels = ["x", "y", "z"];
      const pipe = arrayPipeline<Item>().zip(labels);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([datasetA[0], "x"]);
    });
  });

  describe("zipWith", () => {
    it("combines items using a function", () => {
      const multipliers = [2, 3, 1];
      const pipe = arrayPipeline<Item>().zipWith(
        multipliers,
        (item, m) => item.price * m,
      );
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(1000);
      expect(result[1]).toBe(150);
    });
  });

  describe("map2 / mapn", () => {
    it("map2 extracts two paths", () => {
      const pipe = arrayPipeline<Item>().map2(
        "name",
        "price",
        (name, price) => `${name}: $${price}`,
      );
      const result = pipe.run(datasetA).all();
      expect(result[0]).toBe("Alpha: $500");
    });

    it("mapn extracts N paths", () => {
      const pipe = arrayPipeline<Item>().mapn(
        ["id", "name", "price"],
        (id, name, price) => ({ id, label: `${name} ($${price})` }),
      );
      const result = pipe.run(datasetA).all();
      expect(result[0]).toEqual({ id: 1, label: "Alpha ($500)" });
    });
  });

  describe("filterIfPresent", () => {
    it("skips filter when expression is null", () => {
      const pipe = arrayPipeline<Item>().filterIfPresent(null);
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(5);
    });

    it("applies filter when expression is provided", () => {
      const pipe = arrayPipeline<Item>().filterIfPresent("price > 100");
      const result = pipe.run(datasetA).all();
      expect(result.every((i) => i.price > 100)).toBe(true);
    });
  });

  describe("greaterThanIfPresent / lessThanIfPresent", () => {
    it("skips when null", () => {
      const pipe = arrayPipeline<Item>().greaterThanIfPresent("price", null);
      expect(pipe.run(datasetA).count()).toBe(5);
    });

    it("applies when value given", () => {
      const pipe = arrayPipeline<Item>().greaterThanIfPresent("price", 200);
      expect(pipe.run(datasetA).count()).toBe(2);
    });
  });

  describe("immutability", () => {
    it("pipeline steps do not leak between derived pipelines", () => {
      const base = arrayPipeline<Item>().where("type").equals("Premium");
      const withSort = base.sort("price", "desc");
      const withTake = base.take(1);

      const baseResult = base.run(datasetA).all();
      const sortedResult = withSort.run(datasetA).all();
      const takenResult = withTake.run(datasetA).all();

      expect(baseResult).toHaveLength(3);
      expect(sortedResult).toHaveLength(3);
      expect(sortedResult[0].price).toBe(500);
      expect(takenResult).toHaveLength(1);
    });
  });

  describe("where terminal aliases", () => {
    it("eq works like equals", () => {
      const pipe = arrayPipeline<Item>().where("type").eq("Premium");
      expect(pipe.run(datasetA).count()).toBe(3);
    });

    it("ne works like not().equals()", () => {
      const pipe = arrayPipeline<Item>().where("type").ne("Premium");
      expect(pipe.run(datasetA).count()).toBe(2);
    });

    it("gt/gte/lt/lte work", () => {
      expect(
        arrayPipeline<Item>().where("price").gt(100).run(datasetA).count(),
      ).toBe(3);
      expect(
        arrayPipeline<Item>().where("price").gte(100).run(datasetA).count(),
      ).toBe(4);
      expect(
        arrayPipeline<Item>().where("price").lt(150).run(datasetA).count(),
      ).toBe(2);
      expect(
        arrayPipeline<Item>().where("price").lte(150).run(datasetA).count(),
      ).toBe(3);
    });
  });

  describe("where().startsWith / endsWith / matches", () => {
    it("startsWith filters correctly", () => {
      const pipe = arrayPipeline<Item>().where("name").startsWith("Al");
      expect(pipe.run(datasetA).count()).toBe(1);
    });

    it("endsWith filters correctly", () => {
      const pipe = arrayPipeline<Item>().where("name").endsWith("ta");
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(2); // Beta, Delta
    });

    it("matches filters with regex", () => {
      const pipe = arrayPipeline<Item>()
        .where("name")
        .matches(/^[A-E]/);
      expect(pipe.run(datasetA).count()).toBe(4); // Alpha, Beta, Delta, Epsilon
    });
  });

  describe("whereAll", () => {
    it("matches multiple exact criteria", () => {
      const pipe = arrayPipeline<Item>().whereAll({
        type: "Premium",
        price: 300,
      });
      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Gamma");
    });
  });

  describe("containsIfPresent / startsWithIfPresent / endsWithIfPresent", () => {
    it("skips containsIfPresent when null", () => {
      const pipe = arrayPipeline<Item>().containsIfPresent("name", null);
      expect(pipe.run(datasetA).count()).toBe(5);
    });

    it("applies containsIfPresent when value given", () => {
      const pipe = arrayPipeline<Item>().containsIfPresent("name", "lph");
      expect(pipe.run(datasetA).count()).toBe(1);
    });

    it("skips startsWithIfPresent when null", () => {
      const pipe = arrayPipeline<Item>().startsWithIfPresent("name", null);
      expect(pipe.run(datasetA).count()).toBe(5);
    });

    it("skips endsWithIfPresent when null", () => {
      const pipe = arrayPipeline<Item>().endsWithIfPresent("name", null);
      expect(pipe.run(datasetA).count()).toBe(5);
    });
  });

  describe("reduce / fold", () => {
    it("reduces with a pipeline", () => {
      const pipe = arrayPipeline<Item>().where("type").equals("Premium");
      const total = pipe
        .run(datasetA)
        .reduce((acc: number, item: Item) => acc + item.price, 0);
      expect(total).toBe(950);
    });
  });
});

// ── Unified design: .toRecipe() ─────────────────────────────────────────

describe(".toRecipe() from bound chain", () => {
  it("extracts a recipe that can be replayed on a root object", () => {
    const data = {
      things: [
        { id: 1, type: "A", price: 10 },
        { id: 2, type: "B", price: 20 },
        { id: 3, type: "A", price: 30 },
      ],
    };
    const bound = query(data).array("things").where("type").equals("A");

    const recipe = bound.toRecipe();
    // Recipe has embedded path "things", so pass a root object
    const result = recipe.run(data).all();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3);
  });

  it("preserves embedded arrayPath in recipe", () => {
    const data = { things: datasetA };
    const bound = query(data).array("things").where("type").equals("Premium");
    const recipe = bound.toRecipe();

    // Recipe with path can be used via query().run()
    const result = query(data).run(recipe).all();
    expect(result).toHaveLength(3);
  });

  it("stripTerminal removes the last step", () => {
    const data = { items: datasetA };
    const result = query(data)
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    const recipe = result.toRecipe(true);
    // Recipe has embedded path "items", so pass root object
    const count = recipe.run(data).count();
    expect(count).toBe(3);
  });
});

// ── QueryResult ─────────────────────────────────────────────────────────

describe("QueryResult", () => {
  it("is a real array (passes Array.isArray)", () => {
    const result = query({ items: datasetA })
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toBeInstanceOf(Array);
  });

  it("supports indexing, .length, .map(), .filter()", () => {
    const result = query({ items: datasetA })
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    expect(result.length).toBe(3);
    expect(result[0].id).toBe(1);
    expect(result.map((i) => i.id)).toEqual([1, 3, 5]);
    expect(result.filter((i) => i.price > 200)).toHaveLength(2);
  });

  it("toEqual works as a plain array", () => {
    const result = query({ items: datasetA })
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    expect(result).toEqual([datasetA[0], datasetA[2], datasetA[4]]);
  });

  it(".toRecipe() extracts a replayable pipeline", () => {
    const dataA = { items: datasetA };
    const result = query(dataA)
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    // .toRecipe(true) strips terminal so we can pick our own
    const recipe = result.toRecipe(true);
    const dataB = { items: datasetB };
    const replayed = recipe.run(dataB).all();
    expect(replayed).toHaveLength(2);
    expect(replayed[0].id).toBe(10);
  });

  it(".toRecipe(true) strips the terminal", () => {
    const data = { items: datasetA };
    const result = query(data)
      .array("items")
      .where("type")
      .equals("Premium")
      .sort("price", "desc")
      .all();

    // Strip the .all() terminal, add a different one
    const recipe = result.toRecipe(true);
    const first = recipe.run(data).first();
    expect(first.price).toBe(500);
  });
});

// ── .run() overloads ────────────────────────────────────────────────────

describe(".run() overloads", () => {
  describe("unbound with items array", () => {
    it("replays steps onto raw items", () => {
      const pipe = arrayPipeline<Item>()
        .where("type")
        .equals("Premium")
        .sort("price", "desc");

      const result = pipe.run(datasetA).all();
      expect(result).toHaveLength(3);
      expect(result[0].price).toBe(500);
    });
  });

  describe("unbound with root object (embedded path)", () => {
    it("extracts array via embedded path", () => {
      const data = { items: datasetA };
      const bound = query(data).array("items").where("type").equals("Premium");
      const recipe = bound.toRecipe();

      // recipe has embedded path "items"
      const result = recipe.run(data).all();
      expect(result).toHaveLength(3);
    });
  });

  describe("bound with recipe", () => {
    it("applies recipe steps to bound query results", () => {
      const transform = arrayPipeline<Item>().sort("price", "desc").take(2);

      const bound = query({ items: datasetA })
        .array("items")
        .where("type")
        .equals("Premium");

      const result = bound.run(transform).all();
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(500);
      expect(result[1].price).toBe(300);
    });
  });

  describe("JsonQueryRoot.run()", () => {
    it("runs a recipe with embedded path against root", () => {
      const data = { items: datasetA };
      const recipe = query(data)
        .array("items")
        .where("type")
        .equals("Premium")
        .toRecipe();

      const result = query(data).run(recipe).all();
      expect(result).toHaveLength(3);
    });

    it("throws for recipe without embedded path", () => {
      const data = { items: datasetA };
      const recipe = arrayPipeline<Item>().where("type").equals("Premium");

      expect(() => query(data).run(recipe as any)).toThrow(
        "Cannot run a pure pipeline",
      );
    });
  });
});

// ── Chaining after .run() ───────────────────────────────────────────────

describe("chaining after .run()", () => {
  it("supports further .where() after .run()", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium");
    const result = pipe.run(datasetA).where("price").greaterThan(200).all();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3);
  });

  it("supports .sort() after .run()", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium");
    const result = pipe.run(datasetA).sort("price", "asc").all();

    expect(result[0].price).toBe(150);
    expect(result[result.length - 1].price).toBe(500);
  });
});

// ── Conditional terminals in unbound mode ───────────────────────────────

describe("conditional terminals in unbound mode", () => {
  it(".all() in unbound returns the pipeline itself", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium").all();

    // The result is still an ArrayQuery (unbound) since .all() records a step
    const result = (pipe as any).run(datasetA);
    // After run, the terminal .all() replays and returns QueryResult
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it(".count() in unbound records a step", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium").count();

    const result = (pipe as any).run(datasetA);
    expect(result).toBe(3);
  });

  it(".first() in unbound records a step", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium").first();

    const result = (pipe as any).run(datasetA);
    expect(result.id).toBe(1);
  });

  it(".exists() in unbound records a step", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium").exists();

    const result = (pipe as any).run(datasetA);
    expect(result).toBe(true);
  });
});

// ── Path embedding transparency ─────────────────────────────────────────

describe("path embedding transparency", () => {
  it("recipe from bound chain embeds arrayPath", () => {
    const data = { items: datasetA };
    const recipe = query(data)
      .array("items")
      .where("type")
      .equals("Premium")
      .toRecipe();

    expect(recipe._getArrayPath()).toBe("items");
  });

  it("pure pipeline has no embedded path", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium");
    expect(pipe._getArrayPath()).toBeUndefined();
  });
});

// ── Branching from shared base ──────────────────────────────────────────

describe("branching from shared base", () => {
  it("derived pipelines are independent", () => {
    const base = arrayPipeline<Item>().where("type").equals("Premium");
    const expensive = base.where("price").greaterThan(200);
    const cheap = base.where("price").lessThan(200);

    const expResult = expensive.run(datasetA).all();
    const cheapResult = cheap.run(datasetA).all();

    expect(expResult).toHaveLength(2); // 500, 300
    expect(cheapResult).toHaveLength(1); // 150

    // Base is unchanged
    expect(base.run(datasetA).count()).toBe(3);
  });

  it("derived bound chains are independent", () => {
    const base = query({ items: datasetA })
      .array("items")
      .where("type")
      .equals("Premium");

    const sorted = base.sort("price", "desc");
    const taken = base.take(1);

    expect(sorted.all()).toHaveLength(3);
    expect((sorted.all() as any)[0].price).toBe(500);
    expect(taken.all()).toHaveLength(1);

    // Base is unchanged
    expect(base.count()).toBe(3);
  });
});

// ── partition() bound-only ──────────────────────────────────────────────

describe("partition() bound-only", () => {
  it("works on bound query", () => {
    const [premium, notPremium] = query({ items: datasetA })
      .array("items")
      .partition((i) => i.type === "Premium");

    expect(premium.count()).toBe(3);
    expect(notPremium.count()).toBe(2);
  });

  it("throws on unbound pipeline", () => {
    const pipe = arrayPipeline<Item>();
    expect(() => pipe.partition((i) => i.type === "Premium")).toThrow(
      "partition() is only available on bound queries",
    );
  });
});

// ── Design spec syntax examples ─────────────────────────────────────────

describe("design spec syntax examples", () => {
  const resp = {
    items: [
      { id: 1, type: "Premium", price: 500, name: "Alpha" },
      { id: 2, type: "Basic", price: 50, name: "Beta" },
      { id: 3, type: "Premium", price: 300, name: "Gamma" },
    ],
  };

  it("Example 1: bound chain → .all()", () => {
    const results = query(resp)
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    expect(results).toHaveLength(2);
    expect(Array.isArray(results)).toBe(true);
  });

  it("Example 2: bound chain → .count()", () => {
    const n = query(resp)
      .array("items")
      .where("type")
      .equals("Premium")
      .count();

    expect(n).toBe(2);
  });

  it("Example 3: arrayPipeline() → run(items)", () => {
    const pipe = arrayPipeline<(typeof resp.items)[0]>()
      .where("type")
      .equals("Premium");

    const results = pipe.run(resp.items).all();
    expect(results).toHaveLength(2);
  });

  it("Example 4: query().run(recipe)", () => {
    const recipe = query(resp)
      .array("items")
      .where("type")
      .equals("Premium")
      .toRecipe();

    const results = query(resp).run(recipe).all();
    expect(results).toHaveLength(2);
  });

  it("Example 5: bound.run(transform)", () => {
    type I = (typeof resp.items)[0];
    const transform = arrayPipeline<I>().sort("price", "desc").take(1);
    const top = query(resp)
      .array("items")
      .where("type")
      .equals("Premium")
      .run(transform)
      .all();

    expect(top).toHaveLength(1);
    expect(top[0].price).toBe(500);
  });

  it("Example 6: .all().toRecipe(true) strips terminal for reuse", () => {
    const result = query(resp)
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    // Strip terminal so we can pick a different one
    const recipe = result.toRecipe(true);
    const replayed = recipe.run(resp).all();
    expect(replayed).toEqual(result);
  });

  it("Example 7: recipe reuse across datasets", () => {
    const recipe = arrayPipeline<Item>()
      .where("type")
      .equals("Premium")
      .sort("price", "desc");

    const a = recipe.run(datasetA).all();
    const b = recipe.run(datasetB).all();

    expect(a).toHaveLength(3);
    expect(a[0].price).toBe(500);
    expect(b).toHaveLength(2);
    expect(b[0].price).toBe(800);
  });

  it("Example 8: pipeline with map type change", () => {
    const pipe = arrayPipeline<Item>()
      .where("type")
      .equals("Premium")
      .map((i) => i.name);

    const names = pipe.run(datasetA).all();
    expect(names).toEqual(["Alpha", "Gamma", "Epsilon"]);
  });

  it("Example 9: pipeline with reduce", () => {
    const pipe = arrayPipeline<Item>().where("type").equals("Premium");

    const total = pipe
      .run(datasetA)
      .reduce((acc: number, i: Item) => acc + i.price, 0);
    expect(total).toBe(950);
  });

  it("Example 10: composing transform + recipe", () => {
    const filterRecipe = arrayPipeline<Item>().where("type").equals("Premium");

    const sortTransform = arrayPipeline<Item>().sort("price", "asc");

    // Apply filter, then apply sort transform on the results
    const result = filterRecipe.run(datasetA).run(sortTransform).all();

    expect(result).toHaveLength(3);
    expect(result[0].price).toBe(150);
    expect(result[2].price).toBe(500);
  });

  it("Example 11: immutability of pipeline chains", () => {
    const base = arrayPipeline<Item>().where("type").equals("Premium");
    const v1 = base.sort("price", "asc");
    const v2 = base.sort("price", "desc");

    const r1 = v1.run(datasetA).all();
    const r2 = v2.run(datasetA).all();

    expect(r1[0].price).toBe(150);
    expect(r2[0].price).toBe(500);
    // base is not affected
    expect(base.run(datasetA).all()[0].id).toBe(1);
  });

  it("Example 12: QueryResult is iterable and spreadable", () => {
    const result = query({ items: datasetA })
      .array("items")
      .where("type")
      .equals("Premium")
      .all();

    const spread = [...result];
    expect(spread).toHaveLength(3);

    const ids: number[] = [];
    for (const item of result) {
      ids.push(item.id);
    }
    expect(ids).toEqual([1, 3, 5]);
  });
});
