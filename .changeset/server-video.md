---
"@bebranded/elearning-server": minor
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": patch
---

Video lessons in the API: the `video` option takes a `VideoProvider`; `GET /v1/lessons/:id` returns the video with a signed playback URL and the learner's progress; `POST /v1/lessons/:id/video-progress` verifies heartbeats and completes the lesson at its threshold; admins create video lessons, get direct upload URLs from `POST /v1/admin/videos/uploads`, and can publish a video lesson only once its video is ready; `POST /v1/webhooks/video` applies the provider's signed webhooks. Lesson settings are validated against the lesson type. The db adapter no longer lets a late webhook move a ready video back to processing.
