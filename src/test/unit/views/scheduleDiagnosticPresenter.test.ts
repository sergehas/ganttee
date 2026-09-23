import { ScheduleDiagnostic } from "@services/schedule/scheduleGraphValidationService";
import {
  describeDiagnostic,
  summarizeBlockingDiagnostics,
} from "@views/scheduleDiagnosticPresenter";
import * as assert from "assert";

const DIAGNOSTICS: readonly ScheduleDiagnostic[] = [
  {
    kind: "underConstrained",
    severity: "blocking",
    entityId: "under",
    count: 1,
  },
  {
    kind: "overConstrained",
    severity: "blocking",
    entityId: "over",
    count: 3,
    duplicateEndpoints: [],
  },
  {
    kind: "danglingDependency",
    severity: "blocking",
    dependencyId: "d1",
    sourceId: "missing",
    targetId: "task",
  },
  {
    kind: "groupDependency",
    severity: "blocking",
    dependencyId: "d2",
    sourceId: "group",
    targetId: "task",
  },
  {
    kind: "unanchoredComponent",
    severity: "blocking",
    entityIds: ["a", "b"],
  },
  {
    kind: "invalidWorkingCalendar",
    severity: "blocking",
  },
];

suite("scheduleDiagnosticPresenter", () => {
  test("describes every diagnostic kind against the given entity", () => {
    const messages = DIAGNOSTICS.map((diagnostic) => describeDiagnostic(diagnostic, "subject"));

    assert.strictEqual(messages.length, DIAGNOSTICS.length);
    for (const message of messages) {
      assert.ok(message.length > 0);
      assert.ok(!message.includes("{0}"), `unresolved placeholder: ${message}`);
    }
  });

  test("names the entity for determinacy and anchoring messages", () => {
    assert.ok(describeDiagnostic(DIAGNOSTICS[0], "subject").includes("under"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[0], "subject").includes("1"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[4], "subject").includes("subject"));
  });

  test("ignores a mismatched context entity for determinacy messages", () => {
    assert.ok(!describeDiagnostic(DIAGNOSTICS[0], "unrelated").includes("unrelated"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[0], "unrelated").includes("under"));
  });

  test("names the dependency for endpoint messages", () => {
    assert.ok(describeDiagnostic(DIAGNOSTICS[2], "task").includes("d1"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[3], "task").includes("d2"));
  });

  test("groups a summary by diagnostic kind", () => {
    const summary = summarizeBlockingDiagnostics(DIAGNOSTICS);

    assert.ok(summary.includes("under"));
    assert.ok(summary.includes("over"));
    assert.ok(summary.includes("d1"));
    assert.ok(summary.includes("d2"));
    assert.ok(summary.includes("a, b"));
    assert.ok(summary.includes("invalid working calendar"));
    assert.strictEqual(summary.split("; ").length, 6);
  });

  test("do not name anything for working calendar issues", () => {
    assert.ok(!describeDiagnostic(DIAGNOSTICS[5], "random").includes("random"));
  });

  test("summarizes nothing when there are no diagnostics", () => {
    assert.strictEqual(summarizeBlockingDiagnostics([]), "");
  });
});
