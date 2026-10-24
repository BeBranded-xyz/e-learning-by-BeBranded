import { LANGUAGE_CATALOG } from "./language-catalog.js";

/** A stable catalog across server and browser, with an existing regional/legacy tag preserved. */
export function languageOptions(locale: string, current: string) {
  const column = locale.startsWith("fr") ? 2 : 1;
  const options = LANGUAGE_CATALOG.map((row) => ({
    value: row[0],
    label: `${row[column]} (${row[0]})`,
  }));
  if (!options.some((option) => option.value === current)) {
    const base = LANGUAGE_CATALOG.find((row) => row[0] === current.split("-")[0]);
    options.push({ value: current, label: `${base?.[column] ?? current} (${current})` });
  }
  const collator = new Intl.Collator(locale);
  return options.sort((a, b) => collator.compare(a.label, b.label));
}
