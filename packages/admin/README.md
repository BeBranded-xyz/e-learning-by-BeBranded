# @bebranded/elearning-admin

Back-office React components of the BeBranded e-learning module: courses,
the chapters and lessons tree (drag and drop, or move buttons), access rules,
assignments, and the lesson editors: a BlockNote editor for text lessons
with image and file uploads, the video uploader (resumable above 200 MB),
and the quiz editor. Themed with the same `--el-*` CSS variables as
`@bebranded/elearning-react`, in English and French.

```sh
pnpm add @bebranded/elearning-admin @bebranded/elearning-react @mantine/core @mantine/hooks
```

The editors use [BlockNote](https://www.blocknotejs.org) (MPL-2.0, unmodified)
with its Mantine UI kit; Mantine 8.3 or 9 is a peer dependency. Import
BlockNote's stylesheet on the back-office pages:

```ts
import "@blocknote/mantine/style.css";
```

```tsx
import { CourseAdmin, CourseAdminList, ElearningAdminProvider } from "@bebranded/elearning-admin";
import "@bebranded/elearning-react/styles.css";
import "@bebranded/elearning-admin/styles.css";

<ElearningAdminProvider apiBase="/api/elearning" locale="en">
  <CourseAdminList courseHref={(course) => `/admin/training/${course.id}`} />
</ElearningAdminProvider>;

<ElearningAdminProvider apiBase="/api/elearning">
  <CourseAdmin
    courseId={courseId}
    lessonHref={(lesson) => `/admin/training/lessons/${lesson.id}`}
    roles={["employee", "manager"]}
  />
</ElearningAdminProvider>;
```

- Mount these components only on pages your own authorization reserves to
  admins. The server refuses every admin route to a learner whose identity
  has `isAdmin: false` anyway (spec 04).
- `ElearningAdminProvider` takes the props of `ElearningProvider` (`apiBase`,
  `locale`, `theme`, `messages`, `fetcher`) plus `adminMessages` to override
  back-office strings.
- `roles` suggests the host's roles in the audience fields (spec 05).
- `LessonAdmin` edits one lesson: settings, then the editor of its type, then
  its access rules. Images and files go to the host's `FileStorage` through
  `POST /v1/admin/files/uploads` (configure `files` in `createElearning`);
  the browser PUTs the bytes directly. The slash menu leaves out what the
  server rejects (headings 4 to 6, audio, video).
- Videos go straight to the video provider: a `multipart/form-data` POST up
  to 200 MB, a resumable tus upload above. The page follows the video until
  the provider's webhook marks it ready, and warns when it has no captions.
- The quiz editor adds the six question types to the slash menu; points,
  explanations and correct answers are set in the question panel beside the
  editor. It warns when learners already took the quiz.
- Reordering is saved as one `POST /v1/admin/reorder`. Drag and drop works
  with a pointer; the move buttons do the same with a keyboard or a screen
  reader.
- Supported: React 18.2 and 19, Node 22.12 or later.

See [the integration specification](../../docs/specifications/04-integration.md).
