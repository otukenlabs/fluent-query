# fluent-query

A fluent, type-safe query builder for JSON data with MongoDB-style filters. Perfect for querying API responses, filtering arrays, and data transformation.

## Features

- 🔍 **Fluent API** - Chain methods for readable queries
- 📊 **Rich Filtering** - MongoDB-style operators (equals, contains, greater than, etc.)
- 🎯 **Type-Safe** - Full TypeScript support
- 🔢 **Aggregations** - sum, average, min, max, groupBy, distinct
- 🎲 **Flexible Selection** - first, one, random, nth
- 🔧 **Powerful Operators** - Filter expressions with `and/or/not` and `&&/||/!` (parentheses supported)
- 💯 **Decimal Precision** - Handle floating point comparisons correctly
- 🔄 **Map/Reduce** - General-purpose transform and fold with map, reduce, flatMap, scan
- ✂️ **Composable Primitives** - take, drop, takeWhile, dropWhile, partition, zip, zipWith, expand, setAll, setEach
- 🧩 **Reusable Pipelines** - Define a query once, run it on any dataset with `arrayPipeline()`
- 🔁 **Recipe Extraction** - Extract reusable pipelines from bound chains or results via `.toRecipe()`

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
// Basic filtering
const premium = query(data)
  .array("items")
  .where("type")
  .equals("Premium")
  .all();

// Membership helpers
const activeTypes = query(data)
  .array("items")
  .whereIn("type", ["Premium", "Basic"])
  .whereNotIn("status", ["archived"])
  .all();

// Primitive-array filtering + summaries
const stats = query({ prices: [9.99, 10.01, 14.5, 20] })
  .array("prices")
  .whereSelf()
  .greaterThan(10)
  .sum("", { decimals: 2 });

// Numeric-string fields are compared as numbers
const expensive = query({
  items: [
    { price: "150.0000" },
    { price: "80.0000" },
    { price: null },
  ],
})
  .array("items")
  .where("price")
  .greaterThan(100)
  .all();

// Root write-back
const updated = query(data)
  .array("devices")
  .sort("id", { direction: "asc" })
  .toRoot("result.sortedDevices")
  .unwrap();
```

For complete examples and full guides, use the docs site:

- API index: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/
- Find & Filter: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/find-and-filter-data
- Sort & Shape: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/sort-and-shape-results
- Grouped Data: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/work-with-grouped-data
- Pipelines & Recipes: https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/reuse-query-logic

## API Reference

Core methods:

- Selection: `.array(path)`, `.where(path)`, `.whereSelf()`, `.whereIn(path, values)`, `.whereNotIn(path, values)`, `.whereMissing(path)`, `.whereExists(path)`, `.whereAll(criteria)`, `.whereAny(criteria)`, `.whereNone(criteria)`, `.filter(expression)`
- Grouped selection: `.objectGroups(path)`, `.include(keyOrKeys)`, `.exclude(keyOrKeys)`, `.where(path)`, `.whereIn(path, values)`, `.whereNotIn(path, values)`, `.whereAll(criteria)`, `.whereAny(criteria)`, `.whereNone(criteria)`, `.filter(expression)`, `.filterIfDefined(...)`, `.sort(path?, { direction?, nulls? })`, `.pick(...)`, `.omit(...)`, `.compact(options?)`, `.entries()`, `.values()`
- Terminals: `.all()`, `.first()`, `.one()`, `.random()`, `.count()`, `.exists()`, `.sum(path?, options?)`, `.average(path?, options?)`, `.min(path?)`, `.max(path?)`, `.sumOfProducts(...paths, options?)` (`.exists()` and `.every()` are not directly available in TypeScript on fresh bound selections such as `.array(...)` / grouped `.flatArray(...)`; if bypassed, runtime still throws until you add a narrowing step first)
- Transforms: `.sort(path?, { direction?, nulls? })` (omit/empty path to sort by item itself), `.map(fn)`, `.flatMap(fn)`, `.set(...)`, `.setAll(...)`, `.replaceValue(...)`, `.replaceMany(...)`, `.pick(...)`, `.omit(...)`, `.compact(options?)`
- Root helpers: `.toRoot(path?)`, `.sortAt(arrayPath, byPath, options?)`, `.unset(path, options?)`, `.unsetAll(paths, options?)`, `.filterAt(path, expression, options?)`, `.filterAtIfDefined(path, expression, param, options?)`, `.filterAtIfAllDefined(path, expression, params, options?)`, `.pickAt(path, ...)`, `.omitAt(path, ...)`, `.compactAt(path, options?)`, `.renameAt(path, oldKey, newKey)`, `.transformAt(path, fn)`, `.replaceValueAt(path, fromValue, toValue, options?)`, `.replaceManyAt(path, rules, options?)`, `.objectGroupsAt(path, fn)`, `.diff(...)`, `.hasAll(...)`, `.has(...)`
- Pipelines: `arrayPipeline<T>()`, `.run(...)`, `.toRecipe(...)`

Full method reference (including options, aliases, and advanced operators):

- https://otukenlabs.github.io/fluent-query-docs/docs/api-reference/

## Options

### String Matching Options

```typescript
.where('name').equals('john', { ignoreCase: true, trim: true })
.filter('name contains john', { ignoreCase: true, trim: true })
```

### Numeric Comparison Options

```typescript
// Numeric strings like "150.0000" are parsed automatically.
// null/undefined are treated as 0 by default.
query(data).array("items").where("price").greaterThan(100)

// Opt into strict nullish handling.
query(data)
  .array("items")
  .where("price")
  .greaterThan(100, { nullAsZero: false })
```

### Filter Expression Logic

```typescript
// Word operators
.filter("type == 'Premium' and not (status == 'archived')")

// Symbol aliases
.filter("type == 'Premium' && !(status == 'archived')")
```

Migration note:

```typescript
// Old binary syntax (no longer supported)
// .filter("status not 'archived'")

// Use inequality instead
.filter("status != 'archived'")
```

Conditional helpers:

`IfDefined` means the gated value(s) are neither `null` nor `undefined`.

Named placeholders use `$name` syntax. Positional placeholders like `$1`, `$2`
are not supported.

```typescript
filterIfDefined(expression, param, options?)
filterIfAllDefined(expression, paramMap, options?)
whereIfDefined(path, value, options?)
whereNotIfDefined(path, value, options?)
greaterThanIfDefined(path, value)
greaterThanOrEqualIfDefined(path, value)
lessThanIfDefined(path, value)
lessThanOrEqualIfDefined(path, value)
containsIfDefined(path, value, options?)
notContainsIfDefined(path, value, options?)
startsWithIfDefined(path, value, options?)
notStartsWithIfDefined(path, value, options?)
endsWithIfDefined(path, value, options?)
notEndsWithIfDefined(path, value, options?)
```

Conditional filter gating examples:

```typescript
// Single-param named placeholder binding
// (applies only if minPrice is not null/undefined)
.filterIfDefined("price >= $minPrice", minPrice)

// Single-param gating without placeholders is also valid
.filterIfDefined("price > 100", minPrice)

// Multi-param named placeholder binding
// (applies only if ALL mapped values are not null/undefined)
.filterIfAllDefined("price >= $minPrice and price <= $maxPrice", {
  minPrice,
  maxPrice,
})

// Object gating without placeholders is also valid
.filterIfAllDefined("price > 100 and type == 'Premium'", { minPrice, type })
```

### Decimal Precision Options

```typescript
// Compare prices at 2 decimal places
.filter('price == 19.99', { decimals: 2 })
```

## License

MIT © Otuken

## Repository

[GitHub](https://github.com/otukenlabs/fluent-query)
