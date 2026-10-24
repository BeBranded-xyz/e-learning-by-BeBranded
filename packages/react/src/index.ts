export { ElearningProvider } from "./provider/ElearningProvider.js";
export type { ElearningProviderProps } from "./provider/ElearningProvider.js";
export { useElearning } from "./provider/context.js";

export { CourseCatalog } from "./containers/CourseCatalog.js";
export type { CourseCatalogProps } from "./containers/CourseCatalog.js";
export { CoursePage } from "./containers/CoursePage.js";
export type { CoursePageProps } from "./containers/CoursePage.js";
export { LessonPlayer } from "./containers/LessonPlayer.js";
export type { LessonPlayerProps } from "./containers/LessonPlayer.js";
export { MyTraining } from "./containers/MyTraining.js";
export type { MyTrainingProps } from "./containers/MyTraining.js";

export { CourseList } from "./components/CourseList.js";
export { CourseOutline } from "./components/CourseOutline.js";
export { LessonContent } from "./components/LessonContent.js";
export { LessonView } from "./components/LessonView.js";
export { ProgressBar } from "./components/ProgressBar.js";
export { ExportActions } from "./components/ExportActions.js";
export type { ExportActionsProps } from "./components/ExportActions.js";
export { VideoPlayer } from "./components/VideoPlayer.js";
export type { VideoPlayerProps } from "./components/VideoPlayer.js";
export { Quiz } from "./components/Quiz.js";
export type { QuizProps } from "./components/Quiz.js";

export {
  queryKeys,
  useCatalog,
  useCompleteLesson,
  useCourse,
  useEnroll,
  useLesson,
  useMyProgress,
  useOpenQuizAttempt,
  useStartLesson,
  useSubmitQuizAttempt,
} from "./hooks/queries.js";

export { QueryState } from "./components/QueryState.js";
export type { QueryStateProps } from "./components/QueryState.js";

export { ElearningApiError, toApiError } from "./api/api-error.js";
export type { Fetcher } from "./api/client.js";
export type { MessageKey, Messages } from "./i18n/messages.js";
export { defaultKit, useUi } from "./ui/kit.js";
export type {
  BadgeTone,
  ButtonSize,
  ButtonVariant,
  UiAlertProps,
  UiBadgeProps,
  UiButtonProps,
  UiCardProps,
  UiCheckboxProps,
  UiKit,
  UiLinkButtonProps,
  UiProgressProps,
  UiSelectProps,
  UiTableProps,
  UiTextAreaProps,
  UiTextFieldProps,
} from "./ui/kit.types.js";
