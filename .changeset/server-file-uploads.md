---
"@bebranded/elearning-server": minor
---

Editor file uploads. `createElearning` takes `files` (the host's `FileStorage`) and `fileUploads` (`mimeTypes`, PNG, JPEG, GIF, WebP and PDF by default, and `maxBytes`, 10 MB by default). `POST /v1/admin/files/uploads` answers a PUT upload URL after checking the type (415 `file_type_not_allowed`) and size (413 `file_too_large`), and `GET /v1/admin/files/:id` a signed read URL. Lessons and quizzes pointing to a file the tenant did not upload are refused (`unknown_file`). Learner lessons and quiz surveys render uploaded images and files with one-hour signed URLs.
