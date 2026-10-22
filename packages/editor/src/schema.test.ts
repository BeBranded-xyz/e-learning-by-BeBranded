import { describe, expect, it } from "vitest";

import { lessonEditorSchema } from "./schema.js";

const VALIDATED_TYPES = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "codeBlock",
  "table",
  "divider",
  "callout",
];

describe("lessonEditorSchema", () => {
  it("defines every block type the validator accepts", () => {
    const types = Object.keys(lessonEditorSchema.blockSchema);

    expect(types).toEqual(expect.arrayContaining(VALIDATED_TYPES));
  });

  it("declares the callout block with its variants", () => {
    const callout = lessonEditorSchema.blockSchema.callout;

    expect(callout.content).toBe("inline");
    expect(callout.propSchema.variant.values).toEqual(["info", "success", "warning", "danger"]);
  });
});
