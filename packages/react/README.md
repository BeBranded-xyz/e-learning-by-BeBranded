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

import design from "./elearning.design"; // one design file: colors, fonts, radius, spacing (spec 11)
import { myKit } from "./my-kit"; // optional: your design system's components (UiKit)

<ElearningProvider apiBase="/api/elearning" locale="fr" design={design} ui={myKit}>
  <CoursePage slug="safety" lessonHref={(lesson) => `/training/safety/${lesson.id}`} />
</ElearningProvider>;
```

- Containers: `CourseCatalog`, `CoursePage`, `LessonPlayer`, `MyTraining`.
- `VideoPlayer` (inside `LessonPlayer` for video lessons): HLS playback with watch
  verification. hls.js is loaded on demand, only in browsers without native HLS.
- `Quiz` (inside `LessonPlayer` for quiz lessons): the rules, then the attempt
  rendered by [SurveyJS Form Library](https://surveyjs.io/form-library) (MIT),
  then the score graded by the server and, when the lesson allows it, the
  corrections. SurveyJS is loaded on demand when an attempt opens. It is an
  optional peer dependency: hosts with quiz lessons install it and import two
  more stylesheets.

  ```sh
  pnpm add survey-core@^3.1.1 survey-react-ui@^3.1.1
  ```

  ```ts
  import "survey-core/survey-core.min.css";
  import "@bebranded/elearning-react/quiz.css";
  ```
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

For hosts that switch learners or tenants without reloading, pass
`sessionKey={opaqueSessionScope}` to the provider. Change it on login, logout,
tenant switches and permission changes. Changing `sessionKey` or `apiBase`
clears the previous query cache, cancels its requests and resets child state.
Never use an authentication token as the key. The admin provider accepts it too.
