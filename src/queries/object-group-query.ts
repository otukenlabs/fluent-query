/**
 * @file queries/object-group-query.ts
 * @description ObjectGroupQuery helper for selecting child objects under a "groups" object.
 */

import { ArrayQuery } from "../core/array-query";
import { getByPath } from "../helpers/path";
import type { GroupItemMetadata } from "../types";

/**
 * Helper for selecting child objects under a "groups" object.
 */
export class ObjectGroupQuery {
  private includeKeys?: Set<string>;
  private excludeKeys?: Set<string>;

  constructor(
    private readonly groups: Record<string, unknown>,
    private readonly groupsRootPath?: string,
  ) {}

  /** Include only the given group keys. */
  include(keys: string[]): this {
    this.includeKeys = new Set(keys);
    return this;
  }

  /** Exclude the given group keys. */
  exclude(keys: string[]): this {
    this.excludeKeys = new Set(keys);
    return this;
  }

  /** Returns the filtered group entries. */
  entries(): Array<[string, any]> {
    return Object.entries(this.groups).filter(([key]) => {
      if (this.includeKeys && !this.includeKeys.has(key)) return false;
      if (this.excludeKeys?.has(key)) return false;
      return true;
    });
  }

  /** Returns the filtered group values. */
  values(): any[] {
    return this.entries().map(([, value]) => value);
  }

  /**
   * Returns a flattened array from each group value at `arrayPath`.
   * Throws if any group value doesn't contain an array at the path.
   */
  flatArray<TItem = any>(arrayPath: string): TItem[] {
    const results: TItem[] = [];
    for (const [key, value] of this.entries()) {
      const arr = getByPath(value as any, arrayPath);
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected array at path "${arrayPath}" in group "${key}".`,
        );
      }
      results.push(...(arr as TItem[]));
    }
    return results;
  }

  /**
   * Returns flattened array items alongside metadata about their source group and index.
   * @private
   */
  private flatArrayWithMetadata<TItem = any>(
    arrayPath: string,
  ): Array<[TItem, GroupItemMetadata]> {
    const results: Array<[TItem, GroupItemMetadata]> = [];
    for (const [key, value] of this.entries()) {
      const arr = getByPath(value as any, arrayPath);
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected array at path "${arrayPath}" in group "${key}".`,
        );
      }
      arr.forEach((item, index) => {
        results.push([item, { groupKey: key, itemIndex: index }]);
      });
    }
    return results;
  }

  /**
   * Returns an ArrayQuery for the flattened array at `arrayPath`.
   * Useful for chaining `.where(...)` filters.
   *
   * @example
   * ```ts
   * const active = query(resp)
   * .objectGroups('sections')
   * .exclude(['archived', 'pending'])
   * .arrays('items')
   * .where('attributes.visible.value')
   * .equals(true)
   * .all();
   * ```
   */
  arrays<TItem = any>(arrayPath: string): ArrayQuery<TItem, "bound"> {
    const items = this.flatArray<TItem>(arrayPath);
    const metadata = this.flatArrayWithMetadata<TItem>(arrayPath).map(
      ([, m]) => m,
    );
    return ArrayQuery._bound<TItem>(items, {
      groupsRootPath: this.groupsRootPath,
      arrayPath,
      itemMetadata: metadata,
    });
  }

  /** Returns a random [key, value] entry. Throws if no groups match. */
  randomEntry(): [string, any] {
    const entries = this.entries();
    if (entries.length === 0) {
      throw new Error("No group entries found for randomEntry().");
    }
    const index = Math.floor(Math.random() * entries.length);
    return [entries[index][0], entries[index][1]];
  }

  /** Returns a random group value. Throws if no groups match. */
  randomValue(): any {
    const [, value] = this.randomEntry();
    return value;
  }
}
