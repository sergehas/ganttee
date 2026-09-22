import { createEmptyDocument } from "@common/documents";
import { hydrateDocument } from "@services/model/projectModelService";
import { createProjectSnapshot } from "@services/model/projectSnapshotService";
import * as assert from "assert";

suite("projectSnapshotService", () => {
  test("schedules a valid model", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task", start: "2026-01-05", duration: 1 }];

    const result = createProjectSnapshot(hydrateDocument(document), []);

    assert.ok(result.snapshot.schedule);
    assert.strictEqual(result.schedulingError, undefined);
  });

  test("skips scheduling when diagnostics block it", () => {
    const model = hydrateDocument(createEmptyDocument());

    const result = createProjectSnapshot(model, [
      {
        kind: "underConstrained",
        severity: "blocking",
        entityIds: ["task"],
        count: 0,
      },
    ]);

    assert.strictEqual(result.snapshot.schedule, undefined);
    assert.strictEqual(result.schedulingError, undefined);
  });

  test("returns a snapshot when scheduling fails", () => {
    const document = createEmptyDocument();
    document.settings.workingCalendar.daysOff = [1, 2, 3, 4, 5, 6, 7];
    const model = hydrateDocument(document);

    const result = createProjectSnapshot(model, []);

    assert.strictEqual(result.snapshot.schedule, undefined);
    assert.match(result.schedulingError?.message ?? "", /Invalid working-time settings/);
  });

  test("rethrows unexpected scheduling errors", () => {
    const model = hydrateDocument(createEmptyDocument());
    const unexpectedError = new Error("Unexpected scheduler failure");
    Object.defineProperty(model.graph, "topologicalSort", {
      value: () => {
        throw unexpectedError;
      },
    });

    assert.throws(() => createProjectSnapshot(model, []), unexpectedError);
  });
});
