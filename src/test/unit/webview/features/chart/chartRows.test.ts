import {
  buildChartRows,
  ChartRowSource,
  toggleCollapsedGroup,
} from "@webview/features/chart/chartRows";
import * as assert from "assert";

/** Root: t1, g1 (t2, g2 (m1), g3 (empty)), t3. */
const PROJECT: ChartRowSource = {
  tasks: [
    { id: "t1", name: "Task 1" },
    { id: "t2", name: "Task 2" },
    { id: "t3", name: "Task 3" },
  ],
  milestones: [{ id: "m1", name: "Milestone" }],
  groups: [
    { id: "g1", name: "Group 1", sequence: ["t2", "g2", "g3"] },
    { id: "g2", name: "Group 2", sequence: ["m1"] },
    { id: "g3", name: "Group 3" },
  ],
  sequence: ["t1", "g1", "t3", "missing"],
};

/** Returns the visible row identifiers. */
function rowIds(collapsed: readonly string[]): string[] {
  return buildChartRows(PROJECT, new Set(collapsed)).map((row) => row.id);
}

suite("chartRows", () => {
  test("orders rows by the root sequence then each group's own sequence", () => {
    assert.deepStrictEqual(rowIds([]), ["t1", "g1", "t2", "g2", "m1", "g3", "t3"]);
    assert.deepStrictEqual(buildChartRows(PROJECT, new Set())[0], { id: "t1", label: "Task 1" });
  });

  test("hides every descendant of a collapsed group but keeps the group row", () => {
    assert.deepStrictEqual(rowIds(["g1"]), ["t1", "g1", "t3"]);
    assert.deepStrictEqual(rowIds(["g2"]), ["t1", "g1", "t2", "g2", "g3", "t3"]);
  });

  test("keeps a nested collapsed group hidden inside a collapsed parent", () => {
    assert.deepStrictEqual(rowIds(["g1", "g2"]), ["t1", "g1", "t3"]);
  });

  test("keeps an empty collapsed group as a single row", () => {
    assert.deepStrictEqual(rowIds(["g3"]), rowIds([]));
  });

  test("ignores collapsed identifiers of non-group rows", () => {
    assert.deepStrictEqual(rowIds(["t1", "m1"]), rowIds([]));
  });

  test("returns no rows for a project without a sequence", () => {
    assert.deepStrictEqual(buildChartRows({ ...PROJECT, sequence: undefined }, new Set()), []);
  });

  test("toggles collapse state without mutating the input", () => {
    const empty: ReadonlySet<string> = new Set();
    const collapsed = toggleCollapsedGroup(empty, "g1");
    const expanded = toggleCollapsedGroup(collapsed, "g1");

    assert.deepStrictEqual([...collapsed], ["g1"]);
    assert.deepStrictEqual([...expanded], []);
    assert.deepStrictEqual([...empty], []);
  });
});
