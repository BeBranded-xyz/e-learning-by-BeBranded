---
"@bebranded/elearning-core": minor
"@bebranded/elearning-video": minor
"@bebranded/elearning-server": minor
---

Resumable uploads for large videos. `VideoProvider.createDirectUpload` takes an optional `sizeBytes` and answers the upload `protocol` (`form` or `tus`). The Cloudflare Stream adapter creates a private tus direct creator upload for files over 200 MB, and `POST /v1/admin/videos/uploads` accepts `size_bytes` and answers `upload_protocol`. Custom `VideoProvider` implementations must now return `protocol`.
