import * as assert from "assert";
import { createEmptyDocument, GanttDocument } from "../common/models";
import {
  entitiesOf,
  findEntity,
  replaceEntity,
  upsertEntity,
} from "../services/documentEntityService";

function createDocument(): GanttDocument {
  const document = createEmptyDocument();
  document.tasks = [
    { id: "t1", name: "Task 1" },
    { id: "t2", name: "Task 2" },
  ];
  document.milestones = [{ id: "m1", name: "Milestone 1" }];
  document.groups = [{ id: "g1", name: "Group 1" }];
  return document;
}

suite("documentEntityService", () => {
  test("selects the collection for each entity kind", () => {
    const document = createDocument();

    assert.deepStrictEqual(
      entitiesOf(document, "task").map((entity) => entity.id),
      ["t1", "t2"],
    );
    assert.deepStrictEqual(
      entitiesOf(document, "milestone").map((entity) => entity.id),
      ["m1"],
    );
    assert.deepStrictEqual(
      entitiesOf(document, "group").map((entity) => entity.id),
      ["g1"],
    );
  });

  test("finds an entity by kind and id", () => {
    const document = createDocument();

    assert.strictEqual(findEntity(document, "task", "t2")?.name, "Task 2");
    assert.strictEqual(findEntity(document, "group", "g1")?.name, "Group 1");
    assert.strictEqual(findEntity(document, "task", "m1"), undefined);
  });

  test("replaces an entity in place without disturbing the others", () => {
    const document = createDocument();

    const next = replaceEntity(document, "task", { id: "t1", name: "Renamed" });

    assert.deepStrictEqual(next?.tasks, [
      { id: "t1", name: "Renamed" },
      { id: "t2", name: "Task 2" },
    ]);
    assert.deepStrictEqual(next?.milestones, document.milestones);
  });

  test("refuses to replace an entity that does not exist", () => {
    const document = createDocument();

    assert.strictEqual(
      replaceEntity(document, "task", { id: "missing", name: "X" }),
      undefined,
    );
  });

  test("does not mutate the input document", () => {
    const document = createDocument();

    replaceEntity(document, "milestone", { id: "m1", name: "Renamed" });

    assert.strictEqual(document.milestones[0].name, "Milestone 1");
  });

  test("upsert replaces a known id and appends an unknown one", () => {
    const document = createDocument();

    const replaced = upsertEntity(document, "task", {
      id: "t1",
      name: "Renamed",
    });
    const appended = upsertEntity(document, "task", { id: "t3", name: "New" });

    assert.deepStrictEqual(
      replaced.tasks.map((task) => task.name),
      ["Renamed", "Task 2"],
    );
    assert.deepStrictEqual(
      appended.tasks.map((task) => task.id),
      ["t1", "t2", "t3"],
    );
  });
});
