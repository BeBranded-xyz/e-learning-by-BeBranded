import { cache } from "react";

import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, demoLocale } from "./demo-messages";
import { LEARNER_SUFFIX_COOKIE, PERSONA_COOKIE, selectedPersona } from "./demo-users";

export const demoSession = cache(async () => {
  const [store, requestHeaders] = await Promise.all([cookies(), headers()]);
  const persona = selectedPersona(store.get(PERSONA_COOKIE)?.value);
  return {
    persona,
    locale: demoLocale(
      store.get(LOCALE_COOKIE)?.value,
      requestHeaders.get("accept-language") ?? "",
    ),
    sessionKey: JSON.stringify([persona, store.get(LEARNER_SUFFIX_COOKIE)?.value ?? ""]),
  };
});
