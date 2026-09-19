import { createEmptyDocument } from "@common/documents";
import { ProjectSnapshot } from "@common/models";
import { hydrateDocument } from "@services/model/projectModelService";
import { schedule } from "@services/schedule/schedulingService";
import * as assert from "assert";

suite("ProjectSnapshot", () => {
  test("joins authored items with effective schedules", () => {
    const document = createEmptyDocument();
    document.groups = [{ id: "group", name: "Group" }];
    document.tasks = [
      {
        id: "task",
        name: "Task",
        groupId: "group",
        start: "2026-01-05",
        duration: 1,
      },
    ];
    const model = hydrateDocument(document);

    const snapshot = new ProjectSnapshot(model, schedule(model), []);

    assert.strictEqual(snapshot.tasks[0].item, model.tasks[0]);
    assert.strictEqual(snapshot.item("task"), snapshot.tasks[0]);
    assert.strictEqual(snapshot.tasks[0].effective?.duration, 1);
    assert.ok(snapshot.groups[0].effective?.start instanceof Date);
  });

  test("preserves authored items when no schedule exists", () => {
    const model = hydrateDocument(createEmptyDocument());

    const snapshot = new ProjectSnapshot(model, undefined, []);

    assert.deepStrictEqual(snapshot.tasks, []);
    assert.strictEqual(snapshot.item("missing"), undefined);
  });
});
