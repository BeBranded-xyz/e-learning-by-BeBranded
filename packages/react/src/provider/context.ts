import { createContext, useContext } from "react";

import type { ApiClient } from "../api/client.js";
import type { I18n } from "../i18n/translator.js";

export type ElearningContextValue = { readonly api: ApiClient; readonly i18n: I18n };

export const ElearningContext = createContext<ElearningContextValue | null>(null);

/** The provider's API client and translations; throws outside `<ElearningProvider>`. */
export function useElearning(): ElearningContextValue {
  const value = useContext(ElearningContext);
  if (value === null) throw new Error("Wrap e-learning components in <ElearningProvider>.");
  return value;
}
