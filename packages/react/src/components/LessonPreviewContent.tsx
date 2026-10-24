"use client";

import { useRef, useState } from "react";
import type { ApiLessonPreview, SurveyJson } from "@bebranded/elearning-core";

import { useElearning } from "../provider/context.js";
import { useHlsSource } from "../video/useHlsSource.js";
import { useSurveyRuntime } from "../quiz/useSurveyRuntime.js";
import type { SurveyRuntime } from "../quiz/survey-runtime.js";
import { LessonContent } from "./LessonContent.js";

function PreviewVideo({
  video,
  title,
}: {
  video: NonNullable<ApiLessonPreview["video"]>;
  title: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const { failed } = useHlsSource(ref, video.url);
  const { i18n } = useElearning();
  return (
    <figure className="el-video">
      {/* Captions are provider tracks, matching the learner player. */}
      {/* eslint-disable-next-line jsx-a11y-x/media-has-caption -- provider captions mapped below */}
      <video
        ref={ref}
        controls
        playsInline
        preload="metadata"
        className="el-video-media"
        aria-label={i18n.t("video.label", { title })}
      >
        {video.captions.map((caption) => (
          <track
            key={caption.lang}
            kind="captions"
            srcLang={caption.lang}
            src={caption.url}
            label={caption.lang}
          />
        ))}
      </video>
      {failed ? <figcaption role="alert">{i18n.t("video.error")}</figcaption> : null}
    </figure>
  );
}

function ReadOnlySurvey({ survey, runtime }: { survey: SurveyJson; runtime: SurveyRuntime }) {
  const { i18n } = useElearning();
  const [model] = useState(() => {
    const created = new runtime.Model(survey);
    created.locale = i18n.locale.split("-")[0] ?? "en";
    created.readOnly = true;
    created.showNavigationButtons = false;
    created.showQuestionNumbers = "on";
    for (const question of created.getAllQuestions()) {
      if (question instanceof runtime.QuestionBoolean) {
        question.displayMode = "radio";
        question.labelTrue = i18n.t("quiz.true");
        question.labelFalse = i18n.t("quiz.false");
      }
    }
    return created;
  });
  const { Survey } = runtime;
  return (
    <div className="el-quiz-form">
      <Survey model={model} />
    </div>
  );
}

function PreviewQuiz({ survey }: { survey: SurveyJson }) {
  const { i18n } = useElearning();
  const state = useSurveyRuntime(true, i18n.locale);
  if (state.kind === "failed") return <p role="alert">{i18n.t("quiz.loadFailed")}</p>;
  if (state.kind === "loading") return <p role="status">{i18n.t("quiz.loading")}</p>;
  return <ReadOnlySurvey key={i18n.locale} survey={survey} runtime={state.runtime} />;
}

/** Learner rendering only: no progress hooks, writes, attempts, or completion controls. */
export function LessonPreviewContent({ preview }: { readonly preview: ApiLessonPreview }) {
  const { i18n } = useElearning();
  return (
    <div className="el-lesson-preview-content">
      {preview.type === "video" ? (
        preview.video === null ? (
          <p>{i18n.t("video.processing")}</p>
        ) : (
          <PreviewVideo
            key={preview.id + preview.video.url}
            video={preview.video}
            title={preview.title}
          />
        )
      ) : null}
      <LessonContent html={preview.html} />
      {preview.type === "quiz" ? (
        preview.survey === null ? (
          <p>{i18n.t("quiz.notReady")}</p>
        ) : (
          <PreviewQuiz key={JSON.stringify(preview.survey)} survey={preview.survey} />
        )
      ) : null}
    </div>
  );
}
