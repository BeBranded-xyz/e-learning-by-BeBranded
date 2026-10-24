import { lessonIdSchema, presentQuiz } from "@bebranded/elearning-core";
import type { ApiLessonPreview, LessonDetail } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { contextBlocks, quizSettings, surveyOf } from "../services/quiz.js";
import { resolveFileUrls } from "../services/files.js";
import { renderContent } from "../services/render-content.js";
import { loadLessonVideo } from "../services/video.js";
import { found, parseId } from "./ids.js";

async function previewSurvey(context: RequestContext, lesson: LessonDetail) {
  if (lesson.type !== "quiz") return null;
  const quiz = await context.storage.findQuiz(context.scope, lesson.id);
  if (quiz === null) return null;
  const settings = quizSettings(lesson);
  const fileUrl = await resolveFileUrls(context, contextBlocks(quiz.definition));
  return surveyOf(
    presentQuiz(quiz.definition, {
      seed: 1,
      shuffleOptions: settings.shuffleOptions,
      shuffleQuestions: settings.shuffleQuestions,
    }),
    { fileUrl },
  );
}

/** Admin route authorization is enforced before this tenant-scoped, read-only handler. */
export async function previewLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const lesson = found(
    await context.storage.findLesson(context.scope, parseId(lessonIdSchema, rawId)),
  );
  const [html, video, survey] = await Promise.all([
    renderContent(context, lesson.id, lesson.content),
    lesson.type === "video" ? loadLessonVideo(context, lesson) : null,
    previewSurvey(context, lesson),
  ]);
  const body: ApiLessonPreview = {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    html,
    survey,
    video:
      video?.playback === null || video?.playback === undefined
        ? null
        : {
            url: video.playback.url,
            captions: video.asset?.captions ?? [],
          },
  };
  return json(body, context.requestId);
}
