import { createEmptyDocument, Group, Milestone, ProjectDocument, Task } from "@common/documents";
import {
  bySourceOrder,
  depthFirstOrder,
  insertBeforeInSequence,
  insertIdsIntoOwnerSequence,
  insertManyBefore,
  removeFromSequence,
  removeIdsFromEverySequence,
  sequenceOf,
  sortSequence,
  withOwnerSequence,
} from "@services/ordering/sequenceOrderingService";
import * as assert from "assert";

/** Root sequence `["a"]`, plus one group `g1` with the given sequence. */
function withGroup(rootSequence: string[], groupSequence: string[]): ProjectDocument {
  return {
    ...createEmptyDocument(),
    sequence: rootSequence,
    groups: [{ id: "g1", name: "G1", sequence: groupSequence }],
  };
}

suite("sequenceOrderingService", () => {
  test("insertBeforeInSequence inserts before an existing id", () => {
    assert.deepStrictEqual(insertBeforeInSequence(["a", "b"], "x", "b"), ["a", "x", "b"]);
  });

  test("insertBeforeInSequence appends when beforeId is undefined", () => {
    assert.deepStrictEqual(insertBeforeInSequence(["a", "b"], "x", undefined), ["a", "b", "x"]);
  });

  test("insertBeforeInSequence appends when beforeId does not resolve", () => {
    assert.deepStrictEqual(insertBeforeInSequence(["a", "b"], "x", "missing"), ["a", "b", "x"]);
  });

  test("insertManyBefore preserves the given block order", () => {
    assert.deepStrictEqual(insertManyBefore(["a", "d"], ["b", "c"], "d"), ["a", "b", "c", "d"]);
  });

  test("removeFromSequence drops every removed id", () => {
    assert.deepStrictEqual(removeFromSequence(["a", "b", "c"], new Set(["b"])), ["a", "c"]);
  });

  test("sequenceOf reads root or group sequence, defaulting to empty", () => {
    const projectDoc = withGroup(["a"], ["b"]);

    assert.deepStrictEqual(sequenceOf(projectDoc, undefined), ["a"]);
    assert.deepStrictEqual(sequenceOf(projectDoc, "g1"), ["b"]);
    assert.deepStrictEqual(sequenceOf(projectDoc, "missing"), []);
  });

  test("withOwnerSequence replaces root or one group's sequence", () => {
    const projectDoc = withGroup(["a"], ["b"]);

    assert.deepStrictEqual(withOwnerSequence(projectDoc, undefined, ["z"]).sequence, ["z"]);
    assert.deepStrictEqual(withOwnerSequence(projectDoc, "g1", ["z"]).groups[0].sequence, ["z"]);
  });

  test("removeIdsFromEverySequence strips ids from root and every group", () => {
    const projectDoc: ProjectDocument = {
      ...createEmptyDocument(),
      sequence: ["a", "b"],
      groups: [
        { id: "g1", name: "G1", sequence: ["b", "c"] },
        { id: "g2", name: "G2", sequence: ["d"] },
      ],
    };

    const next = removeIdsFromEverySequence(projectDoc, new Set(["b"]));

    assert.deepStrictEqual(next.sequence, ["a"]);
    assert.deepStrictEqual(next.groups[0].sequence, ["c"]);
    assert.deepStrictEqual(next.groups[1].sequence, ["d"]);
  });

  test("insertIdsIntoOwnerSequence is a no-op for an empty id list", () => {
    const projectDoc: ProjectDocument = { ...createEmptyDocument(), sequence: ["a"] };

    assert.strictEqual(insertIdsIntoOwnerSequence(projectDoc, undefined, [], "a"), projectDoc);
  });

  test("insertIdsIntoOwnerSequence inserts into the root or a group scope", () => {
    const projectDoc = withGroup(["a"], []);

    assert.deepStrictEqual(insertIdsIntoOwnerSequence(projectDoc, undefined, ["x"], "a").sequence, [
      "x",
      "a",
    ]);
    assert.deepStrictEqual(
      insertIdsIntoOwnerSequence(projectDoc, "g1", ["y"], undefined).groups[0].sequence,
      ["y"],
    );
  });

  test("depthFirstOrder walks the root sequence, recursing into each group in place", () => {
    const projectDoc = withGroup(["g1", "t1"], ["t2"]);

    assert.deepStrictEqual(depthFirstOrder(projectDoc), ["g1", "t2", "t1"]);
  });

  test("bySourceOrder orders ids by their depth-first rank", () => {
    const projectDoc = withGroup(["g1", "t1"], ["t2"]);

    assert.deepStrictEqual(bySourceOrder(projectDoc, ["t1", "t2", "g1"]), ["g1", "t2", "t1"]);
  });

  test("sortSequence orders by effective start, then end, then name, then stable position", () => {
    const itemsById = new Map<string, Group | Task | Milestone>([
      ["a", { id: "a", name: "Beta", sequence: [] }],
      ["b", { id: "b", name: "Alpha", sequence: [] }],
      ["c", { id: "c", name: "Gamma", sequence: [] }],
    ]);
    const effectiveDates = new Map([
      ["a", { start: new Date("2026-01-02") }],
      ["b", { start: new Date("2026-01-02") }],
    ]);

    assert.deepStrictEqual(sortSequence(["a", "b", "c"], itemsById, "ascending", effectiveDates), [
      "b",
      "a",
      "c",
    ]);
    assert.deepStrictEqual(sortSequence(["a", "b", "c"], itemsById, "descending", effectiveDates), [
      "c",
      "a",
      "b",
    ]);
  });
});
