# Changelog

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
