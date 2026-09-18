import { diffIsoDates } from "@common/dates";
import { createDefaultTask } from "@common/documents/project/task";
import * as assert from "assert";

suite("Task", () => {
  test("creates a default task with a three-day range", () => {
    const task = createDefaultTask("New Task");

    assert.notStrictEqual(task.id, undefined);
    assert.notStrictEqual(task.id, "");
    assert.strictEqual(task.name, "New Task");
    assert.strictEqual(task.progress, 0);
    assert.strictEqual(task.status, "todo");
    assert.strictEqual(diffIsoDates(task.start ?? "", task.end ?? ""), 3);
  });
});
