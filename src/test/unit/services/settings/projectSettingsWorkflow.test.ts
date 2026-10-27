import { createEmptyDocument } from "@common/documents";
import {
  addProjectStatus,
  countProjectStatusUsage,
  deleteProjectStatus,
  updateProjectDayOff,
  updateProjectStatus,
} from "@services/settings/projectSettingsWorkflow";
import * as assert from "assert";

suite("projectSettingsWorkflow", () => {
  test("adds and removes one weekday without mutating the source document", () => {
    const settings = createEmptyDocument().settings;
    const withMondayOff = updateProjectDayOff(settings, 1, "add");
    const withSaturdayWorking = updateProjectDayOff(withMondayOff, 6, "remove");

    assert.deepStrictEqual(settings.workingCalendar.daysOff, [6, 7]);
    assert.deepStrictEqual(withMondayOff.workingCalendar.daysOff, [1, 6, 7]);
    assert.deepStrictEqual(withSaturdayWorking.workingCalendar.daysOff, [1, 7]);
  });

  test("rejects weekdays outside the ISO weekday range", () => {
    const settings = createEmptyDocument().settings;

    assert.throws(() => updateProjectDayOff(settings, 0, "add"), /ISO weekday/);
    assert.throws(() => updateProjectDayOff(settings, 8, "remove"), /ISO weekday/);
    assert.throws(() => updateProjectDayOff(settings, 1.5, "add"), /ISO weekday/);
  });

  test("returns the same settings when the weekday already has the requested value", () => {
    const settings = createEmptyDocument().settings;

    assert.strictEqual(updateProjectDayOff(settings, 6, "add"), settings);
    assert.strictEqual(updateProjectDayOff(settings, 1, "remove"), settings);
  });

  test("counts each matching group, task, and milestone once", () => {
    const document = createEmptyDocument();
    document.settings.statuses = [{ id: "active", name: "Active", color: "#00aa00ff" }];
    document.settings.statuses.push({ id: "other", name: "Other", color: "#0000ffff" });
    document.tasks = [
      { id: "task-1", name: "Task 1", status: "active" },
      { id: "task-2", name: "Task 2", status: "other" },
    ];
    document.groups = [{ id: "group-1", name: "Group 1", status: "active" }];
    document.milestones = [{ id: "milestone-1", name: "Milestone 1", status: "active" }];

    assert.strictEqual(countProjectStatusUsage(document, "active"), 3);
    assert.strictEqual(countProjectStatusUsage(document, "unused"), 0);
  });

  test("adds a status with a unique id when the factory first collides", () => {
    const document = createEmptyDocument();
    document.settings.statuses = [{ id: "existing", name: "Existing", color: "#00aa00ff" }];
    const generatedIds = ["existing", "new-status"];
    let generatedCount = 0;

    const updated = addProjectStatus(
      document,
      { name: "New", color: "#0000ffff", state: "open" },
      () => generatedIds[generatedCount++],
    );

    assert.strictEqual(updated.settings.statuses[1].id, "new-status");
    assert.strictEqual(updated.settings.statuses[1].state, "open");
    assert.strictEqual(generatedCount, 2);
    assert.strictEqual(document.settings.statuses.length, 1);
  });

  test("updates status metadata while preserving its id and assigned item states", () => {
    const document = createEmptyDocument();
    document.settings.statuses = [{ id: "active", name: "Active", color: "#00aa00ff" }];
    document.tasks = [{ id: "task", name: "Task", status: "active", state: "open" }];

    const updated = updateProjectStatus(document, {
      id: "active",
      name: "Complete",
      color: "#0000ffff",
      state: "closed",
    });

    assert.deepStrictEqual(updated?.settings.statuses, [
      { id: "active", name: "Complete", color: "#0000ffff", state: "closed" },
    ]);
    assert.deepStrictEqual(updated?.tasks, document.tasks);
    assert.deepStrictEqual(updated?.settings.statuses[1], document.settings.statuses[1]);
    assert.strictEqual(document.settings.statuses[0].name, "Active");
  });

  test("returns undefined when editing an unknown status", () => {
    const document = createEmptyDocument();

    assert.strictEqual(
      updateProjectStatus(document, {
        id: "missing",
        name: "Missing",
        color: "#0000ffff",
      }),
      undefined,
    );
  });

  test("deletes a status and unassigns all item kinds without changing item states", () => {
    const document = createEmptyDocument();
    document.settings.statuses = [
      { id: "active", name: "Active", color: "#00aa00ff", state: "closed" },
      { id: "other", name: "Other", color: "#0000ffff" },
    ];
    document.tasks = [{ id: "task", name: "Task", status: "active", state: "open" }];
    document.tasks.push({ id: "other-task", name: "Other task", status: "other" });
    document.groups = [{ id: "group", name: "Group", status: "active", state: "closed" }];
    document.milestones = [{ id: "milestone", name: "Milestone", status: "active" }];

    const updated = deleteProjectStatus(document, "active");

    assert.deepStrictEqual(updated?.settings.statuses, [document.settings.statuses[1]]);
    assert.strictEqual(updated?.tasks[0].status, undefined);
    assert.strictEqual(updated?.tasks[0].state, "open");
    assert.strictEqual(updated?.groups[0].status, undefined);
    assert.strictEqual(updated?.groups[0].state, "closed");
    assert.strictEqual(updated?.milestones[0].status, undefined);
    assert.strictEqual(document.tasks[0].status, "active");
  });

  test("returns undefined when deleting an unknown status", () => {
    assert.strictEqual(deleteProjectStatus(createEmptyDocument(), "missing"), undefined);
  });
});
