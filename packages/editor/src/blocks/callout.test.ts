// @vitest-environment jsdom
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { lessonEditorSchema } from "../schema.js";

describe("callout block in the editor", () => {
  it("renders as a note with its variant and editable content", () => {
    const editor = BlockNoteEditor.create({ schema: lessonEditorSchema });

    const html = editor.blocksToFullHTML([
      { type: "callout", props: { variant: "warning" }, content: "Wear gloves" },
    ]);

    expect(html).toContain('class="el-callout"');
    expect(html).toContain('data-variant="warning"');
    expect(html).toContain('role="note"');
    expect(html).toContain("Wear gloves");
  });

  it("defaults to the info variant", () => {
    const editor = BlockNoteEditor.create({ schema: lessonEditorSchema });

    const html = editor.blocksToFullHTML([{ type: "callout", content: "Tip" }]);

    expect(html).toContain('data-variant="info"');
  });
});
