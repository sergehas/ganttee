// Fails the process if branch or function coverage per file is below the threshold.
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const MIN_BRANCH_COVERAGE_PCT = 90;
const MIN_FUNCTION_COVERAGE_PCT = 90;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const summaryPath = path.join(__dirname, "..", "coverage", "coverage-summary.json");

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch (error) {
  console.error(`Unable to read coverage summary at ${summaryPath}: ${error.message}`);
  console.error('Run "npm run test:unit:coverage" first.');
  process.exit(1);
}

const coverageBelowThreshold = Object.entries(summary)
  .filter(([filePath]) => filePath !== "total")
  .flatMap(([filePath, coverage]) => {
    const failures = [];

    if (coverage.branches?.pct < MIN_BRANCH_COVERAGE_PCT) {
      failures.push({
        filePath,
        coverageType: "Branch",
        percentage: coverage.branches.pct,
        threshold: MIN_BRANCH_COVERAGE_PCT,
      });
    }

    if (coverage.functions?.pct < MIN_FUNCTION_COVERAGE_PCT) {
      failures.push({
        filePath,
        coverageType: "Function",
        percentage: coverage.functions.pct,
        threshold: MIN_FUNCTION_COVERAGE_PCT,
      });
    }

    return failures;
  });

if (coverageBelowThreshold.length === 0) {
  process.exit(0);
}

for (const { filePath, coverageType, percentage, threshold } of coverageBelowThreshold) {
  console.warn(
    `${coverageType} coverage ${percentage}% for ${filePath} is below the required ${threshold}% threshold.`,
  );
}

process.exit(1);
