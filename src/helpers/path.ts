/**
 * @file helpers/path.ts
 * @description Utilities for safe nested path access using dot-notation.
 */

/**
 * Safely retrieves a nested value from an object using dot-path notation.
 * Supports array indices via bracket notation (e.g., "elements[2]").
 * Preserves explicit `undefined` at the final leaf when the property exists,
 * unless `strict` is enabled, in which case a resolved `undefined` value throws.
 *
 * @example
 * ```ts
 * const value = getByPath({ a: { b: { c: 1 } } }, 'a.b.c'); // 1
 * const arrayItem = getByPath({ items: [1, 2, 3] }, 'items[1]'); // 2
 * getByPath({ a: { b: undefined } }, 'a.b'); // undefined
 * getByPath({ a: { b: undefined } }, 'a.b', true); // throws error
 * getByPath({ a: {} }, 'a.b.c'); // throws error
 * ```
 *
 * @param obj - The object to read from.
 * @param path - Dot-separated path with optional bracket indices (e.g., `"customer.relationship.description"` or `"items[0].name"`).
 * @param strict - When `true`, throws if the resolved value is `undefined`.
 * @returns The value at that path.
 * @throws Error if the path doesn't exist or is non-traversable.
 */
export function getByPath(obj: unknown, path: string, strict = false): any {
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
      if (strict && current === undefined) {
        throw new Error(
          `Path "${path}" does not exist: index ${indexStr} resolved to undefined.`,
        );
      }
      continue;
    }

    if (!Object.hasOwn(current as object, segment)) {
      throw new Error(
        `Path "${path}" does not exist: property "${segment}" not found.`,
      );
    }

    current = (current as any)[segment];
    if (strict && current === undefined) {
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
