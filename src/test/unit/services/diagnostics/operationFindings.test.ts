import { SchedulingError } from "@common/models";
import {
  cleanupFailedFinding,
  cleanupRemovedFinding,
  dependencyCycleRejectedFinding,
  editRejectedFinding,
  schedulingFailedFinding,
  sortUnavailableFinding,
  unknownItemFinding,
} from "@services/diagnostics/operationFindings";
import * as assert from "assert";

suite("operationFindings", () => {
  test("lists removed items before removed dependencies", () => {
    const finding = cleanupRemovedFinding({
      removedEntityIds: ["e"],
      removedDependencyIds: ["d"],
    });
    assert.strictEqual(finding.category, "cleanupRemoved");
    assert.strictEqual(finding.severity, "warning");
    assert.strictEqual(finding.origin, "operation");
    assert.deepStrictEqual(finding.subjects, [
      { kind: "item", id: "e" },
      { kind: "dependency", id: "d" },
    ]);
  });

  test("builds subjectless operation findings", () => {
    assert.deepStrictEqual(cleanupFailedFinding(), {
      category: "cleanupFailed",
      severity: "error",
      origin: "operation",
      subjects: [],
    });
    assert.deepStrictEqual(sortUnavailableFinding().subjects, []);
    assert.strictEqual(sortUnavailableFinding().category, "sortUnavailable");
  });

  test("keeps the requested origin for unknown items", () => {
    const rejected = unknownItemFinding("task", "t", "rejectedEdit");
    assert.strictEqual(rejected.origin, "rejectedEdit");
    assert.deepStrictEqual(rejected.subjects, [{ kind: "task", id: "t" }]);
    assert.strictEqual(unknownItemFinding("group", "g", "operation").origin, "operation");
  });

  test("names the proposed dependency of a rejected cycle", () => {
    const finding = dependencyCycleRejectedFinding("d");
    assert.strictEqual(finding.severity, "error");
    assert.deepStrictEqual(finding.subjects, [{ kind: "dependency", id: "d" }]);
  });

  test("builds rejected edits with and without an id", () => {
    assert.deepStrictEqual(editRejectedFinding("project").subjects, [{ kind: "project" }]);
    assert.deepStrictEqual(editRejectedFinding("task", "t").subjects, [{ kind: "task", id: "t" }]);
    assert.strictEqual(editRejectedFinding("project").origin, "rejectedEdit");
  });

  test("describes scheduling failures by reason and subject only", () => {
    const detailed = schedulingFailedFinding(
      new SchedulingError("raw text", "unscheduledTarget", ["t"]),
    );
    assert.deepStrictEqual(detailed.subjects, [{ kind: "item", id: "t" }]);
    assert.deepStrictEqual(detailed.args, { reason: "unscheduledTarget" });
    assert.ok(!JSON.stringify(detailed).includes("raw text"));
    const bare = schedulingFailedFinding(new SchedulingError("raw"));
    assert.deepStrictEqual(bare.subjects, []);
    assert.strictEqual(bare.args, undefined);
  });
});
