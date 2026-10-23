import type { ComponentType } from "react";
import type { QuestionBooleanModel, SurveyModel } from "survey-core";

/** SurveyJS, loaded only when a quiz opens: it weighs far more than the rest of the module. */
export type SurveyRuntime = {
  readonly Model: new (json: unknown) => SurveyModel;
  readonly Survey: ComponentType<{ model: SurveyModel }>;
  readonly QuestionBoolean: abstract new (...args: never[]) => QuestionBooleanModel;
};

let pending: Promise<SurveyRuntime> | null = null;

/** Loads SurveyJS once per page, with its French strings when the locale is French. */
export function loadSurveyRuntime(locale: string): Promise<SurveyRuntime> {
  pending ??= Promise.all([import("survey-core"), import("survey-react-ui")]).then(
    ([core, react]) => ({
      Model: core.Model,
      Survey: react.Survey,
      QuestionBoolean: core.QuestionBooleanModel,
    }),
  );
  const french =
    locale.split("-")[0] === "fr"
      ? // @ts-expect-error -- survey-core ships its locale modules without types; this one only registers strings.
        import("survey-core/i18n/french")
      : null;
  return french === null ? pending : Promise.all([pending, french]).then(([runtime]) => runtime);
}
