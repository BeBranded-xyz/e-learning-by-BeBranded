import { describe, expect, it } from "vitest";

import { demoLocale, demoMessages, en, fr } from "./demo-messages";
import { selectedPersona } from "./demo-users";
import { DEMO_VIDEO_FILES, demoVideoPlaylist } from "./demo-video";

describe("demo preferences", () => {
  it("starts as a learner and never treats an invalid persona as an administrator", () => {
    expect(selectedPersona(undefined)).toBe("staff");
    expect(selectedPersona("admin")).toBe("admin");
    for (const invalid of ["signed-out", "", "__proto__", "ADMIN"])
      expect(selectedPersona(invalid)).toBeNull();
  });

  it("prefers a persisted supported locale and otherwise follows the browser", () => {
    expect(demoLocale("en", "fr-FR,fr;q=0.9")).toBe("en");
    expect(demoLocale("fr", "en-US")).toBe("fr");
    expect(demoLocale(undefined, "fr-CA,en;q=0.8")).toBe("fr");
    expect(demoLocale("invalid", "de-DE")).toBe("en");
    expect(demoLocale(undefined)).toBe("en");
  });

  it("provides all shell strings in both supported languages", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(fr).every((message) => message.trim().length > 0)).toBe(true);
    expect(demoMessages("fr").learner).toBe("Apprenant");
    expect(demoMessages("en").learner).toBe("Learner");
  });

  it("maps assets to allowlisted local excerpts without accepting arbitrary paths", () => {
    expect(demoVideoPlaylist("demo-forest")).toBe("/demo-video/forest.m3u8");
    expect(demoVideoPlaylist("../../secret")).toBe("/demo-video/opening.m3u8");
    expect(Object.hasOwn(DEMO_VIDEO_FILES, "../secret")).toBe(false);
    expect(DEMO_VIDEO_FILES["opening.m3u8"]).toBe("application/vnd.apple.mpegurl");
  });
});
