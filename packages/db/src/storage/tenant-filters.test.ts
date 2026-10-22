import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { describe, expect, it } from "vitest";

import { tenantIdSchema } from "@bebranded/elearning-core";
import type { TenantScope } from "@bebranded/elearning-core";

import { hasChanges, insertedAny, jsonColumn } from "./patch.js";
import { ownedBy, readableContent } from "./tenant-filters.js";

const db = new Kysely<{ courses: { tenant_id: string | null } }>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (kysely) => new PostgresIntrospector(kysely),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const tenant = tenantIdSchema.parse("tenant-a");

function compile(filter: ReturnType<typeof readableContent>) {
  const { sql, parameters } = db.selectFrom("courses").selectAll().where(filter).compile();
  return { where: sql.slice(sql.indexOf("where")), parameters };
}

describe("tenant filters", () => {
  it.each<[string, TenantScope, string, unknown[]]>([
    [
      "single tenant host",
      { tenantId: null, includeShared: false },
      'where "tenant_id" IS NULL',
      [],
    ],
    ["own tenant", { tenantId: tenant, includeShared: false }, 'where "tenant_id" = $1', [tenant]],
    [
      "own tenant and shared catalog",
      { tenantId: tenant, includeShared: true },
      'where ("tenant_id" = $1 OR "tenant_id" IS NULL)',
      [tenant],
    ],
  ])("reads content for a %s", (_label, scope, where, parameters) => {
    expect(compile(readableContent("tenant_id", scope))).toEqual({ where, parameters });
  });

  it("writes only to rows owned by the tenant, never to the shared catalog", () => {
    expect(compile(ownedBy("tenant_id", { tenantId: tenant, includeShared: true }))).toEqual({
      where: 'where "tenant_id" = $1',
      parameters: [tenant],
    });
    expect(compile(ownedBy("tenant_id", { tenantId: null, includeShared: true })).where).toBe(
      'where "tenant_id" IS NULL',
    );
  });

  it("binds the tenant id as a parameter, never inline", () => {
    const hostile = tenantIdSchema.parse("x' OR '1'='1");

    const { where, parameters } = compile(
      readableContent("tenant_id", { tenantId: hostile, includeShared: false }),
    );

    expect(where).not.toContain("OR '1'");
    expect(parameters).toEqual([hostile]);
  });
});

describe("hasChanges", () => {
  it.each([
    [{}, false],
    [{ title: undefined }, false],
    [{ title: "x" }, true],
    [{ summary: null }, true],
    [{ isRequired: false }, true],
  ])("%j gives %s", (patch, expected) => {
    expect(hasChanges(patch)).toBe(expected);
  });
});

describe("insertedAny", () => {
  it.each([
    [1n, true],
    [0n, false],
    [undefined, false],
  ])("%s inserted rows gives %s", (count, expected) => {
    expect(insertedAny({ numInsertedOrUpdatedRows: count })).toBe(expected);
  });
});

describe("jsonColumn", () => {
  it("keeps null as SQL NULL and serializes everything else", () => {
    expect(jsonColumn(null)).toBeNull();
    expect(jsonColumn([{ type: "paragraph" }])).toBe('[{"type":"paragraph"}]');
    expect(jsonColumn({})).toBe("{}");
  });
});
