import { createEmptyDocument } from "@common/documents";
import { ScheduleDiagnostic } from "@common/models";
import { describeDiagnostics } from "@views/scheduleDiagnosticPresenter";
import * as assert from "assert";

/** Sentinel ids that must never appear in user-facing wording. */
const SENTINELS = ["id-under-7f3", "id-over-7f3", "id-dep-7f3", "id-group-7f3", "id-a-7f3"];

/** Builds a project whose records carry sentinel ids and readable labels. */
function project() {
  const document = createEmptyDocument();
  document.tasks = [
    { id: "id-under-7f3", name: "Under task" },
    { id: "id-over-7f3", name: "Over task" },
    { id: "id-a-7f3", name: "" },
  ];
  document.groups = [{ id: "id-group-7f3", name: "Phase" }];
  document.dependencies = [
    { id: "id-dep-7f3", sourceId: "id-group-7f3", targetId: "id-over-7f3", type: "startAfter" },
  ];
  return document;
}

const DIAGNOSTICS: readonly ScheduleDiagnostic[] = [
  { kind: "underConstrained", severity: "blocking", entityId: "id-under-7f3", count: 1 },
  {
    kind: "overConstrained",
    severity: "blocking",
    entityId: "id-over-7f3",
    count: 3,
    duplicateEndpoints: [],
  },
  {
    kind: "danglingDependency",
    severity: "blocking",
    dependencyId: "id-dep-7f3",
    sourceId: "missing",
    targetId: "id-over-7f3",
  },
  {
    kind: "groupDependency",
    severity: "blocking",
    dependencyId: "id-dep-7f3",
    sourceId: "id-group-7f3",
    targetId: "id-over-7f3",
  },
  { kind: "unanchoredComponent", severity: "blocking", entityIds: ["id-under-7f3", "id-a-7f3"] },
  { kind: "invalidWorkingCalendar", severity: "blocking" },
];

suite("scheduleDiagnosticPresenter", () => {
  test("describes every diagnostic kind as one resolved sentence", () => {
    const messages = describeDiagnostics(DIAGNOSTICS, project());
    assert.strictEqual(messages.length, DIAGNOSTICS.length);
    for (const message of messages) {
      assert.ok(message.length > 0);
      assert.ok(!/\{\w+\}/.test(message), `unresolved placeholder: ${message}`);
    }
  });

  test("names items by label and never by id", () => {
    const messages = describeDiagnostics(DIAGNOSTICS, project());
    assert.ok(messages[0].includes("Under task"));
    assert.ok(messages[1].includes("Over task"));
    for (const message of messages) {
      for (const sentinel of SENTINELS) {
        assert.ok(!message.includes(sentinel), `id leaked in: ${message}`);
      }
    }
  });

  test("uses the given translator", () => {
    const messages = describeDiagnostics(DIAGNOSTICS.slice(5), project(), () => "translated");
    assert.deepStrictEqual(messages, ["translated"]);
  });

  test("describes nothing when there are no diagnostics", () => {
    assert.deepStrictEqual(describeDiagnostics([], project()), []);
  });
});
