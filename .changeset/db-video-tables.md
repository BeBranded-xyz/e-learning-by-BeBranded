---
"@bebranded/elearning-db": minor
"@bebranded/elearning-core": minor
---

Video lessons storage: the `video_assets`, `video_progress` and `video_sessions` tables, and the matching storage methods (`saveVideoAsset`, `applyVideoWebhook`, `acceptVideoHeartbeat`, `lockOrCreateVideoProgress`, `saveVideoProgress`, `findVideoAsset`, `findVideoProgress`). Core gains the video storage port types and `videoAssetIdSchema`.
