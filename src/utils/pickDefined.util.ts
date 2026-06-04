/**
 * Returns a new object containing only the entries of `input` whose value is
 * not `undefined`, typed as `T`. Use to build partial update / create payloads
 * from a validated request body without per-field `if (x !== undefined)` chains.
 */
export function pickDefined<T>(input: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
}
