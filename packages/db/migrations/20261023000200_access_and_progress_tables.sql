-- Migration: 20261023000200_access_and_progress_tables
-- Author: BeBranded maintainers
-- Date: 2026-10-23
-- Description: Creates access rules, enrollments and lesson progress
--   (docs/specifications/03-data-model.md and 05-permissions.md).
--   learner_id is the host's opaque identifier: no foreign key.
-- Dependencies: 20261023000100_content_tables
-- Rollback: DROP TABLE lesson_progress, enrollments, access_rules.
--
-- Changes:
--   - tables access_rules, enrollments, lesson_progress, with RLS enabled

CREATE TABLE access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  target_type text NOT NULL CHECK (target_type IN ('course', 'chapter', 'lesson')),
  target_id uuid NOT NULL,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  audience_type text NOT NULL CHECK (audience_type IN ('everyone', 'role', 'grade_min', 'learner')),
  audience_value text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_rules_audience_value CHECK (
    (audience_type = 'everyone' AND audience_value IS NULL)
    -- IS NOT NULL first: a NULL comparison would make the CHECK pass.
    OR (audience_type IN ('role', 'learner') AND audience_value IS NOT NULL AND length(audience_value) BETWEEN 1 AND 255)
    OR (audience_type = 'grade_min' AND audience_value IS NOT NULL AND audience_value ~ '^[0-9]{1,4}$')
  )
);
CREATE INDEX idx_access_rules_target ON access_rules (target_type, target_id);
CREATE INDEX idx_access_rules_tenant_id ON access_rules (tenant_id);
ALTER TABLE access_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_access_rules_updated BEFORE UPDATE ON access_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE access_rules IS 'Audience rules; evaluated by canAccess in elearning-core.';
COMMENT ON COLUMN access_rules.target_id IS 'Course, chapter or lesson id; no FK because the target table varies. Rules are deleted with their target by the storage layer.';
COMMENT ON COLUMN access_rules.audience_value IS 'Role name, minimum grade or learner_id; null for everyone.';

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  learner_id text NOT NULL CHECK (length(learner_id) BETWEEN 1 AND 255),
  source text NOT NULL CHECK (source IN ('self', 'assigned', 'auto')),
  assigned_by text NULL,
  due_at timestamptz NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  progress numeric(5, 4) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_course_learner UNIQUE (course_id, learner_id)
);
CREATE INDEX idx_enrollments_learner ON enrollments (learner_id, course_id);
CREATE INDEX idx_enrollments_tenant_id ON enrollments (tenant_id);
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_enrollments_updated BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN enrollments.progress IS 'Denormalized course progress, recomputed in the same transaction as lesson_progress.';
COMMENT ON COLUMN enrollments.tenant_id IS 'Tenant of the learner (may differ from a shared course).';

CREATE TABLE lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  learner_id text NOT NULL CHECK (length(learner_id) BETWEEN 1 AND 255),
  status text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_lesson_learner UNIQUE (lesson_id, learner_id),
  CONSTRAINT lesson_progress_completed_at CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_lesson_progress_learner ON lesson_progress (learner_id, lesson_id);
CREATE INDEX idx_lesson_progress_course_learner ON lesson_progress (course_id, learner_id);
CREATE INDEX idx_lesson_progress_tenant_id ON lesson_progress (tenant_id);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lesson_progress_updated BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON COLUMN lesson_progress.status IS 'Only moves forward: not_started, in_progress, completed.';
