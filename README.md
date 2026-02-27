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

## Options

### String Matching Options

```typescript
.where('name').equals('john', { ignoreCase: true, trim: true })
.filter('name contains john', { caseSensitive: false, trim: true })
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
