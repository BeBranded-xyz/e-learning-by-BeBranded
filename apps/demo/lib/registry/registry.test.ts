import { describe, expect, it } from "vitest";

import { shadcnVariables } from "@bebranded/elearning-core/design";

import { design } from "../../elearning.design";
import { registryFromDesign } from "./registry";

const registry = registryFromDesign(design);
const item = (name: string) => registry.items.find((entry) => entry.name === name);

describe("the shadcn registry", () => {
  it("publishes the design file's colors, light and dark, and its shape and fonts", () => {
    const vars = item("elearning-theme")?.cssVars;
    if (vars === undefined) throw new Error("no theme item");
    const light = shadcnVariables(design, design.colors.light);
    const dark = shadcnVariables(design, design.colors.dark);

    expect(vars.light.primary).toBe(light["--primary"]);
    expect(vars.light["muted-foreground"]).toBe(light["--muted-foreground"]);
    expect(vars.dark?.background).toBe(dark["--background"]);
    expect(vars.theme).toEqual({
      radius: design.radius,
      "font-sans": design.fonts.body,
      "font-heading": design.fonts.heading,
      "font-mono": design.fonts.mono,
    });
    expect(Object.keys(vars.light)).toHaveLength(21);
  });

  it("ships the kit with the shadcn components it draws, and the design file", () => {
    expect(item("elearning-kit")).toMatchObject({
      type: "registry:lib",
      dependencies: ["@bebranded/elearning-react"],
      files: [{ path: "registry/elearning/elearning-kit.tsx" }],
    });
    expect(item("elearning-kit")?.registryDependencies).toContain("native-select");
    expect(item("elearning-design")?.files?.[0]).toMatchObject({ target: "~/elearning.design.ts" });
  });

  it("installs all three with one item", () => {
    expect(item("elearning")?.registryDependencies).toEqual([
      "https://e-learning.bebranded.xyz/r/elearning-design.json",
      "https://e-learning.bebranded.xyz/r/elearning-theme.json",
      "https://e-learning.bebranded.xyz/r/elearning-kit.json",
    ]);
  });
});
