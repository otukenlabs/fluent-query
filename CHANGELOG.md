# Changelog

## [2.0.0] - 2026-02-28

### Added

- **Map family**: `map`, `map2`, `mapn` for element-wise transformation (chainable, returns fresh `ArrayQuery`)
- **Reduce/Fold family**: `reduce`/`fold`, `reduce2`/`fold2`, `reducen`/`foldn` for folding arrays into scalar values
- **flatMap**: map each item to zero or more results, then flatten
- **scan**: like reduce but returns all intermediate accumulator values (length n+1)
- **take/drop**: positional sublists from filtered results
- **takeWhile/dropWhile**: predicate-based sublists
- **partition**: split filtered items into `[matching, nonMatching]` tuple of `ArrayQuery`
- **zip/zipWith**: pair or combine items with an external array (truncates to shorter)
- **Assignable lazy chains** via `arrayPipeline()`: reusable, data-independent query composition -- record operations once, replay on any array via `.run(items)`
- `arrayPipeline()` supports all chainable methods (`where`, `whereNot`, `filter`, `sort`, `take`, `drop`, `whereIn`, `whereSift`, `whereAll`, and all `*IfDefined` variants)
- Unbound `where(...)` chains support the same modifiers (`not`, `ignoreCase`, `trim`, `noTrim`) and terminals (`equals`, `contains`, `startsWith`, `endsWith`, `greaterThan`, `lessThan`, etc.) as bound queries
- Type-changing transforms (`map`, `map2`, `mapn`, `flatMap`, `scan`, `zip`, `zipWith`) return a new unbound pipeline with the updated output type
- Pipelines are immutable -- each chained call returns a new instance
- **`.toRecipe()`**: extract a reusable pipeline from any bound chain or `QueryResult`, with optional `stripTerminal` to swap the terminal at deploy time
- **`QueryResult<T>`**: `.all()` now returns a `QueryResult` that extends `Array<T>` — passes `Array.isArray()`, supports indexing/spread/iteration, and exposes `.toRecipe()` for recipe extraction
- **`query(data).run(recipe)`**: apply a recipe (with embedded path) directly to a root object
- **`bound.run(transform)`**: apply a pure pipeline as a post-processing transform on bound query results
- **Conditional terminals in unbound mode**: `.all()`, `.count()`, `.first()`, `.exists()` etc. record themselves as steps when called on an unbound pipeline, so the full chain can be replayed via `.run()`
- **Value type filtering**: added `ValueArrayQuery.ofType(...)` to keep only values of a runtime type (`number`, `string`, `boolean`, `object`, `null`, `array`, etc.) without coercion
- **Value numeric helpers**: added `ValueArrayQuery.abs()`, `ValueArrayQuery.clamp(min, max)`, `ValueArrayQuery.scale(factor)`, `ValueArrayQuery.offset(delta)`, `ValueArrayQuery.round(decimals, { mode })`, and `ValueArrayQuery.roundSignificant(digits, { mode })` for common numeric transforms and configurable rounding (including `halfEven` tie handling)
- Added public path helper `getByPath`.

#### API Inventory (new public methods in `2.0.0`)

- `arrayPipeline()`
- `JsonQueryRoot.run(recipe)`
- `ArrayQuery.toRecipe(stripTerminal?)`
- `QueryResult.toRecipe(stripTerminal?)`
- Conditional filter gates:
  - `filterIfDefined(expression, param, options?)`
  - `filterIfAllDefined(expression, params, options?)`
  - `whereIfDefined(path, value, options?)`
  - `whereNotIfDefined(path, value, options?)`
  - `greaterThanIfDefined(path, value)`
  - `greaterThanOrEqualIfDefined(path, value)`
  - `lessThanIfDefined(path, value)`
  - `lessThanOrEqualIfDefined(path, value)`
  - `containsIfDefined(path, value, options?)`
  - `notContainsIfDefined(path, value, options?)`
  - `startsWithIfDefined(path, value, options?)`
  - `notStartsWithIfDefined(path, value, options?)`
  - `endsWithIfDefined(path, value, options?)`
  - `notEndsWithIfDefined(path, value, options?)`
- `ValueArrayQuery` additions:
  - `ofType(type)`
  - `abs()`
  - `clamp(min, max)`
  - `scale(factor)`
  - `offset(delta)`
  - `round(decimals, { mode? })`
  - `roundSignificant(digits, { mode? })`
- Public helper export: `getByPath`

### Changed

- **Unified ArrayQuery internals**: pipeline implementation is consolidated into a single `ArrayQuery<TItem, TMode>` model parameterized by a phantom type (`'bound'` or `'unbound'`). Since only `1.0.0` was published, this reflects pre-release refactoring and does not remove any npm-published public classes.
- **String matching API standardized**: removed `.caseSensitive()` and use `.ignoreCase(false)` instead across chain methods, options, and examples.
- README path-helper guidance and migration notes were consolidated and clarified.

### Breaking Changes

- Renamed conditional methods (exact mappings):
  - `whereIfPresent` → `whereIfDefined`
  - `whereNotIfPresent` → `whereNotIfDefined`
  - `greaterThanIfPresent` → `greaterThanIfDefined`
  - `greaterThanOrEqualIfPresent` → `greaterThanOrEqualIfDefined`
  - `lessThanIfPresent` → `lessThanIfDefined`
  - `lessThanOrEqualIfPresent` → `lessThanOrEqualIfDefined`
  - `containsIfPresent` → `containsIfDefined`
  - `notContainsIfPresent` → `notContainsIfDefined`
  - `startsWithIfPresent` → `startsWithIfDefined`
  - `notStartsWithIfPresent` → `notStartsWithIfDefined`
  - `endsWithIfPresent` → `endsWithIfDefined`
  - `notEndsWithIfPresent` → `notEndsWithIfDefined`
- Replaced `filterIfPresent(expression, options?)` with:
  - `filterIfDefined(expression, param, options?)`
  - `filterIfAllDefined(expression, params, options?)`
- Removed `.caseSensitive()`; use `.ignoreCase(false)`.
- `pluck()` now retains explicit `undefined` leaf values instead of failing for those leaves.

## [1.0.0] - 2026-02-26

Initial release.

- Fluent query builder for JSON arrays with MongoDB-style filters
- Filter operators: equals, contains, startsWith, endsWith, greaterThan, lessThan, etc.
- Filter expressions with and/or logic
- Selection methods: first, one, random, nth, last, all
- Aggregation: sum, average, min, max, count, distinct, groupBy, sumOfProducts
- Conditional filters: whereIfPresent, filterIfPresent, and variants
- Value extraction: pluck, pick, findAll
- Path and index queries
- Sorting with null handling
