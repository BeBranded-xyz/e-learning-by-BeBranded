---
"@bebranded/elearning-core": minor
"@bebranded/elearning-editor": minor
"@bebranded/elearning-admin": minor
"@bebranded/elearning-react": minor
"@bebranded/elearning-export": minor
---

Multi-column lessons (spec 10). Lesson documents accept `columnList` blocks holding 2 to 4 `column` blocks, each at least 15% of the row, never nested (`nested_columns`). The lesson editor schema has the column blocks, with a resize handle (pointer and arrow keys, 5% steps); the back-office slash menu inserts 2, 3 or 4 columns. Learner pages, PDF and Word exports render columns (`data-width` steps, no inline style; `columns.css` is imported by the React styles). `ExportBlock` gains `columns`. Fix: the lesson editor schema no longer includes the quiz blocks.
