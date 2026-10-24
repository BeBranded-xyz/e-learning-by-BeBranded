import { describe, expect, it } from "vitest";

import { authoringItems } from "./slash-menu.js";

const item = (key: string) => ({ key, title: key, onItemClick: () => undefined });

describe("authoringItems", () => {
  it("leaves out what the lesson validator rejects and keeps the rest", () => {
    const keys = [
      "heading",
      "heading_3",
      "heading_4",
      "heading_6",
      "image",
      "file",
      "video",
      "audio",
      "page_break",
      "table",
    ];

    expect(authoringItems(keys.map(item)).map((entry) => entry.title)).toEqual([
      "heading",
      "heading_3",
      "image",
      "file",
      "table",
    ]);
  });

  it("keeps items without a key, such as the question types", () => {
    expect(authoringItems([{ title: "Single choice", onItemClick: () => undefined }])).toHaveLength(
      1,
    );
  });
});
