import { shadcnVariables } from "@bebranded/elearning-core/design";
import type { ElearningDesign } from "@bebranded/elearning-core/design";

/**
 * The demo's shadcn registry (spec 11, theme 1), built from the design file so
 * the published theme always matches it. `shadcn build` turns it into /r/*.json.
 */

const ORIGIN = "https://e-learning.bebranded.xyz";

const KIT_COMPONENTS = [
  "alert",
  "badge",
  "button",
  "card",
  "checkbox",
  "input",
  "label",
  "native-select",
  "progress",
  "table",
  "textarea",
];

/** shadcn's cssVars: names without their leading dashes. */
function cssVars(variables: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables).map(([name, value]) => [name.slice(2), value]),
  );
}

/** The fields of shadcn's registry item schema this registry uses. */
type RegistryItem = {
  readonly name: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly dependencies?: readonly string[];
  readonly registryDependencies?: readonly string[];
  readonly files?: readonly {
    readonly path: string;
    readonly type: string;
    readonly target?: string;
  }[];
  readonly cssVars?: {
    readonly theme: Readonly<Record<string, string>>;
    readonly light: Readonly<Record<string, string>>;
    readonly dark?: Readonly<Record<string, string>>;
  };
};

const SHARED = ["radius", "spacing", "font-sans", "font-heading", "font-mono"];

const pick = (vars: Record<string, string>, keep: (name: string) => boolean) =>
  Object.fromEntries(Object.entries(vars).filter(([name]) => keep(name)));

function themeItem(design: ElearningDesign): RegistryItem {
  const light = cssVars(shadcnVariables(design, design.colors.light));
  const dark = cssVars(shadcnVariables(design, design.colors.dark));
  const colors = (name: string) => !SHARED.includes(name);
  return {
    name: "elearning-theme",
    type: "registry:theme",
    title: "e-learning by BeBranded theme",
    description: "The design file's colors (light and dark), radius, spacing and fonts.",
    cssVars: {
      theme: pick(light, (name) => SHARED.includes(name)),
      light: pick(light, colors),
      ...(design.darkMode === "off" ? {} : { dark: pick(dark, colors) }),
    },
  };
}

const KIT_ITEM: RegistryItem = {
  name: "elearning-kit",
  type: "registry:lib",
  title: "e-learning by BeBranded UI kit",
  description:
    "The module's buttons, cards, fields, badges, alerts and tables, drawn with shadcn/ui.",
  dependencies: ["@bebranded/elearning-react"],
  registryDependencies: KIT_COMPONENTS,
  files: [{ path: "registry/elearning/elearning-kit.tsx", type: "registry:lib" }],
};

const DESIGN_ITEM: RegistryItem = {
  name: "elearning-design",
  type: "registry:file",
  title: "e-learning by BeBranded design file",
  description:
    "elearning.design.ts at the project root: the one file to edit to restyle everything.",
  dependencies: ["@bebranded/elearning-core"],
  files: [{ path: "elearning.design.ts", type: "registry:file", target: "~/elearning.design.ts" }],
};

const BUNDLE_ITEM: RegistryItem = {
  name: "elearning",
  type: "registry:item",
  title: "e-learning by BeBranded with shadcn/ui",
  description: "The design file, its theme and the UI kit, in one install.",
  registryDependencies: ["elearning-design", "elearning-theme", "elearning-kit"].map(
    (item) => `${ORIGIN}/r/${item}.json`,
  ),
};

export function registryFromDesign(design: ElearningDesign) {
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "elearning",
    homepage: "https://github.com/BeBranded-xyz/e-learning-by-BeBranded",
    items: [themeItem(design), KIT_ITEM, DESIGN_ITEM, BUNDLE_ITEM] satisfies RegistryItem[],
  };
}
