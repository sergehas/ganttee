import { createEmptyDocument } from "@common/documents";
import { ProjectSnapshot } from "@common/models";
import { hydrateDocument } from "@services/model/projectModelService";
import { toProjectPresentation } from "@services/model/projectPresentationService";
import { schedule } from "@services/schedule/schedulingService";
import * as assert from "assert";

suite("projectPresentationService", () => {
  test("flattens authored and effective values without a schema version", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task", start: "2026-01-05", duration: 1 }];
    const model = hydrateDocument(document);

    const presentation = toProjectPresentation(new ProjectSnapshot(model, schedule(model), []));

    assert.deepStrictEqual(presentation.tasks[0], {
      id: "task",
      name: "Task",
      start: "2026-01-05",
      duration: 1,
      effectiveStart: "2026-01-05T09:00:00.000Z",
      effectiveEnd: "2026-01-05T17:00:00.000Z",
      effectiveDuration: 1,
    });
    assert.strictEqual("version" in presentation, false);
  });

  test("omits effective values when scheduling is unavailable", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task", duration: 1 }];
    const model = hydrateDocument(document);

    const presentation = toProjectPresentation(new ProjectSnapshot(model, undefined, []));

    assert.deepStrictEqual(presentation.tasks[0], {
      id: "task",
      name: "Task",
      duration: 1,
    });
    assert.deepStrictEqual(presentation.criticalPath, { nodeIds: [], dependencyIds: [] });
  });
});
