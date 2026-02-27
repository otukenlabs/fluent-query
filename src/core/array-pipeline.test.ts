import { arrayPipeline } from "../index";

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

describe("ArrayPipeline", () => {
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
      const pipe = arrayPipeline<Item>()
        .where("type")
        .not()
        .equals("Premium");
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
      const premiums = arrayPipeline<Item>()
        .where("type")
        .equals("Premium");

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
      const pipe = arrayPipeline<(typeof data)[0]>().flatMap((item) => item.tags);
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
      const pipe = arrayPipeline<Item>().where("name").matches(/^[A-E]/);
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
});
