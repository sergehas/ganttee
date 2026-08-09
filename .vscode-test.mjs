import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  // Only top-level test files; integration/ and smoke/ subfolders have their own runners.
  files: "out/test/*.test.js",
  version: "insiders",
  launchArgs: ["--disable-extensions"],
});
