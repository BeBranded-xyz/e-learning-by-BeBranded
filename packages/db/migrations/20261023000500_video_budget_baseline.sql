-- Migration: 20261023000500_video_budget_baseline
-- Author: BeBranded maintainers
-- Date: 2026-10-23
-- Description: Documents the new meaning of video_progress.last_heartbeat_at:
--   the baseline of the time budget, which keeps the time a heartbeat did not
--   use (docs/specifications/06-video.md). Comment only; no data change.
-- Dependencies: 20261023000400_video_tables
-- Rollback: restore the previous comment.
--
-- Changes:
--   - comment on video_progress.last_heartbeat_at

COMMENT ON COLUMN video_progress.last_heartbeat_at IS 'Baseline of the time budget: the last accepted heartbeat, moved back by the time it did not use; null before the first one.';
