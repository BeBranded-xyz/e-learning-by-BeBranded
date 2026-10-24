import type { FileStorage } from "@bebranded/elearning-core";

/** An in-memory FileStorage: keys are counted, read URLs are fake signed URLs. */
export function fakeFileStorage(options: { failReads?: boolean } = {}) {
  const uploads: { tenantId: string | null; mimeType: string; sizeBytes: number }[] = [];
  const reads: { key: string; ttlSeconds: number }[] = [];
  const storage: FileStorage = {
    createUpload: (input) => {
      uploads.push(input);
      const key = `uploads/${uploads.length}`;
      return Promise.resolve({ uploadUrl: `https://files.example.com/${key}?put=1`, key });
    },
    getReadUrl: (key, { ttlSeconds }) => {
      reads.push({ key, ttlSeconds });
      if (options.failReads === true) return Promise.reject(new Error("storage down"));
      return Promise.resolve(`https://files.example.com/${key}?sig=read`);
    },
    delete: () => Promise.resolve(),
  };
  return { storage, uploads, reads };
}
