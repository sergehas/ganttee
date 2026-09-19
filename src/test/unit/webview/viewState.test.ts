import { createEmptyDocument } from "@common/documents";
import { ProjectPresentation } from "@common/presentation";
import { createGanttViewState } from "@webview/viewState";
import * as assert from "assert";

/** Builds a complete presentation without a persisted schema version. */
function presentation(): ProjectPresentation {
  const document = createEmptyDocument();
  return {
    tasks: [
      {
        id: "task",
        name: "Task",
        start: "2026-09-08",
        duration: 1,
        effectiveStart: "2026-09-08T09:00:00.000Z",
        effectiveEnd: "2026-09-09T09:00:00.000Z",
        effectiveDuration: 1,
      },
    ],
    milestones: [],
    groups: [],
    dependencies: [],
    settings: document.settings,
    view: document.view,
    criticalPath: { nodeIds: ["task"], dependencyIds: [] },
  };
}

suite("viewState", () => {
  test("associates one host presentation with its revision", () => {
    const project = presentation();

    const result = createGanttViewState(project, 4);

    assert.deepStrictEqual(result, { project, revision: 4 });
  });

  test("does not require a persisted schema version", () => {
    const result = createGanttViewState(presentation(), 1);

    assert.strictEqual("version" in result.project, false);
    assert.strictEqual(result.project.tasks[0].effectiveDuration, 1);
  });
});
