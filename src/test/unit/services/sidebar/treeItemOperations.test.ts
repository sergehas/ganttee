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
    sequence: ["g1", "g3", "t1", "t2"],
    groups: [
      { id: "g1", name: "Planning", sequence: ["g2", "t3"] },
      { id: "g2", name: "Delivery", groupId: "g1", sequence: ["m1"] },
      { id: "g3", name: "Other", sequence: [] },
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
  test("item-target drop assigns the target's owner and inserts before it", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "task", id: "t1" },
        { kind: "milestone", id: "m1" },
        { kind: "task", id: "missing" },
      ],
      { kind: "task", id: "t3" },
    );

    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g1");
    assert.strictEqual(result.milestones[0].groupId, "g1");
    assert.deepStrictEqual(result.groups.find((group) => group.id === "g1")?.sequence, [
      "g2",
      "m1",
      "t1",
      "t3",
    ]);
  });

  test("group (list) target drop nests the selection and appends at the end", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "task", id: "t1" },
        { kind: "milestone", id: "m1" },
      ],
      { kind: "group", id: "g3" },
    );

    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g3");
    assert.strictEqual(result.milestones[0].groupId, "g3");
    assert.deepStrictEqual(result.groups.find((group) => group.id === "g3")?.sequence, [
      "m1",
      "t1",
    ]);
    assert.deepStrictEqual(result.sequence, ["g1", "g3", "t2"]);
  });

  test("rejects self and descendant group drops while allowing valid items", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "group", id: "g1" },
        { kind: "group", id: "g2" },
        { kind: "task", id: "t1" },
      ],
      { kind: "group", id: "g2" },
    );

    assert.strictEqual(result.groups.find((group) => group.id === "g1")?.groupId, undefined);
    assert.strictEqual(result.groups.find((group) => group.id === "g2")?.groupId, "g1");
    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g2");
  });

  test("falls back to the project root when the target no longer resolves", () => {
    const document = createDocument();
    const result = assignEntitiesToGroup(document, [{ kind: "task", id: "t1" }], {
      kind: "group",
      id: "missing-group",
    });

    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, undefined);
    assert.ok(result.sequence?.includes("t1"));
  });

  test("no item is inserted relative to itself when the target is in the dragged selection", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "task", id: "t3" },
        { kind: "task", id: "t1" },
      ],
      { kind: "task", id: "t3" },
    );

    assert.strictEqual(result.tasks.find((task) => task.id === "t1")?.groupId, "g1");
    assert.deepStrictEqual(result.groups.find((group) => group.id === "g1")?.sequence, [
      "g2",
      "t1",
      "t3",
    ]);
  });

  test("ungroups valid selection at project root, appended at the end", () => {
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
    assert.deepStrictEqual(result.sequence, ["g1", "g3", "t1", "t2", "g2", "m1"]);
  });

  test("preserves source-sequence order for a multi-owner drop, not selection order", () => {
    const result = assignEntitiesToGroup(
      createDocument(),
      [
        { kind: "task", id: "t2" },
        { kind: "task", id: "t3" },
        { kind: "group", id: "g3" },
      ],
      undefined,
    );

    assert.deepStrictEqual(result.sequence, ["g1", "t1", "t3", "g3", "t2"]);
  });

  test("moves one entity within its owner's sequence and preserves ownership", () => {
    const document = createDocument();
    const movedUp = moveEntity(document, { kind: "task", id: "t2" }, "up");
    const movedDown = moveEntity(document, { kind: "task", id: "t1" }, "down");

    assert.deepStrictEqual(movedUp.sequence, ["g1", "g3", "t2", "t1"]);
    assert.deepStrictEqual(movedDown.sequence, ["g1", "g3", "t2", "t1"]);
    assert.strictEqual(movedUp.tasks.find((task) => task.id === "t3")?.groupId, "g1");
  });

  test("leaves the document unchanged when the moved entity does not exist", () => {
    const document = createDocument();

    assert.strictEqual(moveEntity(document, { kind: "task", id: "missing" }, "up"), document);
  });

  test("moves a milestone and a group within their owner's sequence", () => {
    const document: ProjectDocument = {
      ...createDocument(),
      groups: [
        { id: "g1", name: "Planning", sequence: ["g2", "t3"] },
        { id: "g2", name: "Delivery", groupId: "g1", sequence: ["m1", "m2"] },
        { id: "g3", name: "Other", sequence: [] },
      ],
      milestones: [
        { id: "m1", name: "Release", groupId: "g2", date: "2026-01-05" },
        { id: "m2", name: "Launch", groupId: "g2", date: "2026-01-06" },
      ],
    };

    assert.deepStrictEqual(moveEntity(document, { kind: "group", id: "g3" }, "up").sequence, [
      "g3",
      "g1",
      "t1",
      "t2",
    ]);
    assert.deepStrictEqual(
      moveEntity(document, { kind: "milestone", id: "m2" }, "up").groups.find(
        (group) => group.id === "g2",
      )?.sequence,
      ["m2", "m1"],
    );
  });

  test("keeps boundary moves unchanged", () => {
    const document = createDocument();

    assert.deepStrictEqual(
      moveEntity(document, { kind: "group", id: "g1" }, "up").sequence,
      document.sequence,
    );
    assert.deepStrictEqual(
      moveEntity(document, { kind: "task", id: "t2" }, "down").sequence,
      document.sequence,
    );
  });

  test("sorts each owner's sequence by dates then name, interleaving kinds, with stable ties", () => {
    const document = createDocument();
    const effectiveDates = new Map(
      document.tasks.map((task) => [
        task.id,
        { start: new Date(task.start ?? ""), end: new Date(task.end ?? "") },
      ]),
    );
    const result = sortProjectItems(document, "ascending", effectiveDates);

    assert.deepStrictEqual(result.sequence, ["t2", "t1", "g3", "g1"]);
  });

  test("sorts descending by dates then name", () => {
    const document = createDocument();
    const effectiveDates = new Map(
      document.tasks.map((task) => [
        task.id,
        { start: new Date(task.start ?? ""), end: new Date(task.end ?? "") },
      ]),
    );

    assert.deepStrictEqual(sortProjectItems(document, "descending", effectiveDates).sequence, [
      "g1",
      "g3",
      "t1",
      "t2",
    ]);
  });

  test("sorts each nested group's own sequence independently", () => {
    const document = createDocument();

    const result = sortProjectItems(document, "ascending");

    assert.deepStrictEqual(
      result.groups.find((group) => group.id === "g1")?.sequence,
      document.groups
        .find((group) => group.id === "g1")
        ?.sequence?.slice()
        .sort(),
    );
  });

  test("breaks a tied start date using the end date, and treats a missing end as later", () => {
    const document: ProjectDocument = {
      ...createDocument(),
      sequence: ["t1", "t2", "t3"],
      tasks: [
        { id: "t1", name: "Alpha", start: "2026-01-01", end: "2026-01-05" },
        { id: "t2", name: "Beta", start: "2026-01-01", end: "2026-01-02" },
        { id: "t3", name: "Gamma", start: "2026-01-01" },
      ],
      groups: [],
      milestones: [],
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

    assert.deepStrictEqual(sortProjectItems(document, "ascending", effectiveDates).sequence, [
      "t2",
      "t1",
      "t3",
    ]);
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
