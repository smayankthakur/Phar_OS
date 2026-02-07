export function getByPath(value: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = value;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
