-- Migration: 20261024000100_course_assignments
-- Author: BeBranded maintainers
-- Date: 2026-10-24
-- Description: Creates course assignments (docs/specifications/03-data-model.md
--   and 05-permissions.md): an admin assigns a course to a learner, a role or
--   a minimum grade, with an optional due date. Matching learners get an
--   enrollment on their next visit.
-- Dependencies: 20261023000100_content_tables
-- Rollback: DROP TABLE course_assignments.
--
-- Changes:
--   - table course_assignments, with RLS enabled

CREATE TABLE course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  audience_type text NOT NULL CHECK (audience_type IN ('role', 'grade_min', 'learner')),
  audience_value text NOT NULL,
  due_at timestamptz NULL,
  assigned_by text NOT NULL CHECK (length(assigned_by) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_assignments_audience_value CHECK (
    (audience_type IN ('role', 'learner') AND length(audience_value) BETWEEN 1 AND 255)
    OR (audience_type = 'grade_min' AND audience_value ~ '^[0-9]{1,4}$')
  )
);
-- One assignment per audience and course; coalesce makes a null tenant one namespace too.
CREATE UNIQUE INDEX idx_course_assignments_audience
  ON course_assignments (coalesce(tenant_id, ''), course_id, audience_type, audience_value);
CREATE INDEX idx_course_assignments_course_id ON course_assignments (course_id);
-- A learner's visit looks up the assignments of their id, roles and grade.
CREATE INDEX idx_course_assignments_lookup
  ON course_assignments (tenant_id, audience_type, audience_value);
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_course_assignments_updated BEFORE UPDATE ON course_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE course_assignments IS 'Courses assigned by an admin; turned into enrollments on the learner''s next visit.';
COMMENT ON COLUMN course_assignments.tenant_id IS 'Tenant of the admin and the assigned learners (the course may be shared).';
COMMENT ON COLUMN course_assignments.audience_value IS 'Role name, minimum grade or learner_id.';
COMMENT ON COLUMN course_assignments.due_at IS 'Copied to the enrollments it creates; null without a due date.';
COMMENT ON COLUMN course_assignments.assigned_by IS 'learner_id of the admin who assigned the course last.';
