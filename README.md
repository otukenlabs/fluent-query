# fluent-query

A fluent, type-safe query builder for JSON data with MongoDB-style filters. Perfect for querying API responses, filtering arrays, and data transformation.

## Features

- 🔍 **Fluent API** - Chain methods for readable queries
- 📊 **Rich Filtering** - MongoDB-style operators (equals, contains, greater than, etc.)
- 🎯 **Type-Safe** - Full TypeScript support
- 🔢 **Aggregations** - sum, average, min, max, groupBy, distinct
- 🎲 **Flexible Selection** - first, one, random, nth
- 🔧 **Powerful Operators** - Filter expressions with and/or logic
- 💯 **Decimal Precision** - Handle floating point comparisons correctly
- 🔄 **Map/Reduce** - General-purpose transform and fold with map, reduce, flatMap, scan
- ✂️ **Composable Primitives** - take, drop, takeWhile, dropWhile, partition, zip, zipWith
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

### Basic Filtering

```typescript
// Exact match
query(data).array("products").where("status").equals("active").all();

// Contains (case-insensitive by default)
query(data).array("items").where("description").contains("premium").all();

// Numeric comparisons
query(data).array("orders").where("total").greaterThanOrEqual(100).all();

// Mongo-style aliases
query(data).array("orders").where("total").gte(100).all();
query(data).array("users").where("name").ne("Alice").all();
```

### Filter Expressions

```typescript
// Simple expression
query(data).array("items").filter("price >= 1000").all();

// With 'and' logic
query(data).array("users").filter("city == 'New York' and age > 30").all();

// With 'or' logic
query(data)
  .array("products")
  .filter("status == 'active' or status == 'pending'")
  .all();

// Not operator
query(data).array("items").filter("value not undefined").all();

// Decimal precision for floats
query(data).array("prices").filter("amount == 19.99", { decimals: 2 }).all();
```

### Selection Methods

```typescript
// Get first match
const first = query(data).array("users").where("age").greaterThan(25).first();

// Get exactly one (throws if 0 or 2+)
const one = query(data).array("users").where("id").equals(123).one();

// Get random match
const random = query(data)
  .array("products")
  .where("inStock")
  .equals(true)
  .random();

// Get nth match
const third = query(data).array("items").nth(2);

// Get all matches
const all = query(data).array("users").where("active").equals(true).all();
```

### Aggregations

```typescript
// Sum
const total = query(data).array("orders").sum("amount");

// Average
const avgAge = query(data).array("users").average("age");

// Min/Max
const minPrice = query(data).array("products").min("price");
const maxPrice = query(data).array("products").max("price");

// Count
const count = query(data)
  .array("items")
  .where("status")
  .equals("active")
  .count();

// Distinct
const uniqueCities = query(data).array("users").distinct("city");

// Group by
const byStatus = query(data).array("orders").groupBy("status");
```

### Pluck Values

```typescript
// Extract single property
const ids = query(data).array("users").pluck("id").all();
// => [1, 2, 3]

// With transformations
const idsAsStrings = query(data).array("users").pluck("id").string().all();

// Keep only values of a runtime type (no coercion)
const numbersOnly = query(data)
  .array("mixed")
  .pluck("value")
  .ofType("number")
  .all();
// [{ value: 1 }, { value: '3' }, { value: 'john' }, { value: 5 }] -> [1, 5]

// Convert signed numbers to absolute values
const absoluteDeltas = query(data)
  .array("measurements")
  .pluck("delta")
  .abs()
  .all();

// Clamp values into an inclusive range
const boundedScores = query(data)
  .array("scores")
  .pluck("value")
  .clamp(0, 100)
  .all();

// Scale values by a factor
const scaled = query(data).array("metrics").pluck("value").scale(10).all();

// Offset values by a delta
const celsius = query(data)
  .array("temperatures")
  .pluck("kelvin")
  .offset(-273.15)
  .all();

// Round to fixed decimal places
const roundedPrices = query(data)
  .array("products")
  .pluck("price")
  .round(2)
  .all();

// Optional banker's rounding mode for decimal ties
const roundedPricesHalfEven = query(data)
  .array("products")
  .pluck("price")
  .round(1, { mode: "halfEven" })
  .all();
// [1.25, 1.35] -> [1.2, 1.4]

// Round to significant digits
const roundedSig = query(data)
  .array("metrics")
  .pluck("value")
  .roundSignificant(3)
  .all();

// Optional scientific/banker's rounding mode for ties
const roundedSigHalfEven = query(data)
  .array("metrics")
  .pluck("value")
  .roundSignificant(2, { mode: "halfEven" })
  .all();
// [125, 135] -> [120, 140]
```

### Path Helpers

```typescript
import { getByPath } from "fluent-query";

const obj = {
  profile: { name: "Alice", nickname: undefined },
  items: [undefined, { id: 2 }],
};

getByPath(obj, "profile.name"); // "Alice"
getByPath(obj, "profile.nickname"); // undefined
getByPath(obj, "items[0]"); // undefined

// Throws for missing/non-traversable paths
getByPath(obj, "profile.age"); // throws
getByPath(obj, "items[99]"); // throws
```

### Map / Transform

```typescript
// Transform each item
const names = query(data)
  .array("users")
  .map((user) => user.name.toUpperCase())
  .all();
// => ['ALICE', 'BOB', 'CHARLIE']

// map preserves chainability -- filter after transforming
const expensiveLabels = query(data)
  .array("products")
  .map((p) => ({ label: p.name, cost: p.price * 1.1 }))
  .where("cost")
  .greaterThan(100)
  .all();

// Extract two paths and combine
const labels = query(data)
  .array("products")
  .map2("name", "price", (name, price) => `${name}: $${price}`)
  .all();

// Extract N paths
const rows = query(data)
  .array("users")
  .mapn(["id", "name", "city"], (id, name, city) => `${id},${name},${city}`)
  .all();

// flatMap -- expand each item into 0..N results, then flatten
const allTags = query(data)
  .array("posts")
  .flatMap((post) => post.tags)
  .all();
```

### Reduce / Fold

`reduce` is the general form of aggregation -- the built-in `sum`, `count`,
`min`, `max`, and `average` are all special cases:

```typescript
// sum(path)  ≡  reduce with +
const total = query(data)
  .array("orders")
  .reduce((acc, order) => acc + order.amount, 0);

// count()  ≡  reduce with +1
const n = query(data)
  .array("orders")
  .reduce((acc, _item) => acc + 1, 0);

// min(path)  ≡  reduce with Math.min
const cheapest = query(data)
  .array("products")
  .reduce(
    (min, p) => (min === null || p.price < min ? p.price : min),
    null as number | null,
  );

// max(path)  ≡  reduce with Math.max
const priciest = query(data)
  .array("products")
  .reduce(
    (max, p) => (max === null || p.price > max ? p.price : max),
    null as number | null,
  );

// average(path)  ≡  scan to get running sum, then divide
const avg = query(data)
  .array("items")
  .reduce((acc, item) => ({ sum: acc.sum + item.price, n: acc.n + 1 }), {
    sum: 0,
    n: 0,
  });
// avg.sum / avg.n

// fold is an alias for reduce
const total2 = query(data)
  .array("orders")
  .fold((acc, order) => acc + order.amount, 0);

// Fold with two extracted paths
const weightedSum = query(data)
  .array("items")
  .reduce2("quantity", "unitPrice", (acc, qty, price) => acc + qty * price, 0);

// Fold with N extracted paths
const summary = query(data)
  .array("items")
  .reducen(
    ["id", "name", "price"],
    (acc, id, name, price) => {
      acc.push(`#${id} ${name}: $${price}`);
      return acc;
    },
    [],
  );
```

### Scan (running accumulation)

```typescript
// Running total -- output length is n+1 (includes initial value)
const runningTotal = query(data)
  .array("transactions")
  .scan((balance, tx) => balance + tx.amount, 0)
  .all();
// e.g. [0, 100, 250, 230, 380]
```

### Take / Drop / Slice

```typescript
// First 3 items (after filters)
const top3 = query(data)
  .array("items")
  .where("status")
  .equals("active")
  .take(3)
  .all();

// Skip first 10
const rest = query(data).array("items").drop(10).all();

// Take while predicate holds
const cheap = query(data)
  .array("items")
  .sort("price")
  .takeWhile((item) => item.price < 100)
  .all();

// Drop while predicate holds
const afterCheap = query(data)
  .array("items")
  .sort("price")
  .dropWhile((item) => item.price < 100)
  .all();
```

### Partition

```typescript
// Split into two groups
const [active, inactive] = query(data)
  .array("users")
  .partition((user) => user.status === "active");

active.all(); // all active users
inactive.count(); // count of inactive users
```

### Zip / ZipWith

```typescript
// Pair items with an external array
const paired = query(data)
  .array("users")
  .zip(["admin", "editor", "viewer"])
  .all();
// => [[user1, 'admin'], [user2, 'editor'], [user3, 'viewer']]

// Combine with a function
const scored = query(data)
  .array("students")
  .zipWith(grades, (student, grade) => ({ name: student.name, grade }))
  .all();
```

### Reusable Pipelines (arrayPipeline)

The standard `query(data).array(path)` approach binds data at construction
time. When you want to define a query chain once and apply it to different
arrays later, use `arrayPipeline<T>()`.

`arrayPipeline<T>()` returns an unbound `ArrayQuery` — a pure description of
operations with no data attached. The pipeline only executes when you call
`.run(items)`, which supplies the data and returns a bound `ArrayQuery`.

```typescript
import { arrayPipeline } from "fluent-query";

interface Product {
  name: string;
  type: string;
  price: number;
}
```

**Building a pipeline (no data, no execution):**

```typescript
const cheapPremiums = arrayPipeline<Product>()
  .where("type")
  .equals("Premium")
  .sort("price", "asc")
  .take(3);
```

**Resolving with `.run()` (data in, bound query out):**

```typescript
const fromWarehouse = cheapPremiums.run(warehouseProducts).all();
const fromStore = cheapPremiums.run(storeProducts).first();
const totalValue = cheapPremiums.run(allProducts).sum("price");
```

**Side-by-side comparison with `query()`:**

```typescript
// Standard approach: data bound at construction
const result = query(data)
  .array("products")
  .where("type")
  .equals("Premium")
  .sort("price", "asc")
  .take(3)
  .all();

// Pipeline approach: same chain, but data supplied separately
const pipe = arrayPipeline<Product>()
  .where("type")
  .equals("Premium")
  .sort("price", "asc")
  .take(3);

const result1 = pipe.run(dataA.products).all(); // reuse on dataset A
const result2 = pipe.run(dataB.products).all(); // reuse on dataset B
```

**Branching from a shared base:**

Pipelines are immutable — each chained call returns a new instance, so you
can branch freely without one branch affecting another.

```typescript
const premiums = arrayPipeline<Product>().where("type").equals("Premium");

// Two independent branches from the same base
const cheapest = premiums.sort("price", "asc").take(5);
const priciest = premiums.sort("price", "desc").take(5);

// Each branch resolves independently
cheapest.run(products).all(); // 5 cheapest premiums
priciest.run(products).all(); // 5 most expensive premiums
premiums.run(products).count(); // base pipeline is unaffected
```

**Type-changing transforms:**

Transforms like `.map()` produce a new pipeline with an updated element type.

```typescript
const labels = arrayPipeline<Product>()
  .where("type")
  .equals("Premium")
  .map((p) => ({ label: p.name, cost: p.price }));

// labels is ArrayQuery<{ label: string; cost: number }, 'unbound'>
labels.run(products).all();
// => [{ label: 'Widget', cost: 500 }, ...]
```

### Recipes and QueryResult

Bound queries and their results carry the full chain of operations, which
can be extracted as a reusable recipe via `.toRecipe()`.

**`.all()` returns a `QueryResult`:**

`QueryResult<T>` extends `Array<T>` — it passes `Array.isArray()`, supports
indexing, `.length`, `.map()`, spread, and `for..of`. It also exposes
`.toRecipe()` for extracting the pipeline that produced it.

```typescript
const result = query(data).array("items").where("type").equals("Premium").all();

Array.isArray(result); // true
result.length; // 3
result[0]; // first item
[...result]; // spread into plain array
```

**Extracting recipes from bound chains:**

```typescript
// Extract a recipe from a bound chain (before terminal)
const recipe = query(data)
  .array("items")
  .where("type")
  .equals("Premium")
  .toRecipe();

// Replay on different data (recipe embeds the array path "items")
const result = recipe.run(otherData).all();
```

**Extracting recipes from QueryResult:**

```typescript
const result = query(data).array("items").where("type").equals("Premium").all();

// Strip the terminal (.all) so you can pick a different one
const recipe = result.toRecipe(true);
const count = recipe.run(otherData).count();
const first = recipe.run(otherData).first();
```

**Applying recipes via `query().run()`:**

When a recipe has an embedded array path (extracted from a bound chain), you
can apply it directly to a root object:

```typescript
const recipe = query(data)
  .array("items")
  .where("type")
  .equals("Premium")
  .toRecipe();

// Equivalent to query(newData).array("items").where("type").equals("Premium")
query(newData).run(recipe).all();
```

**Applying a transform pipeline to bound results:**

A pure pipeline (no embedded path) can be applied as a post-processing step
on bound query results:

```typescript
const transform = arrayPipeline<Item>().sort("price", "desc").take(3);

const top3 = query(data)
  .array("items")
  .where("type")
  .equals("Premium")
  .run(transform) // applies sort+take to the filtered results
  .all();
```

## API Reference

### Main Methods

- `.array(path)` - Select array by path
- `.where(path)` - Start filter chain
- `.filter(expression)` - Filter with expression
- `.all()` - Get all matches
- `.first()` - Get first match
- `.one()` - Get exactly one (throws otherwise)
- `.random()` - Get random match
- `.nth(index)` - Get nth match
- `.count()` - Count matches
- `.exists()` - Check if any matches exist

### Filter Operators

- `.equals(value)` - Exact match
- `.contains(value)` - Substring match
- `.startsWith(value)` - Prefix match
- `.endsWith(value)` - Suffix match
- `.greaterThan(value)` - Numeric >
- `.greaterThanOrEqual(value)` - Numeric >=
- `.lessThan(value)` - Numeric <
- `.lessThanOrEqual(value)` - Numeric <=
- `.eq(value)` - Alias for `.equals(value)`
- `.ne(value)` - Alias for `.not().equals(value)`
- `.gt(value)` - Alias for `.greaterThan(value)`
- `.gte(value)` - Alias for `.greaterThanOrEqual(value)`
- `.lt(value)` - Alias for `.lessThan(value)`
- `.lte(value)` - Alias for `.lessThanOrEqual(value)`
- `.matches(regex)` - Regex match

### Expression Operators

- `==` or `===` - Equals
- `!=` or `!==` or `not` - Not equals
- `>`, `>=`, `<`, `<=` - Numeric comparisons
- `contains` - Substring
- `startsWith` - Prefix
- `endsWith` - Suffix

### Aggregation Methods

- `.sum(path)` - Sum numeric values
- `.average(path)` - Average of values
- `.min(path)` - Minimum value
- `.max(path)` - Maximum value
- `.distinct(path?)` - Unique items
- `.groupBy(path)` - Group by property

### Transform Methods

- `.map(fn)` - Transform each item, returns chainable `ArrayQuery`
- `.map2(path1, path2, fn)` - Extract two paths per item, apply binary function
- `.mapn(paths, fn)` - Extract N paths per item, apply N-ary function
- `.flatMap(fn)` - Map each item to an array, flatten results

### Reduce / Fold Methods

- `.reduce(fn, init)` - Left-fold items into a single value
- `.fold(fn, init)` - Alias for `.reduce()`
- `.reduce2(path1, path2, fn, init)` - Fold with two extracted path values
- `.fold2(path1, path2, fn, init)` - Alias for `.reduce2()`
- `.reducen(paths, fn, init)` - Fold with N extracted path values
- `.foldn(paths, fn, init)` - Alias for `.reducen()`
- `.scan(fn, init)` - Like reduce but returns all intermediate values (length n+1)

### Sublist Methods

- `.take(n)` - First n items from filtered results
- `.drop(n)` - Skip first n items
- `.takeWhile(fn)` - Longest prefix satisfying predicate
- `.dropWhile(fn)` - Drop prefix satisfying predicate, return rest
- `.partition(fn)` - Split into `[matching, nonMatching]` tuple of `ArrayQuery`

### Combining Methods

- `.zip(other)` - Pair items with external array (truncates to shorter)
- `.zipWith(other, fn)` - Combine items with external array using function

### Pipeline and Recipe Methods

`arrayPipeline<T>()` returns an unbound `ArrayQuery` that records operations
for later replay. Bound chains and `QueryResult` expose `.toRecipe()` for
extracting pipelines from existing queries.

- `arrayPipeline<T>()` - Create an empty reusable pipeline
- `.run(items)` (on unbound) - Bind data and resolve: returns bound `ArrayQuery`
- `.run(recipe)` (on bound) - Apply a pipeline as post-processing transform
- `query(data).run(recipe)` - Apply a recipe with embedded path to a root object
- `.toRecipe(stripTerminal?)` - Extract an unbound pipeline from a bound chain
- `result.toRecipe(stripTerminal?)` - Extract a pipeline from a `QueryResult`

All chainable methods (`.where()`, `.filter()`, `.sort()`, `.map()`, etc.)
work identically on both bound and unbound queries. Terminal methods
(`.all()`, `.count()`, `.first()`, etc.) execute eagerly on bound queries
and record themselves as steps on unbound pipelines.

## Options

### String Matching Options

```typescript
.where('name').equals('john', { ignoreCase: true, trim: true })
.filter('name contains john', { ignoreCase: true, trim: true })
```

Migration note (pre-2.0 syntax):

```typescript
// Before
.where('name').caseSensitive().equals('John')

// After
.where('name').ignoreCase(false).equals('John')
```

Conditional helpers:

`IfDefined` means the gated value(s) are neither `null` nor `undefined`.

```typescript
filterIfDefined(expression, param, options?)
filterIfAllDefined(expression, params, options?)
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
// Single-param gating (applies filter only if minPrice is not null/undefined)
.filterIfDefined("price > 100", minPrice)

// Multi-param gating (applies filter only if ALL params are not null/undefined)
.filterIfAllDefined("price > 100 and type == 'Premium'", [minPrice, type])
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
