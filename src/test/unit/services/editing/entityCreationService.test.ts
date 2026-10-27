import { createEmptyDocument, ProjectDocument } from "@common/documents";
import {
  createEntityAtPlacement,
  resolveCreationPlacement,
} from "@services/editing/entityCreationService";
import * as assert from "assert";

function createDocument(): ProjectDocument {
  return {
    ...createEmptyDocument(),
    sequence: ["g1", "t1"],
    groups: [{ id: "g1", name: "Planning", sequence: ["t2"] }],
    tasks: [
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta", groupId: "g1" },
    ],
  };
}

suite("entityCreationService", () => {
  test("no selection resolves to the project root with no position anchor", () => {
    assert.deepStrictEqual(resolveCreationPlacement(createDocument(), undefined), {
      ownerId: undefined,
      beforeId: undefined,
    });
  });

  test("a selected task or milestone resolves to that item's owner, positioned before it", () => {
    assert.deepStrictEqual(resolveCreationPlacement(createDocument(), { kind: "task", id: "t2" }), {
      ownerId: "g1",
      beforeId: "t2",
    });
  });

  test("a selected group resolves to the group's own owner, positioned before the group itself", () => {
    assert.deepStrictEqual(
      resolveCreationPlacement(createDocument(), { kind: "group", id: "g1" }),
      { ownerId: undefined, beforeId: "g1" },
    );
  });

  test("a stale selection falls back to the no-selection placement", () => {
    assert.deepStrictEqual(
      resolveCreationPlacement(createDocument(), { kind: "task", id: "missing" }),
      { ownerId: undefined, beforeId: undefined },
    );
  });

  test("creates a new task at the resolved owner and position in one step", () => {
    const placement = resolveCreationPlacement(createDocument(), { kind: "task", id: "t2" });
    const next = createEntityAtPlacement(
      createDocument(),
      "task",
      { id: "new", name: "New Task" },
      placement,
    );

    assert.strictEqual(next.tasks.find((task) => task.id === "new")?.groupId, "g1");
    assert.deepStrictEqual(next.groups.find((group) => group.id === "g1")?.sequence, ["new", "t2"]);
  });

  test("creates at the project root, appended at the end, with no selection", () => {
    const next = createEntityAtPlacement(
      createDocument(),
      "task",
      { id: "new", name: "New Task" },
      { ownerId: undefined, beforeId: undefined },
    );

    assert.strictEqual(next.tasks.find((task) => task.id === "new")?.groupId, undefined);
    assert.deepStrictEqual(next.sequence, ["g1", "t1", "new"]);
  });

  test("editing an existing entity through this function leaves owner and position untouched", () => {
    const document = createDocument();
    const next = createEntityAtPlacement(
      document,
      "task",
      { id: "t1", name: "Renamed" },
      { ownerId: "g1", beforeId: "t2" },
    );

    assert.strictEqual(next.tasks.find((task) => task.id === "t1")?.name, "Renamed");
    assert.strictEqual(next.tasks.find((task) => task.id === "t1")?.groupId, undefined);
    assert.deepStrictEqual(next.sequence, document.sequence);
  });
});
