import { createEmptyDocument } from "@common/documents";
import {
  labelSnapshotOf,
  labelSnapshotOfRaw,
  mergeLabelSnapshots,
} from "@common/models/diagnostics/labelSnapshot";
import * as assert from "assert";

suite("labelSnapshot", () => {
  test("captures labels from validated content", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "t", name: "T", groupId: "g" }];
    document.groups = [{ id: "g", name: "G" }];
    document.milestones = [{ id: "m", name: "M" }];
    document.dependencies = [{ id: "d", sourceId: "t", targetId: "m", type: "startAfter" }];
    const labels = labelSnapshotOf(document);
    assert.deepStrictEqual(
      labels.items.map((item) => `${item.kind}:${item.id}:${item.index}`),
      [
        "task:t:0",
        "milestone:m:0",
        "group:g:0",
        ...document.settings.statuses.map((status, index) => `status:${status.id}:${index}`),
      ],
    );
    assert.strictEqual(labels.items[0].groupId, "g");
    assert.deepStrictEqual(labels.dependencies, [
      { id: "d", sourceId: "t", targetId: "m", type: "startAfter", index: 0 },
    ]);
    assert.deepStrictEqual(labelSnapshotOf({}), { items: [], dependencies: [] });
  });

  test("reads raw payloads leniently and keeps authored indices", () => {
    const labels = labelSnapshotOfRaw({
      tasks: ["junk", { id: 4, name: "", groupId: "g" }, { id: "b", name: "B", groupId: 9 }],
      groups: { not: "an array" },
      settings: { statuses: [null, { id: "s", name: "S", groupId: "x" }] },
      dependencies: [
        7,
        { id: "d", sourceId: "b", targetId: 1, type: "startAfter" },
        { id: 3, type: "sideways" },
      ],
    });
    assert.deepStrictEqual(labels.items, [
      { kind: "task", id: "", name: undefined, index: 1, groupId: "g" },
      { kind: "task", id: "b", name: "B", index: 2, groupId: undefined },
      { kind: "status", id: "s", name: "S", index: 1, groupId: undefined },
    ]);
    assert.deepStrictEqual(labels.dependencies, [
      { id: "d", sourceId: "b", targetId: "", type: "startAfter", index: 1 },
      { id: "", sourceId: "", targetId: "", type: undefined, index: 2 },
    ]);
  });

  test("returns empty labels for non-object payloads and settings", () => {
    assert.deepStrictEqual(labelSnapshotOfRaw([]), { items: [], dependencies: [] });
    assert.deepStrictEqual(labelSnapshotOfRaw(null), { items: [], dependencies: [] });
    assert.deepStrictEqual(labelSnapshotOfRaw({ settings: 3 }), { items: [], dependencies: [] });
  });

  test("merges labels with the primary snapshot winning", () => {
    const merged = mergeLabelSnapshots(
      {
        items: [{ kind: "task", id: "a", name: "Draft", index: 0 }],
        dependencies: [{ id: "d", sourceId: "a", targetId: "b", index: 0 }],
      },
      {
        items: [
          { kind: "task", id: "a", name: "Saved", index: 0 },
          { kind: "group", id: "a", name: "Group", index: 0 },
        ],
        dependencies: [
          { id: "d", sourceId: "x", targetId: "y", index: 0 },
          { id: "e", sourceId: "x", targetId: "y", index: 1 },
        ],
      },
    );
    assert.deepStrictEqual(
      merged.items.map((item) => item.name),
      ["Draft", "Group"],
    );
    assert.deepStrictEqual(
      merged.dependencies.map((dependency) => dependency.sourceId),
      ["a", "x"],
    );
  });
});
