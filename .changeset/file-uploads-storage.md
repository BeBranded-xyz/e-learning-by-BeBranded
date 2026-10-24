---
"@bebranded/elearning-core": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-editor": minor
"@bebranded/elearning-react": minor
---

Uploaded images and attachments in lessons. Lesson documents accept `image` and `file` blocks that point to a file uploaded through the module (`elearning-file:<id>`); external and `data:` URLs stay rejected. Core adds the `FileStorage` port, `StoredFile`, `fileIdSchema`, `collectFileIds` and `fileIdFromUrl`; the db package adds the `files` table with `insertFile` and `findFiles`; `renderLessonHtml` takes a `fileUrl` resolver and renders figures and download links; the content stylesheet styles them.
