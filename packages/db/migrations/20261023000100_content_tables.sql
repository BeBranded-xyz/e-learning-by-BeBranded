-- Migration: 20261023000100_content_tables
-- Author: BeBranded maintainers
-- Date: 2026-10-23
-- Description: Creates the content tables (courses, chapters, lessons) of
--   docs/specifications/03-data-model.md. The runner sets search_path to the
--   configured schema, so names are unqualified.
-- Dependencies: none
-- Rollback: DROP TABLE lessons, chapters, courses; DROP FUNCTION set_updated_at.
--
-- Changes:
--   - function set_updated_at, tables courses, chapters, lessons
--   - RLS enabled on every table with no permissive policy: only the owning
--     role used by the module can read or write (spec 05, "RLS")

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION set_updated_at() IS 'Trigger function: sets updated_at to the current time on every update.';

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 100),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary text NULL CHECK (length(summary) <= 2000),
  cover_image_url text NULL CHECK (cover_image_url ~ '^https://'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz NULL,
  completion_rule jsonb NOT NULL DEFAULT '{"type": "all_required_lessons"}',
  enrollment_mode text NOT NULL DEFAULT 'self' CHECK (enrollment_mode IN ('self', 'assignment_only')),
  locale text NOT NULL DEFAULT 'en',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One slug per tenant; coalesce makes the shared catalog (null tenant) one namespace too.
CREATE UNIQUE INDEX idx_courses_tenant_slug ON courses (coalesce(tenant_id, ''), slug);
CREATE INDEX idx_courses_tenant_id ON courses (tenant_id);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE courses IS 'Courses. tenant_id null means single-tenant host or shared catalog.';
COMMENT ON COLUMN courses.completion_rule IS 'When the course counts as completed, e.g. {"type": "all_required_lessons"}.';
COMMENT ON COLUMN courses.enrollment_mode IS 'self: learners enroll themselves; assignment_only: admins assign.';
COMMENT ON COLUMN courses.metadata IS 'Free-form JSON owned by the host product.';

CREATE TABLE chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  position integer NOT NULL CHECK (position >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chapters_course_id ON chapters (course_id, position);
CREATE INDEX idx_chapters_tenant_id ON chapters (tenant_id);
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_chapters_updated BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN chapters.tenant_id IS 'Copy of the course tenant, so every query filters on its own row.';

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  chapter_id uuid NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text', 'video', 'quiz')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  position integer NOT NULL CHECK (position >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_required boolean NOT NULL DEFAULT true,
  estimated_minutes integer NULL CHECK (estimated_minutes BETWEEN 1 AND 10000),
  content jsonb NULL,
  content_schema_version integer NOT NULL DEFAULT 1 CHECK (content_schema_version >= 1),
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lessons_chapter_id ON lessons (chapter_id, position);
CREATE INDEX idx_lessons_course_id ON lessons (course_id);
CREATE INDEX idx_lessons_tenant_id ON lessons (tenant_id);
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN lessons.course_id IS 'Copy of the chapter course, for one-query course trees.';
COMMENT ON COLUMN lessons.content IS 'BlockNote document, validated against the block schema before writing.';
COMMENT ON COLUMN lessons.content_schema_version IS 'Block schema version of content, for future content migrations.';
COMMENT ON COLUMN lessons.settings IS 'Per-type settings, e.g. {"requireScrollToEnd": false} for text lessons.';
