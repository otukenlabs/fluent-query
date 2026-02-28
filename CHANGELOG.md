# Changelog

## [2.1.0] - 2026-02-27

### Changed

- **Unified ArrayQuery**: `ArrayPipeline` and `PipelineWhereBuilder` are replaced by a single `ArrayQuery<TItem, TMode>` class parameterized by a phantom type (`'bound'` or `'unbound'`). The public API (`arrayPipeline()`, `.run()`, all chainable methods) is backward-compatible; only the internal type names changed.

### Added

- **`.toRecipe()`**: extract a reusable pipeline from any bound chain or `QueryResult`, with optional `stripTerminal` to swap the terminal at deploy time
- **`QueryResult<T>`**: `.all()` now returns a `QueryResult` that extends `Array<T>` — passes `Array.isArray()`, supports indexing/spread/iteration, and exposes `.toRecipe()` for recipe extraction
- **`query(data).run(recipe)`**: apply a recipe (with embedded path) directly to a root object
- **`bound.run(transform)`**: apply a pure pipeline as a post-processing transform on bound query results
- **Conditional terminals in unbound mode**: `.all()`, `.count()`, `.first()`, `.exists()` etc. record themselves as steps when called on an unbound pipeline, so the full chain can be replayed via `.run()`

### Removed

- `ArrayPipeline` class (replaced by `ArrayQuery<T, 'unbound'>`)
- `PipelineWhereBuilder` class (replaced by `WhereBuilder<T, TMode>`)

## [2.0.0] - 2026-02-26

### Added

- **Assignable lazy chains** via `arrayPipeline()`: reusable, data-independent query composition -- record operations once, replay on any array via `.run(items)`
- `ArrayPipeline` supports all chainable methods (`where`, `whereNot`, `filter`, `sort`, `take`, `drop`, `whereIn`, `whereSift`, `whereAll`, and all `*IfPresent` variants)
- `PipelineWhereBuilder` proxy mirrors `WhereBuilder` modifiers (`not`, `ignoreCase`, `caseSensitive`, `trim`, `noTrim`) and terminals (`equals`, `contains`, `startsWith`, `endsWith`, `greaterThan`, `lessThan`, etc.)
- Type-changing transforms (`map`, `map2`, `mapn`, `flatMap`, `scan`, `zip`, `zipWith`) return a new `ArrayPipeline<TOut>`
- Pipelines are immutable -- each chained call returns a new instance

## [1.1.0] - 2026-02-26

### Added

- **Map family**: `map`, `map2`, `mapn` for element-wise transformation (chainable, returns fresh `ArrayQuery`)
- **Reduce/Fold family**: `reduce`/`fold`, `reduce2`/`fold2`, `reducen`/`foldn` for folding arrays into scalar values
- **flatMap**: map each item to zero or more results, then flatten
- **scan**: like reduce but returns all intermediate accumulator values (length n+1)
- **take/drop**: positional sublists from filtered results
- **takeWhile/dropWhile**: predicate-based sublists
- **partition**: split filtered items into `[matching, nonMatching]` tuple of `ArrayQuery`
- **zip/zipWith**: pair or combine items with an external array (truncates to shorter)

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
