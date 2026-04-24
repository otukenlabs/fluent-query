# fluent-query

The fluent, type-safe query builder for JSON data. Filter, transform, summarize, and reuse query logic with readable chains.

## Features

- 🔍 **Fluent, readable chains** - Build complex queries in clear, composable steps
- 🎯 **Type-safe querying** - Keep strong TypeScript inference across every chain
- 📊 **Powerful filtering** - Mix builder filters and expression filters (`and/or/not`, `&&/||/!`)
- 🔢 **Built-in summaries** - Compute `sum`, `average`, `min`, `max`, `groupBy`, `distinct`, and more
- 🧱 **Transform and shape data** - Sort, map, pick, omit, compact, and flatten results
- 🧩 **Reusable pipelines** - Define once with `arrayPipeline()` and run on any dataset
- 🔁 **Recipe extraction** - Capture chain logic with `.toRecipe()` and replay it anywhere

## Installation

```bash
npm install fluent-query
```

## Quick Start

```typescript
import { query } from "fluent-query";

const data = {
  users: [
    { name: "Alice", age: 30, city: "New York" },
    { name: "Bob", age: 25, city: "Los Angeles" },
    { name: "Charlie", age: 35, city: "New York" },
  ],
};

// Find users over 25 in New York
const results = query(data)
  .array("users")
  .where("age")
  .greaterThan(25)
  .where("city")
  .equals("New York")
  .all();
// => [{ name: 'Alice', age: 30, city: 'New York' }, { name: 'Charlie', age: 35, city: 'New York' }]
```

## Usage Examples

```typescript
import { arrayPipeline, query } from "fluent-query";

// Fluent filtering + sorting + shaping
const activePremium = query(data)
  .array("items")
  .where("status")
  .notEquals("archived")
  .where("type")
  .equals("Premium")
  .sort("price", { direction: "desc" })
  .pick(["id", "name", "price"])
  .all();

// Expression filters with logical operators
const eligible = query(data)
  .array("items")
  .filter("(price >= 100 and stock > 0) and not (status == 'archived')")
  .all();

// Summaries
const revenue = query(data).array("orders").sum("total");
const avgOrder = query(data).array("orders").average("total", { decimals: 2 });

// Reusable pipeline across datasets
const premiumPipeline = arrayPipeline<{ type: string; price: number }>()
  .where("type")
  .equals("Premium")
  .where("price")
  .greaterThan(100)
  .sort("price", { direction: "desc" });

const resultA = premiumPipeline.run([{ type: "Premium", price: 120 }]).all();
const resultB = premiumPipeline
  .run([
    { type: "Basic", price: 90 },
    { type: "Premium", price: 180 },
  ])
  .all();

// Extract a recipe from a bound query and replay it later
const recipe = query(data)
  .array("items")
  .where("type")
  .equals("Premium")
  .sort("price", { direction: "desc" })
  .toRecipe();

const replayed = query(otherData).run(recipe);
```

## API at a Glance

- **Start querying:** `query(data).array(path)`
- **Filter fluently:** `where(...).equals(...)`, `where(...).greaterThan(...)`, `whereIn(...)`, `whereNotIn(...)`
- **Filter by expression:** `filter("price >= 100 and not (status == 'archived')")`
- **Transform results:** `sort`, `map`, `pick`, `omit`, `compact`, `flatMap`
- **Compute summaries:** `count`, `sum`, `average`, `min`, `max`, `groupBy`, `distinct`
- **Reuse logic:** `arrayPipeline()`, `run(...)`, `toRecipe(...)`

## Documentation

For full API details, options, and advanced examples, use the docs:

- API index: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/
- Find & Filter: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/find-and-filter-data
- Sort & Shape: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/sort-and-shape-results
- Grouped Data: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/work-with-grouped-data
- Pipelines & Recipes: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/reuse-query-logic

## License

MIT © Otuken

## Repository

[GitHub](https://github.com/otukenlabs/fluent-query)
