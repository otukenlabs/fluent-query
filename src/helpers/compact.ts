export type CompactOptions = {
  removeNull?: boolean;
  removeUndefined?: boolean;
  removeEmptyString?: boolean;
  removeNaN?: boolean;
  removeFalse?: boolean;
  removeZero?: boolean;
  removeEmptyArray?: boolean;
  removeEmptyObject?: boolean;
  deep?: boolean;
};

function shouldRemoveScalar(
  value: unknown,
  options: Required<CompactOptions>,
): boolean {
  if (value === null) return options.removeNull;
  if (value === undefined) return options.removeUndefined;
  if (typeof value === "string" && value === "")
    return options.removeEmptyString;
  if (typeof value === "number" && Number.isNaN(value))
    return options.removeNaN;
  if (value === false) return options.removeFalse;
  if (value === 0) return options.removeZero;
  return false;
}

function normalizeOptions(options?: CompactOptions): Required<CompactOptions> {
  return {
    removeNull: options?.removeNull ?? true,
    removeUndefined: options?.removeUndefined ?? true,
    removeEmptyString: options?.removeEmptyString ?? false,
    removeNaN: options?.removeNaN ?? false,
    removeFalse: options?.removeFalse ?? false,
    removeZero: options?.removeZero ?? false,
    removeEmptyArray: options?.removeEmptyArray ?? false,
    removeEmptyObject: options?.removeEmptyObject ?? false,
    deep: options?.deep ?? true,
  };
}

export function compactValue<T>(value: T, options?: CompactOptions): T {
  const resolved = normalizeOptions(options);

  const walk = (input: unknown): unknown => {
    if (shouldRemoveScalar(input, resolved)) {
      return undefined;
    }

    if (Array.isArray(input)) {
      const next = input
        .map((item) => (resolved.deep ? walk(item) : item))
        .filter((item) => item !== undefined);

      if (resolved.removeEmptyArray && next.length === 0) {
        return undefined;
      }

      return next;
    }

    if (input !== null && typeof input === "object") {
      const next: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(
        input as Record<string, unknown>,
      )) {
        const out = resolved.deep ? walk(val) : val;
        if (out !== undefined) {
          next[key] = out;
        }
      }

      if (resolved.removeEmptyObject && Object.keys(next).length === 0) {
        return undefined;
      }

      return next;
    }

    return input;
  };

  return walk(value) as T;
}
