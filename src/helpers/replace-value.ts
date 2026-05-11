import type { ReplaceRule, ReplaceValueOptions } from "../types";

export type ReplaceScope = "top-level" | "deep";

type NormalizedKeySelection = {
  mode: "include" | "exclude";
  keys: Set<string>;
};

const isMatch = (value: unknown, fromValue: unknown): boolean =>
  Object.is(value, fromValue);

export function replaceValueByScope(
  input: unknown,
  fromValue: unknown,
  toValue: unknown,
  options?: ReplaceValueOptions,
): unknown {
  const scope: ReplaceScope = options?.scope ?? "deep";
  const keySelection = normalizeKeySelection(options?.keySelection);

  if (scope === "top-level") {
    return replaceTopLevel(input, fromValue, toValue, keySelection);
  }
  return replaceDeep(input, fromValue, toValue, keySelection);
}

export function replaceManyByScope(
  input: unknown,
  rules: ReadonlyArray<ReplaceRule>,
  options?: ReplaceValueOptions,
): unknown {
  if (rules.length === 0) {
    return input;
  }

  return rules.reduce(
    (current, rule) =>
      replaceValueByScope(current, rule.from, rule.to, options),
    input,
  );
}

function replaceTopLevel(
  input: unknown,
  fromValue: unknown,
  toValue: unknown,
  keySelection?: NormalizedKeySelection,
): unknown {
  if (!keySelection && isMatch(input, fromValue)) {
    return toValue;
  }

  if (Array.isArray(input)) {
    if (keySelection) {
      return input;
    }

    let changed = false;
    const next = input.map((item) => {
      if (isMatch(item, fromValue)) {
        changed = true;
        return toValue;
      }
      return item;
    });
    return changed ? next : input;
  }

  if (input !== null && typeof input === "object") {
    const record = input as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (isKeySelected(key, keySelection) && isMatch(value, fromValue)) {
        changed = true;
        next[key] = toValue;
      } else {
        next[key] = value;
      }
    }
    return changed ? next : input;
  }

  return input;
}

function replaceDeep(
  input: unknown,
  fromValue: unknown,
  toValue: unknown,
  keySelection?: NormalizedKeySelection,
  allowPrimitiveReplace = !keySelection,
): unknown {
  if (allowPrimitiveReplace && isMatch(input, fromValue)) {
    return toValue;
  }

  if (Array.isArray(input)) {
    let changed = false;
    const next = input.map((item) => {
      const replaced = replaceDeep(
        item,
        fromValue,
        toValue,
        keySelection,
        allowPrimitiveReplace,
      );
      if (replaced !== item) {
        changed = true;
      }
      return replaced;
    });
    return changed ? next : input;
  }

  if (input !== null && typeof input === "object") {
    const record = input as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const replaced = replaceDeep(
        value,
        fromValue,
        toValue,
        keySelection,
        isKeySelected(key, keySelection),
      );
      if (replaced !== value) {
        changed = true;
      }
      next[key] = replaced;
    }
    return changed ? next : input;
  }

  return input;
}

function normalizeKeySelection(
  keySelection: ReplaceValueOptions["keySelection"],
): NormalizedKeySelection | undefined {
  if (!keySelection) {
    return undefined;
  }

  const keys = keySelection.keys
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (keys.length === 0) {
    throw new Error(
      "replaceValue() keySelection.keys must include at least one key",
    );
  }

  return {
    mode: keySelection.mode,
    keys: new Set(keys),
  };
}

function isKeySelected(
  key: string,
  keySelection?: NormalizedKeySelection,
): boolean {
  if (!keySelection) {
    return true;
  }

  const has = keySelection.keys.has(key);
  return keySelection.mode === "include" ? has : !has;
}
