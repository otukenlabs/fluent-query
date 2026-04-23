# Development Workflow Rules

## Critical Reminders for Code Changes

### 1. GitHub Fluent-Query-Docs Sync Rule ⚠️

**Whenever you modify code in fluent-query repo, check if fluent-query-docs needs updates.**

#### When to Update Docs:

- **API Changes**: New methods, modified signatures, removed features
- **Behavior Changes**: Different return types, modified filtering logic, coercion behavior
- **Feature Additions**: New numeric-string coercion, new operators, new options
- **Bug Fixes**: If users rely on documented behavior, update docs
- **Code Examples**: If sample code in docs no longer matches implementation

#### Documentation Checklist:

Before committing to fluent-query:
- [ ] Did I add a new method or operator?
- [ ] Did I change how an existing method works?
- [ ] Did I add new coercion logic or special behavior?
- [ ] Are any code examples in fluent-query-docs now outdated?
- [ ] Should I add a note about numeric-string coercion behavior?

#### Examples of Changes Requiring Docs Updates:

✅ Added numeric-string coercion to comparison operators (`>`, `>=`, `<`, `<=`)
- **Action**: Update operator documentation with coercion examples
- **Location**: `fluent-query-docs/comparisons.md` or similar

✅ Modified `whereIn()` behavior with numeric detection
- **Action**: Add note about intelligent numeric detection
- **Location**: `fluent-query-docs/membership-operators.md` or similar

✅ New floating point handling in comparisons
- **Action**: Add floating point examples to comparison docs
- **Location**: Relevant operator documentation

### 2. Before Pushing to Remote:

1. Run full test suite: `bun test`
2. Run TypeScript check: `bunx tsc --noEmit`
3. Review what changed: `git diff`
4. Check if docs need updating
5. If docs changed, reference both repos in commit message

### 3. Commit Message Template for Doc-Related Changes:

```
feat: [feature description]

- Updated fluent-query behavior (numeric-string coercion, new method, etc.)
- Updated fluent-query-docs to reflect changes
- Related files in fluent-query-docs: [list relevant doc files]
```

### 4. Related Repositories:

- **Main Repo**: `https://github.com/otukenlabs/fluent-query`
- **Docs Repo**: `https://github.com/otukenlabs/fluent-query-docs`
- **Current Branch**: `feature/v2.0.0-prep`

---

## Recent Feature Changes (Track These in Docs!)

### Numeric-String Coercion Feature

**What Changed**:
- Filter operators (`>`, `>=`, `<`, `<=`, `==`, `!=`) now support numeric-string coercion
- `whereIn()` and `whereNotIn()` intelligently detect numeric values and apply coercion
- `whereIfDefined()` and conditional variants inherit coercion through delegation

**Documentation Needed**:
- Examples: `equals(100)` matches both `100` and `"100"`, `"100.00"`
- Examples: `greaterThan(100)` matches `"100.01"` but not `"99.99"`
- Examples: `filter('price > 100')` uses $where predicates for coercion
- String-to-string comparisons (`equals("150.00")`) do NOT use coercion (exact match)
- Floating point support: `equals(99.99)` matches `"99.99"` and `99.990`

**Test Coverage**:
- 457 tests passing
- 973 expect() calls
- Edge cases covered (string-to-string, numeric-to-numeric-string, floating point)

---

## Last Updated: 2026-04-23

Changes Made Today:
- Added numeric-string coercion to filter operators
- Added numeric-string coercion to whereIn/whereNotIn
- Added floating point comparison tests
- ALL TESTS PASSING ✅
- ✅ **COMPLETED**: Updated fluent-query-docs with numeric-string coercion examples

### Documentation Updates Made:
- Updated `equals()` and `notEquals()` operators documentation
- Updated `greaterThan()`, `greaterThanOrEqual()`, `lessThan()`, `lessThanOrEqual()` with coercion examples
- Updated `whereIn()` and `whereNotIn()` with intelligent numeric detection notes
- Updated `filter()` method documentation with comparison operator details
- Added floating point support examples throughout
