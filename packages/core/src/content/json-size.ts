/** Deepest JSON nesting accepted anywhere in a document (blocks, props, inline content). */
export const MAX_JSON_NESTING = 64;

export type JsonSizeCheck =
  | { readonly kind: "ok"; readonly bytes: number }
  | { readonly kind: "too_large" }
  | { readonly kind: "too_deep" };

const encoder = new TextEncoder();

/**
 * Exact UTF-8 size of a scalar as JSON writes it, escapes included (a control
 * character takes 6 bytes). Stringifying one scalar is linear and cannot recurse.
 */
function scalarSize(value: unknown): number {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return encoder.encode(JSON.stringify(value)).length;
  return 4; // null, and anything JSON would write as null
}

/**
 * Approximate JSON size of `value`, computed iteratively: unlike
 * `JSON.stringify`, a hostile, deeply nested input cannot overflow the stack.
 * Stops as soon as a limit is exceeded.
 */
export function measureJson(value: unknown, maxBytes: number): JsonSizeCheck {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let bytes = 0;
  for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
    if (current.depth > MAX_JSON_NESTING) return { kind: "too_deep" };
    if (typeof current.value === "object" && current.value !== null) {
      const entries = Array.isArray(current.value) ? current.value : Object.entries(current.value);
      bytes += 2 + entries.length;
      for (const entry of entries) stack.push({ value: entry, depth: current.depth + 1 });
    } else {
      bytes += scalarSize(current.value);
    }
    if (bytes > maxBytes) return { kind: "too_large" };
  }
  return { kind: "ok", bytes };
}
