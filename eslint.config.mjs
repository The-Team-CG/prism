import prismArchitecture from "./scripts/eslint-prism-architecture.mjs";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "output/**",
      ".worktrees/**",
    ],
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: prismArchitecture.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    plugins: {
      prism: prismArchitecture.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "prism/no-cross-portal-imports": "error",
      "prism/no-private-context-imports": "error",
      "prism/no-local-contract-definitions": "error",
      "prism/no-inline-zod": "error",
      "prism/no-production-any": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
