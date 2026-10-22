# @bebranded/elearning-editor

Lesson content for the BeBranded e-learning module: the BlockNote block
schema used by the authoring editor, and the server-side HTML renderer used
by learner pages.

```sh
pnpm add @bebranded/elearning-editor
```

```ts
import { validateLessonDocument } from "@bebranded/elearning-core";
import { renderLessonHtml } from "@bebranded/elearning-editor/server";

const result = validateLessonDocument(storedContent);
if (result.ok) {
  const html = renderLessonHtml(result.value); // escaped and sanitized
}
```

- `@bebranded/elearning-editor` exports `lessonEditorSchema` (BlockNote
  default blocks plus a callout block).
- `@bebranded/elearning-editor/server` exports `renderLessonHtml`. It needs no
  DOM and runs on Node and edge runtimes. Importing it in a browser bundle
  throws.

Lesson pages never load BlockNote: they receive HTML rendered on the server.
BlockNote core is used unmodified under MPL-2.0. Requires Node.js 22.12 or
later. MIT licensed.
