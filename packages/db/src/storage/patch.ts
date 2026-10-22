/** An update with no defined field would be invalid SQL; callers skip it. */
export function hasChanges(patch: object): boolean {
  return Object.values(patch).some((value) => value !== undefined);
}

/** Kysely reports inserted rows as `bigint | undefined` (undefined on drivers that do not count). */
export function insertedAny(result: { numInsertedOrUpdatedRows: bigint | undefined }): boolean {
  return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
}

/** A jsonb column value: SQL NULL stays NULL, anything else is serialized. */
export function jsonColumn(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}
