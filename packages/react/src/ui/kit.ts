import { createContext, useContext } from "react";

import { DefaultButton, DefaultLinkButton } from "./default-actions.js";
import { DefaultAlert, DefaultBadge, DefaultCard, DefaultProgress } from "./default-display.js";
import {
  DefaultCheckbox,
  DefaultSelect,
  DefaultTextArea,
  DefaultTextField,
} from "./default-fields.js";
import { DefaultTable } from "./default-table.js";
import type { UiKit } from "./kit.types.js";

/** The default kit: plain HTML styled by the module's CSS and the design's variables. */
export const defaultKit: UiKit = {
  Button: DefaultButton,
  LinkButton: DefaultLinkButton,
  Card: DefaultCard,
  Badge: DefaultBadge,
  Alert: DefaultAlert,
  Progress: DefaultProgress,
  TextField: DefaultTextField,
  TextArea: DefaultTextArea,
  Select: DefaultSelect,
  Checkbox: DefaultCheckbox,
  Table: DefaultTable,
};

export const UiKitContext = createContext<UiKit>(defaultKit);

/** The kit the provider received, completed by the default kit. */
export function useUi(): UiKit {
  return useContext(UiKitContext);
}
