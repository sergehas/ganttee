import * as assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GanttDocument } from "../common/models";
import {
  GroupScheduleScopeView,
  useGroupScheduleScope,
} from "../webview/hooks/useGroupScheduleScope";

suite("useGroupScheduleScope", () => {
  test("returns derived schedule and direct member rows", () => {
    const document = createDocument();
    let capturedScope: GroupScheduleScopeView | undefined;

    const HookProbe = (): React.ReactElement => {
      capturedScope = useGroupScheduleScope(document, "g1");
      return React.createElement("div");
    };

    renderToStaticMarkup(React.createElement(HookProbe));

    assert.deepStrictEqual(capturedScope?.schedule, {
      start: "2026-01-01",
      end: "2026-01-06",
      durationDays: 5,
    });
    assert.deepStrictEqual(
      capturedScope?.directMemberRows.map((row) => row.id).sort(),
      ["group:g2", "milestone:m1", "task:t1"],
    );
  });
});

function createDocument(): GanttDocument {
  return {
    version: 2,
    groups: [
      { id: "g1", name: "Root" },
      { id: "g2", name: "Child", groupId: "g1" },
    ],
    tasks: [
      {
        id: "t1",
        name: "Direct Task",
        start: "2026-01-01",
        end: "2026-01-03",
        groupId: "g1",
      },
      {
        id: "t2",
        name: "Nested Task",
        start: "2026-01-04",
        end: "2026-01-06",
        groupId: "g2",
      },
    ],
    milestones: [
      { id: "m1", name: "Direct Milestone", date: "2026-01-02", groupId: "g1" },
    ],
    dependencies: [],
  };
}
