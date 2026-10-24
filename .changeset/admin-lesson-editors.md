---
"@bebranded/elearning-admin": minor
---

Lesson editors in the back-office. `LessonAdmin` edits a lesson's settings, publication and access rules, then its content: a BlockNote editor (Mantine UI kit) for text lessons with image and file uploads through the module, a slash menu without what the server rejects; a video uploader that posts small files and uploads files over 200 MB with resumable tus, follows the video until it is ready and warns when it has no captions; and the quiz editor, with the six question types in the slash menu, a question panel for points, explanations and correct answers, and the "already taken" warning. Hosts add `@mantine/core` and `@mantine/hooks` (8.3 or 9) and import `@blocknote/mantine/style.css`.
