import { repairSequences } from "@services/ordering/sequenceRepairService";
import * as assert from "assert";

suite("sequenceRepairService", () => {
  test("derives a missing root sequence from groups, then tasks, then milestones", () => {
    const repaired = repairSequences({
      groups: [{ id: "g1" }],
      tasks: [{ id: "t1" }],
      milestones: [{ id: "m1" }],
    });

    assert.deepStrictEqual(repaired.sequence, ["g1", "t1", "m1"]);
  });

  test("derives a missing group sequence from its own direct children", () => {
    const repaired = repairSequences({
      groups: [{ id: "g1" }],
      tasks: [{ id: "t1", groupId: "g1" }],
      milestones: [{ id: "m1", groupId: "g1" }],
    }) as { groups: { id: string; sequence: string[] }[] };

    assert.deepStrictEqual(repaired.groups[0].sequence, ["t1", "m1"]);
  });

  test("keeps a valid stored sequence's relative order", () => {
    const repaired = repairSequences({
      tasks: [{ id: "t1" }, { id: "t2" }],
      sequence: ["t2", "t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["t2", "t1"]);
  });

  test("drops a duplicate id, keeping the first occurrence", () => {
    const repaired = repairSequences({
      tasks: [{ id: "t1" }, { id: "t2" }],
      sequence: ["t1", "t2", "t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["t1", "t2"]);
  });

  test("drops a foreign-owner id", () => {
    const repaired = repairSequences({
      groups: [{ id: "g1" }],
      tasks: [{ id: "t1", groupId: "g1" }],
      sequence: ["t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["g1"]);
  });

  test("drops a nested (non-direct-child) id", () => {
    const repaired = repairSequences({
      groups: [{ id: "g1" }, { id: "g2", groupId: "g1" }],
      tasks: [{ id: "t1", groupId: "g2" }],
      sequence: ["g1", "t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["g1"]);
  });

  test("drops a dangling id that resolves to nothing", () => {
    const repaired = repairSequences({
      tasks: [{ id: "t1" }],
      sequence: ["t1", "missing"],
    });

    assert.deepStrictEqual(repaired.sequence, ["t1"]);
  });

  test("appends an omitted direct child at the end, using fallback order", () => {
    const repaired = repairSequences({
      groups: [{ id: "g1" }],
      tasks: [{ id: "t1" }],
      sequence: ["t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["t1", "g1"]);
  });

  test("is idempotent on an already-valid sequence", () => {
    const raw = { tasks: [{ id: "t1" }, { id: "t2" }], sequence: ["t2", "t1"] };

    const once = repairSequences(raw);
    const twice = repairSequences(once);

    assert.deepStrictEqual(twice.sequence, once.sequence);
  });

  test("handles a combined missing-child and duplicate defect in one sequence", () => {
    const repaired = repairSequences({
      tasks: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
      sequence: ["t1", "t1"],
    });

    assert.deepStrictEqual(repaired.sequence, ["t1", "t2", "t3"]);
  });
});
