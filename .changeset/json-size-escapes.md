---
"@bebranded/elearning-core": patch
---

Fix: the lesson document size limit undercounted strings with JSON escapes (a control character is 6 bytes in JSON, not 1), so a document could exceed the limit by up to 6 times. Scalars are now measured in their exact JSON form.
