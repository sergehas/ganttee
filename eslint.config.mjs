import js from "@eslint/js";
import json from "@eslint/json";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import typescript from "typescript-eslint";

export default defineConfig([
  globalIgnores(["node_modules", ".husky", "coverage/", "out/", "dist/", ".vscode/"]),
  prettierConfig,
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: [],
    ...js.configs.recommended,
    extends: [prettierConfig],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescript.plugin,
    },

    languageOptions: {
      parser: typescript.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    extends: [
      prettierConfig,
      js.configs.recommended,
      ...typescript.configs.recommended,
      ...typescript.configs.stylistic,
    ],

    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],

      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "curly": "warn",
      "eqeqeq": "warn",
      "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
      "no-throw-literal": "warn",
      "semi": "warn",
    },
  },

  {
    // Test files carry exhaustive rule matrices; size is data, not design.
    files: ["src/test/**/*.ts"],
    rules: {
      "max-lines": "off",
    },
  },
  {
    files: ["./tsconfig*.json", ".vscode/*.json"],
    language: "json/jsonc",
    extends: [prettierConfig],
    ...json.configs.recommended,
    // rules: {
    //   "no-irregular-whitespace": "off", //bugged
    // },
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    extends: [prettierConfig],
    ignores: ["**/package-lock.json", "**/tsconfig*.json"],
    ...json.configs.recommended,
    // rules: {
    //   "no-irregular-whitespace": "off", //bugged
    // },
  },
  // Must stay last: turns off every rule Prettier owns.
  prettierConfig,
]);
