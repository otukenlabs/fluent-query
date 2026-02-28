import { getPathSegmentAfter, query } from "../index";
import { getByPath, getByPathStrict, getPathSegments } from "./path";

describe("Helpers", () => {
  describe("getPathSegmentAfter()", () => {
    it("should return the segment after a prefix", () => {
      const result = getPathSegmentAfter(
        "sections.active.items[10]",
        "sections",
      );
      expect(result).toBe("active");
    });

    it("should handle nested paths", () => {
      const result = getPathSegmentAfter(
        "sections.active.items[10]",
        "sections.active",
      );
      expect(result).toBe("items");
    });

    it("should throw if prefix not found", () => {
      expect(() => {
        getPathSegmentAfter("sections.active.items[10]", "notfound");
      }).toThrow();
    });
  });

  describe("Nested path access", () => {
    const _data = {
      user: {
        profile: {
          name: "Alice",
          address: {
            city: "New York",
          },
        },
      },
    };

    it("should support nested path filtering", () => {
      const testData = {
        users: [
          { id: 1, profile: { name: "Alice", status: "active" } },
          { id: 2, profile: { name: "Bob", status: "inactive" } },
        ],
      };

      const result = query(testData)
        .array("users")
        .where("profile.status")
        .equals("active")
        .all();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("getByPath()", () => {
    it("returns root object when path is empty", () => {
      const root = { a: 1 };
      expect(getByPath(root, "")).toBe(root);
    });

    it("reads nested object path", () => {
      const root = { a: { b: { c: 1 } } };
      expect(getByPath(root, "a.b.c")).toBe(1);
    });

    it("reads bracket array notation", () => {
      const root = { items: [{ name: "A" }, { name: "B" }] };
      expect(getByPath(root, "items[1].name")).toBe("B");
    });

    it("preserves explicit undefined at the leaf", () => {
      expect(getByPath({ a: { b: undefined } }, "a.b")).toBeUndefined();
    });

    it("preserves in-bounds undefined array element", () => {
      expect(getByPath({ items: [undefined] }, "items[0]")).toBeUndefined();
    });

    it("throws when current becomes null/undefined", () => {
      expect(() => getByPath({ a: null }, "a.b")).toThrow(
        'Path "a.b" does not exist: null/undefined at "b".',
      );
    });

    it("throws when bracket key does not exist", () => {
      expect(() => getByPath({} as any, "items[0]")).toThrow(
        'Path "items[0]" does not exist: null/undefined at "items".',
      );
    });

    it("throws when bracket key is not an array", () => {
      expect(() => getByPath({ items: 123 } as any, "items[0]")).toThrow(
        'Path "items[0]" does not exist: "items" is not an array.',
      );
    });

    it("throws when bracket index is out of bounds", () => {
      expect(() => getByPath({ items: [1] }, "items[2]")).toThrow(
        'Path "items[2]" does not exist: index 2 out of bounds.',
      );
    });

    it("throws when non-bracket property is missing", () => {
      expect(() => getByPath({ a: {} }, "a.missing")).toThrow(
        'Path "a.missing" does not exist: property "missing" not found.',
      );
    });
  });

  describe("getByPathStrict()", () => {
    it("reads valid bracket path when value exists", () => {
      const root = { items: [{ name: "A" }, { name: "B" }] };
      expect(getByPathStrict(root, "items[1].name")).toBe("B");
    });

    it("throws when final leaf resolves to undefined", () => {
      expect(() => getByPathStrict({ a: { b: undefined } }, "a.b")).toThrow(
        'Path "a.b" does not exist: property "b" not found.',
      );
    });

    it("throws when in-bounds array element is undefined", () => {
      expect(() => getByPathStrict({ items: [undefined] }, "items[0]")).toThrow(
        'Path "items[0]" does not exist: index 0 out of bounds.',
      );
    });

    it("throws when traversing through null/undefined", () => {
      expect(() => getByPathStrict({ a: null }, "a.b")).toThrow(
        'Path "a.b" does not exist: null/undefined at "b".',
      );
    });

    it("throws when bracket key does not exist", () => {
      expect(() => getByPathStrict({} as any, "items[0]")).toThrow(
        'Path "items[0]" does not exist: null/undefined at "items".',
      );
    });

    it("throws when bracket key is not an array", () => {
      expect(() => getByPathStrict({ items: 123 } as any, "items[0]")).toThrow(
        'Path "items[0]" does not exist: "items" is not an array.',
      );
    });

    it("throws when bracket index is out of bounds", () => {
      expect(() => getByPathStrict({ items: [1] }, "items[2]")).toThrow(
        'Path "items[2]" does not exist: index 2 out of bounds.',
      );
    });

    it("throws when non-bracket property is missing", () => {
      expect(() => getByPathStrict({ a: {} }, "a.missing")).toThrow(
        'Path "a.missing" does not exist: property "missing" not found.',
      );
    });
  });

  describe("getPathSegments()", () => {
    it("returns empty array for empty path", () => {
      expect(getPathSegments("")).toEqual([]);
    });

    it("normalizes bracket notation to path segments", () => {
      expect(getPathSegments("sections.active.items[10]")).toEqual([
        "sections",
        "active",
        "items",
      ]);
    });
  });

  describe("getPathSegmentAfter() edge", () => {
    it("throws when prefix path is empty", () => {
      expect(() => getPathSegmentAfter("a.b.c", "")).toThrow(
        "Prefix path is required.",
      );
    });
  });
});
