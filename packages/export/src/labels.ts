/** Words printed in exported documents, in English and French (spec 04, section 7). */
export type ExportLabels = {
  readonly tableOfContents: string;
  readonly video: string;
  readonly attachment: string;
  readonly exportedOn: (date: string) => string;
  readonly page: string;
};

const LABELS: Record<"en" | "fr", ExportLabels> = {
  en: {
    tableOfContents: "Contents",
    video: "Video",
    attachment: "Attachment",
    exportedOn: (date) => `Exported on ${date}`,
    page: "Page",
  },
  fr: {
    tableOfContents: "Sommaire",
    video: "Vidéo",
    attachment: "Pièce jointe",
    exportedOn: (date) => `Exporté le ${date}`,
    page: "Page",
  },
};

export function labelsFor(locale: string): ExportLabels {
  return locale.split("-")[0] === "fr" ? LABELS.fr : LABELS.en;
}

/** The export date in the document's language, in UTC like the server stores it. */
export function formatExportDate(iso: string, locale: string): string {
  const language = /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : "en";
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(iso),
  );
}
