export type PathToken =
  | { kind: "prop"; key: string }
  | { kind: "index"; index: number };

export function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function tokenizePath(path: string, methodName: string): PathToken[] {
  if (!path || !path.trim()) {
    throw new Error(`${methodName}() requires a non-empty path.`);
  }

  const tokens: PathToken[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(path)) !== null) {
    if (match[1]) {
      tokens.push({ kind: "prop", key: match[1] });
    } else if (match[2]) {
      tokens.push({ kind: "index", index: Number(match[2]) });
    }
  }

  if (tokens.length === 0) {
    throw new Error(`${methodName}() could not parse path: "${path}".`);
  }

  return tokens;
}

export function ensureTopLevelPath(path: string, methodName: string): void {
  if (!path || !path.trim()) {
    throw new Error(`${methodName}() requires a non-empty path.`);
  }
  if (path.includes(".") || path.includes("[") || path.includes("]")) {
    throw new Error(
      `${methodName}() only supports top-level keys. Received "${path}".`,
    );
  }
}
