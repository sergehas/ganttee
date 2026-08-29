import * as assert from "assert";
import { createEmptyDocument, GanttDocument } from "../common/models";
import {
  buildGroupDeletionDocument,
  hasGroupContents,
} from "../services/groupDeletionService";

/** Root group `g1` owns task `t1` and nested group `g2`, which owns `t2`. */
function createDocument(): GanttDocument {
  const document = createEmptyDocument();
  document.groups = [
    { id: "g1", name: "Root" },
    { id: "g2", name: "Child", groupId: "g1" },
    { id: "g3", name: "Empty" },
  ];
  document.tasks = [
    { id: "t1", name: "T1", groupId: "g1", start: "2026-01-01" },
    { id: "t2", name: "T2", groupId: "g2", start: "2026-01-02" },
    { id: "outside", name: "Outside", start: "2026-01-03" },
  ];
  document.milestones = [{ id: "m1", name: "M1", groupId: "g2" }];
  document.dependencies = [
    { id: "inside", sourceId: "t2", targetId: "t1", type: "startAfter" },
    { id: "crossing", sourceId: "outside", targetId: "t1", type: "startAfter" },
  ];
  return document;
}

suite("groupDeletionService", () => {
  test("reports whether a group holds anything", () => {
    const document = createDocument();

    assert.strictEqual(hasGroupContents(document, "g1"), true);
    assert.strictEqual(hasGroupContents(document, "g2"), true);
    assert.strictEqual(hasGroupContents(document, "g3"), false);
  });

  test("cascade removes the subtree and every edge touching it", () => {
    const next = buildGroupDeletionDocument(createDocument(), "g1", "cascade");

    assert.deepStrictEqual(
      next?.groups.map((group) => group.id),
      ["g3"],
    );
    assert.deepStrictEqual(
      next?.tasks.map((task) => task.id),
      ["outside"],
    );
    assert.deepStrictEqual(next?.milestones, []);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("cascade on a leaf group leaves its siblings alone", () => {
    const next = buildGroupDeletionDocument(createDocument(), "g2", "cascade");

    assert.deepStrictEqual(
      next?.groups.map((group) => group.id),
      ["g1", "g3"],
    );
    assert.deepStrictEqual(
      next?.tasks.map((task) => task.id),
      ["t1", "outside"],
    );
    assert.deepStrictEqual(
      next?.dependencies.map((dependency) => dependency.id),
      ["crossing"],
    );
  });

  test("reparent promotes direct members to the group's parent", () => {
    const next = buildGroupDeletionDocument(createDocument(), "g2", "reparent");

    assert.deepStrictEqual(
      next?.groups.map((group) => group.id),
      ["g1", "g3"],
    );
    assert.strictEqual(
      next?.tasks.find((task) => task.id === "t2")?.groupId,
      "g1",
    );
    assert.strictEqual(next?.milestones[0].groupId, "g1");
    assert.deepStrictEqual(next?.dependencies.length, 2);
  });

  test("reparent from a root group leaves members ungrouped", () => {
    const next = buildGroupDeletionDocument(createDocument(), "g1", "reparent");

    assert.strictEqual(
      next?.groups.find((group) => group.id === "g2")?.groupId,
      undefined,
    );
    assert.strictEqual(
      next?.tasks.find((task) => task.id === "t1")?.groupId,
      undefined,
    );
  });

  test("returns undefined for an unknown group id", () => {
    assert.strictEqual(
      buildGroupDeletionDocument(createDocument(), "missing", "cascade"),
      undefined,
    );
  });

  test("does not mutate the input document", () => {
    const document = createDocument();

    buildGroupDeletionDocument(document, "g1", "cascade");

    assert.strictEqual(document.groups.length, 3);
    assert.strictEqual(document.tasks.length, 3);
  });
});
