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
