import { DEFAULT_PROJECT_VIEW } from "@common/documents";
import {
  applyLegendSelection,
  entityFromChartEvent,
  LEGEND_LAYERS,
  legendSelection,
  resolveChartClick,
} from "@webview/features/chart/chartInteractions";
import * as assert from "assert";

/** Builds an ECharts-like click event on a series item. */
function click(
  seriesName: string,
  data: unknown,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  return { seriesName, data, event: { event: modifiers } };
}

const GROUP = { group: { id: "g1" } };
const TASK = { task: { id: "t1" } };
const MILESTONE = { milestone: { id: "m1" } };

suite("chartInteractions", () => {
  suite("entityFromChartEvent", () => {
    test("maps supported chart series and ignores other series", () => {
      assert.deepStrictEqual(entityFromChartEvent(click("tasks", TASK)), {
        kind: "task",
        id: "t1",
      });
      assert.deepStrictEqual(entityFromChartEvent(click("milestones", MILESTONE)), {
        kind: "milestone",
        id: "m1",
      });
      assert.deepStrictEqual(entityFromChartEvent(click("groups", GROUP)), {
        kind: "group",
        id: "g1",
      });
      assert.strictEqual(entityFromChartEvent(click("dependencies", {})), undefined);
    });
  });

  suite("resolveChartClick", () => {
    test("toggles a group on ctrl- or cmd-click", () => {
      for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
        assert.deepStrictEqual(resolveChartClick(click("groups", GROUP, modifiers)), {
          kind: "toggleGroup",
          groupId: "g1",
        });
      }
    });

    test("edits a group on a plain click", () => {
      assert.deepStrictEqual(resolveChartClick(click("groups", GROUP)), {
        kind: "edit",
        entity: { kind: "group", id: "g1" },
      });
    });

    test("edits tasks and milestones even on ctrl-click", () => {
      assert.deepStrictEqual(resolveChartClick(click("tasks", TASK, { ctrlKey: true })), {
        kind: "edit",
        entity: { kind: "task", id: "t1" },
      });
      assert.deepStrictEqual(resolveChartClick(click("milestones", MILESTONE, { ctrlKey: true })), {
        kind: "edit",
        entity: { kind: "milestone", id: "m1" },
      });
    });

    test("ignores clicks on dependencies and empty areas", () => {
      assert.deepStrictEqual(resolveChartClick(click("dependencies", {}, { ctrlKey: true })), {
        kind: "none",
      });
      assert.deepStrictEqual(resolveChartClick({}), { kind: "none" });
    });
  });

  suite("legend", () => {
    test("maps the persisted layers to legend series names", () => {
      assert.deepStrictEqual(legendSelection({ ...DEFAULT_PROJECT_VIEW, showOffDays: true }), {
        "dependencies": true,
        "off-days": true,
        "holidays": false,
      });
    });

    test("proposes a complete view for each persisted layer", () => {
      for (const [name, field] of LEGEND_LAYERS) {
        const selected = { [name]: !DEFAULT_PROJECT_VIEW[field] };
        assert.deepStrictEqual(applyLegendSelection(DEFAULT_PROJECT_VIEW, { name, selected }), {
          ...DEFAULT_PROJECT_VIEW,
          [field]: !DEFAULT_PROJECT_VIEW[field],
        });
      }
    });

    test("toggles the layer when the event omits its selection", () => {
      assert.strictEqual(
        applyLegendSelection(DEFAULT_PROJECT_VIEW, { name: "holidays", selected: {} })
          ?.showHolidays,
        true,
      );
    });

    test("ignores entity series toggled natively by the legend", () => {
      for (const name of ["tasks", "groups", "milestones", "timeline-header", "toString"]) {
        assert.strictEqual(
          applyLegendSelection(DEFAULT_PROJECT_VIEW, { name, selected: { [name]: false } }),
          undefined,
        );
      }
    });
  });
});
