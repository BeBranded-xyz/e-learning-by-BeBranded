-- Migration: 20261024000300_quiz_attempt_grants
-- Author: BeBranded maintainers
-- Date: 2026-10-24
-- Description: Creates quiz_attempt_grants (docs/specifications/03-data-model.md
--   and 07-quizzes.md): extra attempts an admin grants one learner on one quiz
--   lesson, on top of the lesson's maxAttempts. Rows are append-only: each
--   grant records who granted it and when.
-- Dependencies: 20261023000600_quiz_tables
-- Rollback: DROP TABLE quiz_attempt_grants.
--
-- Changes:
--   - table quiz_attempt_grants, with RLS enabled

CREATE TABLE quiz_attempt_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  learner_id text NOT NULL CHECK (length(learner_id) BETWEEN 1 AND 255),
  extra_attempts integer NOT NULL CHECK (extra_attempts BETWEEN 1 AND 100),
  granted_by text NOT NULL CHECK (length(granted_by) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- A learner's standing sums their grants for one lesson.
CREATE INDEX idx_quiz_attempt_grants_learner
  ON quiz_attempt_grants (tenant_id, lesson_id, learner_id);
CREATE INDEX idx_quiz_attempt_grants_lesson_id ON quiz_attempt_grants (lesson_id);
ALTER TABLE quiz_attempt_grants ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE quiz_attempt_grants IS 'Extra quiz attempts granted by an admin; append-only.';
COMMENT ON COLUMN quiz_attempt_grants.tenant_id IS 'Tenant of the admin and the learner (the lesson may be shared).';
COMMENT ON COLUMN quiz_attempt_grants.granted_by IS 'learner_id of the admin who granted the attempts.';
