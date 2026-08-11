import { query } from "../index";

const groupedRoot = {
  sections: {
    a: {
      items: [{ id: 1 }],
    },
  },
};

const groupedItems = query(groupedRoot)
  .objectGroups("sections")
  .flatArray("items");

// @ts-expect-error toRoot() is intentionally unavailable on grouped array queries.
groupedItems.toRoot();

// @ts-expect-error exists() is intentionally unavailable directly after grouped flatArray().
groupedItems.exists();

// @ts-expect-error every() is intentionally unavailable directly after grouped flatArray().
groupedItems.every();

const groupedItemsAlias = query(groupedRoot)
  .objectGroups("sections")
  .arrays("items");

// @ts-expect-error toRoot() is intentionally unavailable on grouped array queries.
groupedItemsAlias.toRoot();

// @ts-expect-error exists() is intentionally unavailable directly after grouped arrays().
groupedItemsAlias.exists();

// @ts-expect-error every() is intentionally unavailable directly after grouped arrays().
groupedItemsAlias.every();

query(groupedRoot)
  .objectGroups("sections")
  .flatArray("items")
  .where("id")
  .greaterThan(0)
  .exists();

query({
  currentAccounts: { products: [{ id: "1" }] },
  savingsAccounts: { products: [{ id: "2" }] },
})
  .objectGroupsRoot()
  .flatArray<{ id: string }>("products")
  .where("id")
  .equals("2")
  .first();

query(groupedRoot)
  .objectGroups("sections")
  .include("a")
  .exclude("missing")
  .where("items.0.id")
  .greaterThan(0)
  .whereNotIn("items.0.id", [999])
  .whereAny({ "items.0.id": 1 })
  .filter("items.0.id >= 1")
  .filterIfDefined("items.0.id >= $min", 1)
  .pick(["items.0.id"])
  .sort("items.0.id", { direction: "desc" })
  .entries();

const boundRoot = {
  items: [{ id: 1 }],
};

query(boundRoot).array("items").toRoot();

const boundItems = query(boundRoot).array("items");

// @ts-expect-error exists() is intentionally unavailable directly after array().
boundItems.exists();

// @ts-expect-error every() is intentionally unavailable directly after array().
boundItems.every();

query(boundRoot).array("items").where("id").equals(1).exists();
query(boundRoot).array("items").where("id").gt(0).every();
query(boundRoot)
  .array("items")
  .everyWhere({ id: 1 }, { id: [1, 2] }, { mode: "any" });

const rootArray = query([{ id: 1 }]).arrayRoot<{ id: number }>();

// @ts-expect-error exists() is intentionally unavailable directly after arrayRoot().
rootArray.exists();

// @ts-expect-error every() is intentionally unavailable directly after arrayRoot().
rootArray.every();

query([{ id: 1 }])
  .arrayRoot<{ id: number }>()
  .where("id")
  .equals(1)
  .exists();

const everyWherePipe = query(boundRoot)
  .array("items")
  .toRecipe()
  .everyWhere({ id: 1 }, { id: [1, 2] }, { mode: "any" });

query(boundRoot).run(everyWherePipe);
