import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Size and complexity limits come from core/code-standards.mdc.
const sizeLimits = {
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
  "max-depth": ["error", 3],
  "max-params": ["error", 4],
  complexity: ["error", 10],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.turbo/**",
      ".claude/**",
      "**/*.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...sizeLimits,
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": "error",
    },
  },
  {
    // React packages: hooks rules and accessibility lint at error level (modules/frontend).
    files: ["**/*.tsx"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.configs.strict,
  },
  {
    // Test suites group many cases in one describe callback; each test stays small.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/tests/**/*.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Command-line scripts report to the terminal.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
    rules: { "no-console": "off" },
  },
);
