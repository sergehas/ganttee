import { defineConfig } from "@vscode/test-cli";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  files: "out/test/smoke/**/*.test.js",
  version: "insiders",
  launchArgs: [
    "--disable-extensions",
    path.join(__dirname, "src", "test", "fixtures"),
  ],
});
