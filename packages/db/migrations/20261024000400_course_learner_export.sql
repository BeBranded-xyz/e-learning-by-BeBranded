-- Migration: 20261024000400_course_learner_export
-- Author: BeBranded maintainers
-- Date: 2026-10-24
-- Description: Adds courses.allow_learner_export (docs/specifications/10-editor-extensions.md
--   and 09-roadmap.md, Q12): whether learners may export the course and its
--   lessons to PDF and Word. Off by default; admins can always export.
-- Dependencies: 20261023000100_content_tables
-- Rollback: ALTER TABLE courses DROP COLUMN allow_learner_export.
--
-- Changes:
--   - column courses.allow_learner_export, boolean, default false

ALTER TABLE courses ADD COLUMN allow_learner_export boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN courses.allow_learner_export IS 'Learners may export to PDF and Word; admins always can.';
