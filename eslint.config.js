// Lint rules, plus the architecture's dependency direction (see CLAUDE.md) enforced as import restrictions.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Which src/ modules each module may import from. Anything not listed is a layering violation. */
const ALLOWED_IMPORTS = {
  shared: [],
  jev: ["shared"],
  routing: ["jev", "shared"],
  evaluation: ["routing", "shared"],
  comparison: ["evaluation", "shared"],
  generation: ["evaluation", "routing", "shared"],
  judging: ["generation", "jev", "shared"],
  demo: ["judging", "generation", "evaluation", "routing", "shared"],
};
const MODULES = [...Object.keys(ALLOWED_IMPORTS), "cli"];

const layering = Object.entries(ALLOWED_IMPORTS).map(([module, allowed]) => ({
  files: [`src/${module}/**/*.ts`],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: MODULES.filter((m) => m !== module && !allowed.includes(m)).map((m) => ({
        group: [`../${m}/*`],
        message: `src/${module} may import only from ${allowed.join(", ") || "nothing else in src"} (see Architecture in CLAUDE.md).`,
      })),
    }],
  },
}));

export default tseslint.config(
  { ignores: ["node_modules", "runs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Loose on purpose: catch a function growing into a god-function, not nag about every branch.
      complexity: ["error", 12],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Nothing below cli/ reads the environment; config is passed in.
      "no-restricted-properties": ["error", { object: "process", property: "env", message: "Read the environment in src/cli only." }],
    },
  },
  { files: ["src/cli/**/*.ts", "test/**/*.ts", "eslint.config.js"], rules: { "no-restricted-properties": "off" } },
  // A describe block holds many tests; the size limit is for production functions.
  { files: ["test/**/*.ts"], rules: { "max-lines-per-function": "off" } },
  // Page templates are markup in a string, not logic.
  { files: ["src/*/page.ts"], rules: { "max-lines-per-function": "off" } },
  ...layering,
);
