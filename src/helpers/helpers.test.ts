import { query, getPathSegmentAfter } from "../index";

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
    const data = {
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
});
