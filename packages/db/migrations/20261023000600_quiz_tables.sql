-- Migration: 20261023000600_quiz_tables
-- Author: BeBranded maintainers
-- Date: 2026-10-23
-- Description: Creates quizzes (the editor document and its graded definition)
--   and learners' quiz attempts (docs/specifications/03-data-model.md and
--   07-quizzes.md). Attempts hang off lesson_progress, so they are deleted with it.
-- Dependencies: 20261023000200_access_and_progress_tables
-- Rollback: DROP TABLE quiz_attempts, quizzes.
--
-- Changes:
--   - tables quizzes, quiz_attempts, with RLS enabled
--   - partial unique index: at most one open attempt per learner's lesson

CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL,
  lesson_id uuid NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  editor_document jsonb NOT NULL CHECK (jsonb_typeof(editor_document) = 'array'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  version text NOT NULL CHECK (version ~ '^[0-9a-f]{64}$'),
  question_count integer NOT NULL CHECK (question_count BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quizzes_lesson_id_key UNIQUE (lesson_id)
);
CREATE INDEX idx_quizzes_tenant_id ON quizzes (tenant_id);
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_quizzes_updated BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE quizzes IS 'One quiz per quiz lesson. The definition holds the correct answers: never sent to learners.';
COMMENT ON COLUMN quizzes.tenant_id IS 'Copy of the lesson tenant.';
COMMENT ON COLUMN quizzes.editor_document IS 'BlockNote document of the quiz editor, the source of the definition.';
COMMENT ON COLUMN quizzes.definition IS 'Graded definition derived from the editor document on save (editorDocumentToQuiz).';
COMMENT ON COLUMN quizzes.version IS 'SHA-256 of the definition; attempts store the version they were opened with.';

CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_progress_id uuid NOT NULL REFERENCES lesson_progress (id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  tenant_id text NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  status text NOT NULL CHECK (status IN ('open', 'submitted', 'expired', 'voided')),
  quiz_version text NOT NULL CHECK (quiz_version ~ '^[0-9a-f]{64}$'),
  shuffle_seed bigint NOT NULL CHECK (shuffle_seed BETWEEN 0 AND 4294967295),
  started_at timestamptz NOT NULL,
  expires_at timestamptz NULL CHECK (expires_at > started_at),
  closed_at timestamptz NULL CHECK (closed_at >= started_at),
  answers jsonb NULL CHECK (jsonb_typeof(answers) = 'object'),
  question_results jsonb NULL CHECK (jsonb_typeof(question_results) = 'array'),
  score numeric NULL CHECK (score BETWEEN 0 AND 1),
  passed boolean NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempts_open_unclosed CHECK ((status = 'open') = (closed_at IS NULL)),
  CONSTRAINT quiz_attempts_graded CHECK (
    (status IN ('submitted', 'expired')) = (score IS NOT NULL AND passed IS NOT NULL)
  )
);
CREATE UNIQUE INDEX idx_quiz_attempts_one_open ON quiz_attempts (lesson_progress_id)
  WHERE status = 'open';
CREATE INDEX idx_quiz_attempts_lesson_progress ON quiz_attempts (lesson_progress_id, started_at);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts (quiz_id);
CREATE INDEX idx_quiz_attempts_tenant_id ON quiz_attempts (tenant_id);
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_quiz_attempts_updated BEFORE UPDATE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMENT ON TABLE quiz_attempts IS 'Every attempt is kept, for the best score and for reporting.';
COMMENT ON COLUMN quiz_attempts.tenant_id IS 'Tenant of the learner, as on lesson_progress.';
COMMENT ON COLUMN quiz_attempts.status IS 'open; submitted (graded); expired (past the time limit, score 0); voided (the quiz changed while open, does not count).';
COMMENT ON COLUMN quiz_attempts.shuffle_seed IS 'Rebuilds the order of questions and options the learner saw.';
COMMENT ON COLUMN quiz_attempts.expires_at IS 'Null without a time limit.';
COMMENT ON COLUMN quiz_attempts.closed_at IS 'When the attempt was submitted, expired or voided; null while open.';
COMMENT ON COLUMN quiz_attempts.answers IS 'Raw answers as submitted; null until submitted.';
COMMENT ON COLUMN quiz_attempts.question_results IS 'Points earned per question; null until graded.';
COMMENT ON COLUMN quiz_attempts.score IS 'Between 0 and 1; null while open or voided.';
