# @bebranded/elearning-react

Learner components and hooks of the BeBranded e-learning module: catalog,
course page, lesson player and "My training", themed with `--el-*` CSS
variables, in English and French.

```sh
pnpm add @bebranded/elearning-react
```

```tsx
import { CoursePage, ElearningProvider } from "@bebranded/elearning-react";
import "@bebranded/elearning-react/styles.css";

<ElearningProvider apiBase="/api/elearning" locale="fr" theme={{ colors: { primary: "#5B3DF5" } }}>
  <CoursePage slug="safety" lessonHref={(lesson) => `/training/safety/${lesson.id}`} />
</ElearningProvider>;
```

- Containers: `CourseCatalog`, `CoursePage`, `LessonPlayer`, `MyTraining`.
- Presentational pieces for your own layouts: `CourseList`, `CourseOutline`,
  `LessonView`, `LessonContent`, `ProgressBar`.
- Headless hooks: `useCatalog`, `useCourse`, `useLesson`, `useMyProgress`,
  `useEnroll`, `useStartLesson`, `useCompleteLesson`.
- Styles have zero specificity (`:where()`): any host rule wins. Theme values
  are filtered so they can only be colors, lengths and font names.
- Messages can be overridden with `messages={{ "catalog.title": "Academy" }}`.

The components call the module's API mounted by the host (see
`@bebranded/elearning-next`); they never hold a secret. Requires React 18.2
or later. MIT licensed.
