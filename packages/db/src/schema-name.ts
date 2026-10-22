import { AppError } from "@bebranded/elearning-core";

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * The schema name is an SQL identifier, so it cannot be a bind parameter. It
 * is validated against a strict pattern and always quoted by Kysely.
 */
export function assertSchemaName(schema: string): string {
  if (!SCHEMA_NAME.test(schema)) {
    throw new AppError(
      "validation",
      "invalid_schema_name",
      "The schema name must use lowercase letters, digits and underscores (max 63 characters)",
    );
  }
  return schema;
}

export const DEFAULT_SCHEMA = "elearning";
