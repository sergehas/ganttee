import { defineConfig } from "@vscode/test-cli";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Fresh temp dirs per run avoid stale locks/manifests in reused .vscode-test paths.
const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "ganttee-smoke-"));
const userDataDir = path.join(runDir, "userdata");
const extensionsDir = path.join(runDir, "extensions");

fs.mkdirSync(userDataDir, { recursive: true });
fs.mkdirSync(extensionsDir, { recursive: true });

export default defineConfig({
  files: "out/test/smoke/**/*.test.js",
  version: "insiders",
  launchArgs: [
    "--disable-extensions",
    "--disable-gpu",
    "--user-data-dir",
    userDataDir,
    "--extensions-dir",
    extensionsDir,
    path.join(__dirname, "src", "test", "fixtures"),
  ],
});
