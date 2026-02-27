/**
 * @file core/query-result.ts
 * @description QueryResult extends Array and adds .toRecipe() for recipe extraction.
 */

import type { PipelineStep } from "./pipeline-step";

// Forward reference -- resolved at runtime to avoid circular init.
let _ArrayQuery: any;

/** @internal Called by ArrayQuery to register itself. */
export function _setArrayQueryRef(ref: any): void {
  _ArrayQuery = ref;
}

/**
 * An array subclass returned by bound-mode terminal `.all()`.
 * Passes `Array.isArray()`, supports indexing, `.length`, `.map()`, etc.
 * Also exposes `.toRecipe()` for extracting a reusable pipeline.
 */
export class QueryResult<T> extends Array<T> {
  /** @internal */ declare private readonly _steps: PipelineStep[];
  /** @internal */ declare private readonly _arrayPath: string | undefined;

  private constructor(
    items: T[],
    steps: PipelineStep[],
    arrayPath: string | undefined,
  ) {
    super(0);
    Object.setPrototypeOf(this, QueryResult.prototype);
    // Avoid super(...items) which breaks when items = [n] (single number)
    this.length = 0;
    for (let i = 0; i < items.length; i++) {
      this.push(items[i]);
    }
    Object.defineProperty(this, "_steps", {
      value: steps,
      enumerable: false,
      writable: false,
    });
    Object.defineProperty(this, "_arrayPath", {
      value: arrayPath,
      enumerable: false,
      writable: false,
    });
  }

  static create<T>(
    items: T[],
    steps: PipelineStep[],
    arrayPath?: string,
  ): QueryResult<T> {
    return new QueryResult<T>(items, steps, arrayPath);
  }

  /**
   * Extracts a reusable pipeline (unbound ArrayQuery) from this result.
   *
   * @param stripTerminal - If true, removes the last step (the terminal)
   *   so the caller can pick a different terminal at deploy time.
   */
  toRecipe(stripTerminal?: boolean): any {
    const steps =
      stripTerminal && this._steps.length > 0
        ? this._steps.slice(0, -1)
        : [...this._steps];
    return _ArrayQuery._fromSteps(steps, this._arrayPath);
  }
}
