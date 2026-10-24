import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fileIdSchema } from "@bebranded/elearning-core";
import type { StoredFile, TenantScope } from "@bebranded/elearning-core";

import { learner, tenantA, tenantB } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

const shared: TenantScope = { tenantId: null, includeShared: false };
const tenantAWithShared: TenantScope = { ...tenantA, includeShared: true };

function aFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: fileIdSchema.parse(randomUUID()),
    storageKey: `uploads/${randomUUID()}.png`,
    mimeType: "image/png",
    sizeBytes: 2_048,
    uploadedBy: learner,
    createdAt: new Date("2026-10-24T08:00:00.000Z"),
    ...overrides,
  };
}

async function stored(scope: TenantScope, file = aFile()): Promise<StoredFile> {
  await database.storage.transaction((tx) => tx.insertFile(scope, file));
  return file;
}

describe("insertFile and findFiles", () => {
  it("stores a file and reads it back", async () => {
    const file = await stored(tenantA, aFile({ sizeBytes: 5_000_000_000 }));

    expect(await database.storage.findFiles(tenantA, [file.id])).toEqual([file]);
  });

  it("answers nothing for an empty id list", async () => {
    expect(await database.storage.findFiles(tenantA, [])).toEqual([]);
  });

  it("returns only the files that exist among the ids", async () => {
    const file = await stored(tenantA);
    const missing = fileIdSchema.parse(randomUUID());

    expect(await database.storage.findFiles(tenantA, [file.id, missing])).toEqual([file]);
  });

  it("never returns another tenant's file", async () => {
    const file = await stored(tenantB);

    expect(await database.storage.findFiles(tenantA, [file.id])).toEqual([]);
    expect(await database.storage.findFiles(tenantAWithShared, [file.id])).toEqual([]);
  });

  it("returns shared files only to a scope that includes the shared catalog", async () => {
    const file = await stored(shared);

    expect(await database.storage.findFiles(tenantA, [file.id])).toEqual([]);
    expect(await database.storage.findFiles(tenantAWithShared, [file.id])).toEqual([file]);
    expect(await database.storage.findFiles(shared, [file.id])).toEqual([file]);
  });

  it("does not show a tenant's file to the shared scope", async () => {
    const file = await stored(tenantA);

    expect(await database.storage.findFiles(shared, [file.id])).toEqual([]);
  });
});

describe("files constraints", () => {
  it("refuses two files with the same storage key", async () => {
    const file = await stored(tenantA);

    await expect(stored(tenantB, aFile({ storageKey: file.storageKey }))).rejects.toThrow(
      /idx_files_storage_key/,
    );
  });

  it.each([
    ["an empty size", { sizeBytes: 0 }],
    ["a malformed mime type", { mimeType: "image/png; charset=x" }],
    ["an uppercase mime type", { mimeType: "IMAGE/PNG" }],
    ["an empty storage key", { storageKey: "" }],
  ])("refuses %s", async (_label, overrides) => {
    await expect(stored(tenantA, aFile(overrides))).rejects.toThrow(/files/);
  });
});
