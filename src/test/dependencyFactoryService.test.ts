import * as assert from "assert";
import { GanttDocument, Milestone, Task } from "../common/models";
import { buildDependency, createDependencyId } from "../services/dependencyFactoryService";

suite("dependencyFactoryService", () => {
  test("builds dependency only when owner and target are present", () => {
    const dependency = buildDependency(
      "t1",
      "m1",
      "startAfter",
      () => "dep-test",
    );
    const missingOwner = buildDependency(
      undefined,
      "m1",
      "startAfter",
      () => "dep-test",
    );
    const missingTarget = buildDependency(
      "t1",
      "",
      "startAfter",
      () => "dep-test",
    );

    assert.deepStrictEqual(dependency, {
      id: "dep-test",
      sourceId: "t1",
      targetId: "m1",
      type: "startAfter",
    });
    assert.strictEqual(missingOwner, undefined);
    assert.strictEqual(missingTarget, undefined);
  });

  test("createDependencyId returns a prefixed string", () => {
    const id = createDependencyId();
    assert.ok(id.startsWith("dep-"), `Expected dep- prefix, got: ${id}`);
  });
});

function createDocument(): GanttDocument {
  return {
    version: 1,
    tasks: [
      {
        id: "t1",
        name: "Task",
        start: "2026-01-01",
        end: "2026-01-04",
        groupId: "g1",
      },
    ],
    milestones: [
      { id: "m1", name: "Milestone", date: "2026-01-02", groupId: "g1" },
    ],
    groups: [
      { id: "g1", name: "Root" },
      { id: "g2", name: "Child", groupId: "g1" },
    ],
    dependencies: [],
  };
}
