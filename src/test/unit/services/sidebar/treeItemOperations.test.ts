import { createEmptyDocument, ProjectDocument } from "@common/documents";
import { filterProjectItemIds } from "@services/sidebar/treeItemFilterService";
import {
  assignEntitiesToGroup,
  moveEntity,
  sortProjectItems,
} from "@services/sidebar/treeItemOperations";
import * as assert from "assert";

function createDocument(): ProjectDocument {
  return {
    ...createEmptyDocument(),
    groups: [
      { id: "g1", name: "Planning" },
      { id: "g2", name: "Delivery", groupId: "g1" },
      { id: "g3", name: "Other" },
    ],
    tasks: [
      { id: "t1", name: "Alpha", start: "2026-01-03", end: "2026-01-04" },
      { id: "t2", name: "Beta", start: "2026-01-01", end: "2026-01-02" },
      { id: "t3", name: "Gamma", groupId: "g1", start: "2026-01-02", end: "2026-01-03" },
    ],
    milestones: [{ id: "m1", name: "Release", groupId: "g2", date: "2026-01-05" }],
  };
}

suite("treeItemOperations", () => {
  test("assigns valid selection to group and ignores missing ids", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "task", id: "t1" },
        { kind: "milestone", id: "m1" },
        { kind: "task", id: "missing" },
      ],
      "g3",
    );

    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g3");
    assert.strictEqual(result.milestones[0].groupId, "g3");
    assert.strictEqual(result.tasks.find((task) => task.id === "t3")?.groupId, "g1");
  });

  test("rejects self and descendant group drops while allowing valid items", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "group", id: "g1" },
        { kind: "group", id: "g2" },
        { kind: "task", id: "t1" },
      ],
      "g2",
    );

    assert.strictEqual(result.groups.find((group) => group.id === "g1")?.groupId, undefined);
    assert.strictEqual(result.groups.find((group) => group.id === "g2")?.groupId, "g1");
    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g2");
  });

  test("ignores a target group id that does not exist", () => {
    const document = createDocument();
    const result = assignEntitiesToGroup(document, [{ kind: "task", id: "t1" }], "missing-group");

    assert.strictEqual(result, document);
  });

  test("ungroups valid selection at project root", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "group", id: "g2" },
        { kind: "milestone", id: "m1" },
      ],
      undefined,
    );

    assert.strictEqual(result.groups.find((group) => group.id === "g2")?.groupId, undefined);
    assert.strictEqual(result.milestones[0].groupId, undefined);
  });

  test("moves one entity within its owner scope and preserves ownership", () => {
    const document = createDocument();
    const movedUp = moveEntity(document, { kind: "task", id: "t2" }, "up");
    const movedDown = moveEntity(document, { kind: "task", id: "t1" }, "down");

    assert.deepStrictEqual(
      movedUp.tasks.map((task) => task.id),
      ["t2", "t1", "t3"],
    );
    assert.deepStrictEqual(
      movedDown.tasks.map((task) => task.id),
      ["t2", "t1", "t3"],
    );
    assert.strictEqual(movedUp.tasks[2].groupId, "g1");
  });

  test("leaves the document unchanged when the moved entity does not exist", () => {
    const document = createDocument();

    assert.strictEqual(moveEntity(document, { kind: "task", id: "missing" }, "up"), document);
  });

  test("moves a milestone and a group within their owner scope", () => {
    const document: ProjectDocument = {
      ...createDocument(),
      milestones: [
        { id: "m1", name: "Release", groupId: "g2", date: "2026-01-05" },
        { id: "m2", name: "Launch", groupId: "g2", date: "2026-01-06" },
      ],
    };

    assert.deepStrictEqual(
      moveEntity(document, { kind: "group", id: "g3" }, "up").groups.map((group) => group.id),
      ["g3", "g2", "g1"],
    );
    assert.deepStrictEqual(
      moveEntity(document, { kind: "milestone", id: "m2" }, "up").milestones.map(
        (milestone) => milestone.id,
      ),
      ["m2", "m1"],
    );
  });

  test("keeps boundary moves unchanged", () => {
    const document = createDocument();

    assert.deepStrictEqual(
      moveEntity(document, { kind: "task", id: "t1" }, "up").tasks.map((task) => task.id),
      ["t1", "t2", "t3"],
    );
    assert.deepStrictEqual(
      moveEntity(document, { kind: "task", id: "t3" }, "down").tasks.map((task) => task.id),
      ["t1", "t2", "t3"],
    );
  });

  test("sorts each owner scope by dates then name with stable ties", () => {
    const document = createDocument();
    const effectiveDates = new Map(
      document.tasks.map((task) => [
        task.id,
        { start: new Date(task.start ?? ""), end: new Date(task.end ?? "") },
      ]),
    );
    const result = sortProjectItems(document, "ascending", effectiveDates);

    assert.deepStrictEqual(
      result.tasks.map((task) => task.id),
      ["t2", "t1", "t3"],
    );
    assert.deepStrictEqual(
      result.groups.map((group) => group.id),
      ["g3", "g2", "g1"],
    );
  });

  test("sorts descending by dates then name", () => {
    const document = createDocument();
    const effectiveDates = new Map(
      document.tasks.map((task) => [
        task.id,
        { start: new Date(task.start ?? ""), end: new Date(task.end ?? "") },
      ]),
    );

    assert.deepStrictEqual(
      sortProjectItems(document, "descending", effectiveDates).tasks.map((task) => task.id),
      ["t1", "t2", "t3"],
    );
  });

  test("breaks a tied start date using the end date, and treats a missing end as later", () => {
    const document: ProjectDocument = {
      ...createDocument(),
      tasks: [
        { id: "t1", name: "Alpha", start: "2026-01-01", end: "2026-01-05" },
        { id: "t2", name: "Beta", start: "2026-01-01", end: "2026-01-02" },
        { id: "t3", name: "Gamma", start: "2026-01-01" },
      ],
    };
    const effectiveDates = new Map(
      document.tasks.map((task) => [
        task.id,
        {
          start: new Date(task.start ?? ""),
          end: task.end === undefined ? undefined : new Date(task.end),
        },
      ]),
    );

    assert.deepStrictEqual(
      sortProjectItems(document, "ascending", effectiveDates).tasks.map((task) => task.id),
      ["t2", "t1", "t3"],
    );
  });

  test("filters names case-insensitively as literal text", () => {
    const ids = filterProjectItemIds(createDocument(), "[AL");

    assert.deepStrictEqual(ids, new Set());
    assert.deepStrictEqual(filterProjectItemIds(createDocument(), "ALPHA"), new Set(["t1"]));
  });

  test("returns every item id when the search term is empty", () => {
    const document = createDocument();
    const ids = filterProjectItemIds(document, "");

    assert.deepStrictEqual(
      ids,
      new Set([
        ...document.groups.map((group) => group.id),
        ...document.tasks.map((task) => task.id),
        ...document.milestones.map((milestone) => milestone.id),
      ]),
    );
  });
});
