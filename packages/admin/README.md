# @bebranded/elearning-admin

Back-office React components of the BeBranded e-learning module: courses,
the chapters and lessons tree (drag and drop, or move buttons), access rules
and assignments. Lesson, video and quiz editors and the reports follow in
the same package. Themed with the same `--el-*` CSS variables as
`@bebranded/elearning-react`, in English and French.

```sh
pnpm add @bebranded/elearning-admin @bebranded/elearning-react
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
- Reordering is saved as one `POST /v1/admin/reorder`. Drag and drop works
  with a pointer; the move buttons do the same with a keyboard or a screen
  reader.
- Supported: React 18.2 and 19, Node 22.12 or later.

See [the integration specification](../../docs/specifications/04-integration.md).
