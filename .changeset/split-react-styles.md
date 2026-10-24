---
"@bebranded/elearning-react": patch
---

`styles.css` imports its parts (`base.css`, `content.css`, `video.css`, `columns.css`, `export.css`) in the original order; hosts still import `styles.css` only, and the resulting CSS is unchanged.
