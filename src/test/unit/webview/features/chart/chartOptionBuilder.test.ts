import { createEmptyDocument } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import {
  buildChartAxisOption,
  buildChartControlOption,
  buildChartDataOption,
  buildChartOption,
  buildChartStaticOption,
  buildChartTimelineOption,
  buildChartViewportOption,
  ChartOptionInput,
} from "@webview/features/chart/chartOptionBuilder";
import * as assert from "assert";

/** Builds a project presentation containing one scheduled task. */
function createProject(
  criticalPath: ProjectPresentation["criticalPath"] = { nodeIds: [], dependencyIds: [] },
): ProjectPresentation {
  const document = createEmptyDocument();
  return {
    ...document,
    tasks: [
      {
        id: "task",
        name: "Task",
        start: "2026-09-08",
        end: "2026-09-09",
        effectiveStart: "2026-09-08T09:00:00.000Z",
        effectiveEnd: "2026-09-09T09:00:00.000Z",
        effectiveDuration: 1,
      },
    ],
    groups: [],
    milestones: [],
    dependencies: [],
    criticalPath,
  };
}

suite("chartOptionBuilder", () => {
  test("builds the chart layers and scheduled task data", () => {
    const project = createProject();
    project.settings.statuses.push({ id: "ready", name: "Ready", color: "#00aa00" });
    project.tasks[0].status = "ready";
    project.tasks.push({
      id: "plain",
      name: "Plain",
      effectiveStart: "2026-09-10T09:00:00.000Z",
      effectiveEnd: "2026-09-11T09:00:00.000Z",
      effectiveDuration: 1,
    });
    const option = buildChartOption(createInput(project));
    const series = option.series as readonly {
      readonly name?: string;
      readonly data?: readonly unknown[];
    }[];

    assert.deepStrictEqual(
      series.map((item) => item.name),
      ["groups", "tasks", "milestones", "dependencies", "timeline-header", "off-days", "holidays"],
    );
    assert.strictEqual(series[1].data?.length, 2);
    const yAxis = (Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis) as {
      readonly data?: readonly string[];
      readonly axisPointer?: { readonly show?: boolean };
    };
    assert.deepStrictEqual(yAxis?.data, ["Task", "Plain"]);
    assert.strictEqual(yAxis?.axisPointer?.show, true);
    const tooltip = option.tooltip as { readonly formatter: (params: unknown) => string };
    const tooltipText = tooltip.formatter({ data: { task: project.tasks[0] } });
    assert.ok(tooltipText.includes("Task"));
    assert.ok(tooltipText.includes("Ready"));
    assert.ok(tooltipText.includes("#00aa00"));
    const legend = option.legend as { readonly formatter: (name: string) => string };
    assert.strictEqual(legend.formatter("tasks"), "tasks");
  });

  test("builds colored critical items, valid links, and intersecting calendar areas", () => {
    const project = createProject({
      nodeIds: ["task", "group", "milestone"],
      dependencyIds: ["valid"],
    });
    project.view.style = "metro";
    project.view.showCriticalPath = true;
    project.view.showItemLabels = true;
    project.settings.statuses.push({ id: "blocked", name: "Blocked", color: "#aa0000" });
    project.tasks[0].groupId = "group";
    project.tasks[0].status = "blocked";
    project.tasks.push({
      id: "plain",
      name: "Plain",
      status: "unknown",
      effectiveStart: "2026-09-10T09:00:00.000Z",
      effectiveEnd: "2026-09-14T09:00:00.000Z",
      effectiveDuration: 2,
    });
    project.tasks.push({
      id: "hidden",
      name: "Hidden",
      effectiveStart: "2026-09-11T09:00:00.000Z",
      effectiveEnd: "2026-09-12T09:00:00.000Z",
      effectiveDuration: 1,
    });
    project.groups.push({
      id: "group",
      name: "Group",
      sequence: ["task", "plain"],
      status: "blocked",
      effectiveStart: "2026-09-08T09:00:00.000Z",
      effectiveEnd: "2026-09-14T09:00:00.000Z",
      effectiveDuration: 4,
    });
    project.milestones.push({
      id: "milestone",
      name: "Milestone",
      date: "2026-09-10",
      effectiveStart: "2026-09-10T09:00:00.000Z",
      effectiveEnd: "2026-09-10T09:00:00.000Z",
      effectiveDuration: 0,
    });
    project.dependencies.push(
      { id: "valid", sourceId: "task", targetId: "milestone", type: "startAfter" },
      { id: "colored", sourceId: "plain", targetId: "task", type: "startWith" },
      { id: "end", sourceId: "task", targetId: "milestone", type: "endWith" },
      { id: "missing", sourceId: "missing", targetId: "task", type: "startWith" },
    );
    project.sequence = ["group", "task", "plain", "milestone"];
    project.settings.holidays.push(
      { start: "2026-09-09", end: "2026-09-10" },
      { start: "2030-01-01", end: "2030-01-02" },
    );
    const input = createInput(project, {
      coloredStyleEnabled: true,
      themeData: {
        color: [
          "#group-color",
          "#task-color",
          "#milestone-color",
          "#dependencies-color",
          "#timeline-color",
          "#off-days-color",
          "#holidays-color",
          "#critical-color",
        ],
      },
    });
    const option = buildChartOption({
      ...input,
      rows: input.rows.filter((row) => row.id !== "hidden"),
    });
    const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis;
    assert.strictEqual(yAxis?.axisPointer?.show, false);
    const series = option.series as readonly {
      readonly name?: string;
      readonly data?: readonly {
        readonly id?: string;
        readonly value?: readonly number[];
        readonly itemStyle?: { readonly color?: string; readonly borderColor?: string };
      }[];
    }[];
    const layer = (name: string) => series.find((item) => item.name === name)?.data ?? [];

    assert.strictEqual(layer("groups").length, 1);
    assert.strictEqual(layer("tasks").length, 2);
    assert.strictEqual(layer("milestones").length, 1);
    assert.deepStrictEqual(layer("groups")[0]?.itemStyle, { color: "#critical-color" });
    assert.deepStrictEqual(layer("tasks")[0]?.itemStyle, { color: "#critical-color" });
    assert.deepStrictEqual(layer("milestones")[0]?.itemStyle, { color: "#critical-color" });
    assert.deepStrictEqual(
      layer("dependencies").map((item) => item?.id),
      ["valid", "colored", "end", undefined],
    );
    assert.deepStrictEqual(layer("dependencies")[0]?.itemStyle, { color: "#critical-color" });
    assert.strictEqual(layer("off-days").length > 0, true);
    assert.strictEqual(layer("holidays").length, 1);
  });

  test("uses a fallback range for projects without scheduled items", () => {
    const document = createEmptyDocument();
    const project: ProjectPresentation = {
      ...document,
      tasks: [],
      groups: [],
      milestones: [],
      dependencies: [],
      criticalPath: { nodeIds: [], dependencyIds: [] },
    };
    project.view.zoomLevel = "year";
    const option = buildChartOption(createInput(project, { coloredStyleEnabled: true }));

    assert.ok(Array.isArray(option.series));
    assert.strictEqual((option.series as readonly { readonly name?: string }[])[1].name, "tasks");
  });

  test("scales both axis margins with the chart width", () => {
    const project = createProject();
    const narrowOption = buildChartOption(createInput(project, { chartWidth: 400 }));
    const wideOption = buildChartOption(createInput(project, { chartWidth: 1000 }));
    const narrowMinimum = (narrowOption.xAxis as { readonly min: number }).min;
    const wideMinimum = (wideOption.xAxis as { readonly min: number }).min;
    const narrowMaximum = (narrowOption.xAxis as { readonly max: number }).max;
    const wideMaximum = (wideOption.xAxis as { readonly max: number }).max;

    assert.ok(narrowMinimum < wideMinimum);
    assert.ok(narrowMaximum > wideMaximum);
  });

  test("builds static, control, data, viewport, and resize options separately", () => {
    const input = createInput(createProject());
    const staticOption = buildChartStaticOption(input);
    const controlOption = buildChartControlOption(input);
    const dataOption = buildChartDataOption(input);
    const timelineOption = buildChartTimelineOption(input);
    const viewportOption = buildChartViewportOption(input);
    const resizeOption = buildChartAxisOption(input);

    assert.strictEqual(staticOption.animation, true);
    assert.deepStrictEqual(Object.keys(controlOption), ["legend"]);
    assert.deepStrictEqual(Object.keys(dataOption), ["grid", "xAxis", "yAxis", "series"]);
    assert.deepStrictEqual(Object.keys(timelineOption), ["grid", "xAxis", "series"]);
    assert.deepStrictEqual(
      (timelineOption.series as readonly { readonly id?: string }[]).map(({ id }) => id),
      ["timeline-header"],
    );
    assert.deepStrictEqual(Object.keys(viewportOption), ["dataZoom"]);
    assert.deepStrictEqual(Object.keys(resizeOption), ["xAxis"]);
  });
});

/** Creates builder inputs with optional overrides for one presentation. */
function createInput(
  project: ProjectPresentation,
  overrides: Partial<Omit<ChartOptionInput, "project">> = {},
): ChartOptionInput {
  return {
    project,
    view: project.view,
    rows: [...project.tasks, ...project.milestones, ...project.groups].map(({ id, name }) => ({
      id,
      label: name,
    })),
    chartWidth: 800,
    themeData: { color: ["#111111", "#222222", "#333333"] },
    legendVisible: true,
    coloredStyleEnabled: false,
    locale: "en-US",
    unavailable: "—",
    translate: (text) => text,
    ...overrides,
  };
}
