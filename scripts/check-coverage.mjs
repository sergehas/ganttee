// Fails the process if branch coverage from coverage/coverage-summary.json is below the threshold.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const MIN_BRANCH_COVERAGE_PCT = 90;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const summaryPath = path.join(
  __dirname,
  "..",
  "coverage",
  "coverage-summary.json",
);

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch (error) {
  console.error(
    `Unable to read coverage summary at ${summaryPath}: ${error.message}`,
  );
  console.error('Run "npm run test:unit:coverage" first.');
  process.exit(1);
}

const branchesPct = summary.total?.branches?.pct;
if (typeof branchesPct !== "number") {
  console.error("Coverage summary is missing a total.branches.pct value.");
  process.exit(1);
}

console.log(
  `Branch coverage: ${branchesPct}% (minimum required: ${MIN_BRANCH_COVERAGE_PCT}%)`,
);

if (branchesPct < MIN_BRANCH_COVERAGE_PCT) {
  console.error(
    `Branch coverage ${branchesPct}% is below the required ${MIN_BRANCH_COVERAGE_PCT}% threshold.`,
  );
  process.exit(1);
}
