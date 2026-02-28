/**
 * @file helpers/path.ts
 * @description Utilities for safe nested path access using dot-notation.
 */

/**
 * Safely retrieves a nested value from an object using dot-path notation.
 * Supports array indices via bracket notation (e.g., "elements[2]").
 * Preserves explicit `undefined` at the final leaf when the property exists.
 * Throws an error only for missing/non-traversable path segments.
 *
 * @example
 * ```ts
 * const value = getByPath({ a: { b: { c: 1 } } }, 'a.b.c'); // 1
 * const arrayItem = getByPath({ items: [1, 2, 3] }, 'items[1]'); // 2
 * getByPath({ a: { b: undefined } }, 'a.b'); // undefined
 * getByPath({ a: {} }, 'a.b.c'); // throws error
 * ```
 *
 * @param obj - The object to read from.
 * @param path - Dot-separated path with optional bracket indices (e.g., `"customer.relationship.description"` or `"items[0].name"`).
 * @returns The value at that path.
 * @throws Error if the path doesn't exist or is non-traversable.
 */
export function getByPath(obj: unknown, path: string): any {
  if (!path) return obj;

  const segments = path.split(".");
  let current = obj;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];

    if (current == null) {
      throw new Error(
        `Path "${path}" does not exist: null/undefined at "${segment}".`,
      );
    }

    // Check for array bracket notation: "items[0]" → ["items", "0"]
    const bracketMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    if (bracketMatch) {
      const [, key, index] = bracketMatch;
      current = (current as any)[key];
      if (current == null) {
        throw new Error(
          `Path "${path}" does not exist: null/undefined at "${key}".`,
        );
      }
      if (!Array.isArray(current)) {
        throw new Error(
          `Path "${path}" does not exist: "${key}" is not an array.`,
        );
      }

      const parsedIndex = parseInt(index, 10);
      if (parsedIndex < 0 || parsedIndex >= current.length) {
        throw new Error(
          `Path "${path}" does not exist: index ${index} out of bounds.`,
        );
      }

      current = current[parsedIndex];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current as object, segment)) {
        throw new Error(
          `Path "${path}" does not exist: property "${segment}" not found.`,
        );
      }

      current = (current as any)[segment];
    }
  }

  return current;
}

/**
 * Strict nested path accessor.
 *
 * Throws when the path doesn't exist or when the resolved value is `undefined`.
 * This preserves historical fail-fast semantics used internally by query methods.
 *
 * @internal
 */
export function getByPathStrict(obj: unknown, path: string): any {
  if (!path) return obj;

  const segments = path.split(".");
  let current = obj;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];

    if (current == null) {
      throw new Error(
        `Path "${path}" does not exist: null/undefined at "${segment}".`,
      );
    }

    const bracketMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    if (bracketMatch) {
      const [, key, indexStr] = bracketMatch;
      const collection = (current as any)[key];
      if (collection == null) {
        throw new Error(
          `Path "${path}" does not exist: null/undefined at "${key}".`,
        );
      }
      if (!Array.isArray(collection)) {
        throw new Error(
          `Path "${path}" does not exist: "${key}" is not an array.`,
        );
      }

      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= collection.length) {
        throw new Error(
          `Path "${path}" does not exist: index ${indexStr} out of bounds.`,
        );
      }

      current = collection[index];
      if (current === undefined) {
        throw new Error(
          `Path "${path}" does not exist: index ${indexStr} out of bounds.`,
        );
      }
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(current as object, segment)) {
      throw new Error(
        `Path "${path}" does not exist: property "${segment}" not found.`,
      );
    }

    current = (current as any)[segment];
    if (current === undefined) {
      throw new Error(
        `Path "${path}" does not exist: property "${segment}" not found.`,
      );
    }
  }

  return current;
}

/**
 * Returns path segments without array indices.
 * Example: "sections.active.items[10]" -> ["sections", "active", "items"].
 */
export function getPathSegments(path: string): string[] {
  if (!path) return [];
  return path.split(".").map((segment) => {
    const bracketMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    return bracketMatch ? bracketMatch[1] : segment;
  });
}

/**
 * Returns the segment that appears immediately after the given prefix path.
 * Throws if the prefix is not found or there is no next segment.
 *
 * @example
 * ```ts
 * getPathSegmentAfter("sections.active.items[10]", "sections");
 * // => "active"
 * ```
 */
export function getPathSegmentAfter(path: string, prefix: string): string {
  const segments = getPathSegments(path);
  const prefixSegments = getPathSegments(prefix);

  if (prefixSegments.length === 0) {
    throw new Error("Prefix path is required.");
  }

  for (let i = 0; i <= segments.length - prefixSegments.length - 1; i += 1) {
    const window = segments.slice(i, i + prefixSegments.length);
    const matches = window.every((seg, idx) => seg === prefixSegments[idx]);
    if (matches) {
      return segments[i + prefixSegments.length];
    }
  }

  throw new Error(`Prefix path "${prefix}" not found in "${path}".`);
}
