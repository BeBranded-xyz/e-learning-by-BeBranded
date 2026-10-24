-- Migration: 20261024000200_files
-- Author: BeBranded maintainers
-- Date: 2026-10-24
-- Description: Creates the files table (docs/specifications/03-data-model.md):
--   images and attachments uploaded from the lesson editor through the host's
--   FileStorage port. Only the storage key is kept; lesson documents point to
--   a file as elearning-file:<id>.
-- Dependencies: 20261023000100_content_tables
-- Rollback: DROP TABLE files.
--
-- Changes:
--   - table files, with RLS enabled

CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  storage_key text NOT NULL CHECK (length(storage_key) BETWEEN 1 AND 1024),
  mime_type text NOT NULL CHECK (mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  uploaded_by text NOT NULL CHECK (length(uploaded_by) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_files_storage_key ON files (storage_key);
CREATE INDEX idx_files_tenant_id ON files (tenant_id);
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE files IS 'Editor images and attachments; the bytes live in the host''s file storage.';
COMMENT ON COLUMN files.tenant_id IS 'Tenant of the admin who uploaded the file; null for the shared catalog.';
COMMENT ON COLUMN files.storage_key IS 'Key returned by the host''s FileStorage.createUpload.';
COMMENT ON COLUMN files.uploaded_by IS 'learner_id of the admin who uploaded the file.';
