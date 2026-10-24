import type { FileId, LearnerId, TenantId } from "../content/ids.js";
import type { TenantScope } from "./storage.types.js";

/**
 * The host's file storage for editor images and attachments (spec 04,
 * section 4). Files go straight from the browser to `uploadUrl` with an HTTP
 * PUT; the module only keeps the key.
 */
export type FileStorage = {
  createUpload(input: {
    readonly tenantId: TenantId | null;
    readonly mimeType: string;
    readonly sizeBytes: number;
  }): Promise<{ uploadUrl: string; key: string }>;
  getReadUrl(key: string, options: { readonly ttlSeconds: number }): Promise<string>;
  delete(key: string): Promise<void>;
};

/** A file uploaded from the editor (spec 03, `files`). */
export type StoredFile = {
  readonly id: FileId;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: LearnerId;
  readonly createdAt: Date;
};

export type FileStorageReads = {
  /** The files among `ids` the scope can read (the tenant's, plus shared ones with `includeShared`). */
  findFiles(scope: TenantScope, ids: readonly FileId[]): Promise<StoredFile[]>;
};

export type FileStorageWrites = {
  /** Stores the file for the scope's tenant. */
  insertFile(scope: TenantScope, file: StoredFile): Promise<void>;
};
