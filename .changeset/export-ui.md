---
"@bebranded/elearning-react": minor
"@bebranded/elearning-admin": minor
"@bebranded/elearning-server": minor
"@bebranded/elearning-core": minor
---

Download buttons for PDF and Word exports (spec 10). `<ExportActions>` shows one button per format the server offers in the course page and lesson page headers and on the back-office course page; it downloads through the host's `fetcher`, saves the file under the server's name, and explains `export_busy` and `export_too_large`. `ApiLesson` and the admin `ApiCourseTree` answer `export_formats`. The back-office course settings get the "Learners can download this course" checkbox. The React styles import `export.css`.
