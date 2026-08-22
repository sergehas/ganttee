import * as assert from "assert";
import { ScheduleDiagnostic } from "../services/scheduleGraphValidationService";
import {
  describeDiagnostic,
  summarizeBlockingDiagnostics,
} from "../views/scheduleDiagnosticPresenter";

const DIAGNOSTICS: readonly ScheduleDiagnostic[] = [
  {
    kind: "underConstrained",
    severity: "blocking",
    entityIds: ["under"],
    count: 1,
  },
  {
    kind: "overConstrained",
    severity: "blocking",
    entityIds: ["over"],
    count: 3,
    duplicateEndpoints: [],
  },
  {
    kind: "danglingDependency",
    severity: "blocking",
    entityIds: ["task", "missing"],
    dependencyId: "d1",
  },
  {
    kind: "groupDependency",
    severity: "blocking",
    entityIds: ["task", "group"],
    dependencyId: "d2",
  },
  {
    kind: "unanchoredComponent",
    severity: "blocking",
    entityIds: ["a", "b"],
  },
];

suite("scheduleDiagnosticPresenter", () => {
  test("describes every diagnostic kind against the given entity", () => {
    const messages = DIAGNOSTICS.map((diagnostic) =>
      describeDiagnostic(diagnostic, "subject"),
    );

    assert.strictEqual(messages.length, DIAGNOSTICS.length);
    for (const message of messages) {
      assert.ok(message.length > 0);
      assert.ok(!message.includes("{0}"), `unresolved placeholder: ${message}`);
    }
  });

  test("names the entity for determinacy and anchoring messages", () => {
    assert.ok(describeDiagnostic(DIAGNOSTICS[0], "subject").includes("subject"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[0], "subject").includes("1"));
    assert.ok(describeDiagnostic(DIAGNOSTICS[4], "subject").includes("subject"));
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
    assert.strictEqual(summary.split("; ").length, 5);
  });

  test("summarizes nothing when there are no diagnostics", () => {
    assert.strictEqual(summarizeBlockingDiagnostics([]), "");
  });
});
