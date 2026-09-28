import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  tests: [
    {
      // Only top-level test files; integration/ and smoke/ subfolders have their own runners.
      files: "out/test/unit/**/*.test.js",
      version: "insiders",
      launchArgs: ["--disable-extensions"],
    },
  ],
  coverage: {
    // "json-summary" feeds scripts/check-coverage.mjs; "html"/"text" are for human inspection.
    // c8 filters compiled files before source-map remapping.
    exclude: ["**/out/test/**", "**/src/test/**"],
    reporter: ["text", "json-summary", "lcov"],
  },
});
