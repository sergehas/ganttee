import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  tests: [
    {
      // Only top-level test files; integration/ and smoke/ subfolders have their own runners.
      files: "out/test/*.test.js",
      version: "insiders",
      launchArgs: ["--disable-extensions"],
    },
  ],
  coverage: {
    // "json-summary" feeds scripts/check-coverage.mjs; "html"/"text" are for human inspection.
    reporter: ["html", "text", "json-summary"],
  },
});
