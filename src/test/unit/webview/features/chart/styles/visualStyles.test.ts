import { PROJECT_STYLES } from "@common/documents";
import { metroRoute } from "@webview/features/chart/styles/metroStyle";
import { bindThemeToRenderer, VisualStyle } from "@webview/features/chart/styles/visualStyle";
import { VISUAL_STYLES } from "@webview/features/chart/styles/visualStyles";
import type { ChartThemeData } from "@webview/features/chart/themes/chartThemes";
import * as assert from "assert";
import {
  asElement,
  boundingBox,
  fakeApi,
  fakeParams,
  GRID,
  ITEM_COLOR,
  polylinePoints,
  segmentKinds,
} from "./fakeRenderApi";

const TASK = [0, 5, 15];
const MILESTONE = [0, 10];
const LINK = [0, 5, 2, 15];
const THEME: ChartThemeData = { palette: [ITEM_COLOR], backgroundColor: "#ffffff", textStyle: {} };

/** Binds the test theme to all renderers in a style. */
function bindStyle(style: VisualStyle) {
  return {
    renderTask: bindThemeToRenderer(style.renderTask, THEME),
    renderGroup: bindThemeToRenderer(style.renderGroup, THEME),
    renderMilestone: bindThemeToRenderer(style.renderMilestone, THEME),
    renderDependency: bindThemeToRenderer(style.renderDependency, THEME),
  };
}

suite("visualStyles", () => {
  test("registers one style per supported identifier", () => {
    assert.deepStrictEqual(Object.keys(VISUAL_STYLES), [...PROJECT_STYLES]);
    for (const id of PROJECT_STYLES) {
      assert.strictEqual(VISUAL_STYLES[id].id, id);
    }
  });

  test("passes the selected theme data to each renderer", () => {
    let receivedTheme: ChartThemeData | undefined;
    const style = {
      ...VISUAL_STYLES.classic,
      renderTask: (
        params: Parameters<typeof VISUAL_STYLES.classic.renderTask>[0],
        api: Parameters<typeof VISUAL_STYLES.classic.renderTask>[1],
        theme: ChartThemeData,
      ) => {
        receivedTheme = theme;
        return VISUAL_STYLES.classic.renderTask(params, api, theme);
      },
    };

    bindThemeToRenderer(style.renderTask, THEME)(fakeParams(), fakeApi(TASK));

    assert.strictEqual(receivedTheme, THEME);
  });

  suite("global bounding boxes", () => {
    const expected = {
      classic: {
        task: { left: 150, top: 4, right: 250, bottom: 16 },
        group: { left: 150, top: 4, right: 250, bottom: 16 },
        milestone: { left: 194, top: 4, right: 206, bottom: 16 },
      },
      rounded: {
        task: { left: 150, top: 4, right: 250, bottom: 16 },
        group: { left: 150, top: 4, right: 250, bottom: 16 },
        milestone: { left: 194, top: 4, right: 206, bottom: 16 },
      },
      metro: {
        task: { left: 144, top: 4, right: 256, bottom: 16 },
        group: { left: 144.75, top: 4.75, right: 255.25, bottom: 15.25 },
        milestone: { left: 194.75, top: 4.75, right: 205.25, bottom: 15.25 },
      },
    } as const;

    for (const id of PROJECT_STYLES) {
      const style = bindStyle(VISUAL_STYLES[id]);

      test(`${id} task`, () => {
        assert.deepStrictEqual(
          boundingBox(style.renderTask(fakeParams(), fakeApi(TASK))),
          expected[id].task,
        );
      });

      test(`${id} group`, () => {
        assert.deepStrictEqual(
          boundingBox(style.renderGroup(fakeParams(), fakeApi(TASK))),
          expected[id].group,
        );
      });

      test(`${id} milestone`, () => {
        assert.deepStrictEqual(
          boundingBox(style.renderMilestone(fakeParams(), fakeApi(MILESTONE))),
          expected[id].milestone,
        );
      });

      test(`${id} dependency`, () => {
        assert.deepStrictEqual(boundingBox(style.renderDependency(fakeParams(), fakeApi(LINK))), {
          left: 150,
          top: 10,
          right: 250,
          bottom: 50,
        });
      });
    }
  });

  suite("clipping and omission", () => {
    for (const id of PROJECT_STYLES) {
      const style = bindStyle(VISUAL_STYLES[id]);

      test(`${id} omits items outside the grid`, () => {
        assert.strictEqual(style.renderTask(fakeParams(), fakeApi([0, -20, -15])), undefined);
        assert.strictEqual(style.renderGroup(fakeParams(), fakeApi([0, -20, -15])), undefined);
        assert.strictEqual(style.renderMilestone(fakeParams(), fakeApi([0, -20])), undefined);
      });

      test(`${id} keeps bars that cross the grid edge inside the grid`, () => {
        const bounds = boundingBox(style.renderGroup(fakeParams(), fakeApi([0, -5, 5])));
        assert.ok(bounds.left >= GRID.x, `${bounds.left}`);
      });
    }

    test("classic and rounded tasks are clipped to the grid", () => {
      for (const id of ["classic", "rounded"] as const) {
        const style = bindStyle(VISUAL_STYLES[id]);
        const bounds = boundingBox(style.renderTask(fakeParams(), fakeApi([0, -5, 5])));
        assert.strictEqual(bounds.left, GRID.x);
      }
    });

    test("metro keeps a task whose only visible part is its end station", () => {
      const style = bindStyle(VISUAL_STYLES.metro);
      const task = asElement(style.renderTask(fakeParams(), fakeApi([0, -1, -0.3])));
      assert.deepStrictEqual(
        task.children?.map((child) => child.type),
        ["circle", "circle", "rect"],
      );
    });
  });

  suite("shapes", () => {
    test("classic uses a rounded rectangle, a bracket, a diamond, and a right-angle link", () => {
      const style = bindStyle(VISUAL_STYLES.classic);
      assert.strictEqual(asElement(style.renderTask(fakeParams(), fakeApi(TASK))).shape?.r, 3);
      const group = asElement(style.renderGroup(fakeParams(), fakeApi(TASK)));
      assert.strictEqual(group.type, "group");
      assert.deepStrictEqual(
        group.children?.map((child) => child.type),
        ["compoundPath", "rect"],
      );
      assert.deepStrictEqual(group.children?.[1].shape, { x: 150, y: 4, width: 100, height: 12 });
      assert.deepStrictEqual(
        [
          group.children?.[1].style?.fill,
          group.children?.[1].style?.stroke,
          group.children?.[1].style?.lineWidth,
        ],
        ["rgba(0, 0, 0, 0)", "none", 0],
      );
      assert.strictEqual(
        asElement(style.renderMilestone(fakeParams(), fakeApi(MILESTONE))).type,
        "polygon",
      );
      assert.deepStrictEqual(
        segmentKinds(polylinePoints(style.renderDependency(fakeParams(), fakeApi(LINK)))),
        ["h", "v", "h"],
      );
    });

    test("rounded uses parenthesized group ends, circle milestones, and round joins", () => {
      const style = bindStyle(VISUAL_STYLES.rounded);
      assert.strictEqual(asElement(style.renderTask(fakeParams(), fakeApi(TASK))).shape?.r, 6);
      const group = asElement(style.renderGroup(fakeParams(), fakeApi(TASK)));
      assert.strictEqual(group.type, "group");
      const [band, leftArc, rightArc, hitTarget] = group.children ?? [];
      assert.strictEqual(band.type, "rect");
      assert.deepStrictEqual(
        [leftArc.type, leftArc.shape?.cx, leftArc.shape?.cy, leftArc.shape?.r],
        ["arc", 156, 10, 4.5],
      );
      assert.deepStrictEqual(
        [leftArc.shape?.startAngle, leftArc.shape?.endAngle],
        [Math.PI / 2, (3 * Math.PI) / 2],
      );
      assert.deepStrictEqual(
        [rightArc.type, rightArc.shape?.cx, rightArc.shape?.cy, rightArc.shape?.r],
        ["arc", 244, 10, 4.5],
      );
      assert.deepStrictEqual(
        [rightArc.shape?.startAngle, rightArc.shape?.endAngle],
        [-Math.PI / 2, Math.PI / 2],
      );
      assert.deepStrictEqual(
        [leftArc.style?.stroke, leftArc.style?.lineWidth, leftArc.style?.fill],
        [ITEM_COLOR, 3, "none"],
      );
      assert.deepStrictEqual(hitTarget.shape, { x: 150, y: 4, width: 100, height: 12 });
      assert.strictEqual(
        asElement(style.renderMilestone(fakeParams(), fakeApi(MILESTONE))).type,
        "circle",
      );
      assert.strictEqual(
        asElement(style.renderDependency(fakeParams(), fakeApi(LINK))).style?.lineJoin,
        "round",
      );
    });

    test("metro task is a thin track with a station on each end", () => {
      const style = bindStyle(VISUAL_STYLES.metro);
      const task = asElement(style.renderTask(fakeParams(), fakeApi(TASK)));
      const [track, start, end, hitTarget] = task.children ?? [];
      assert.strictEqual(track.shape?.height, 4);
      assert.deepStrictEqual([start.shape?.cx, end.shape?.cx], [150, 250]);
      assert.deepStrictEqual([start.style?.stroke, start.style?.fill], [ITEM_COLOR, ITEM_COLOR]);
      assert.deepStrictEqual(hitTarget.shape, { x: 144, y: 4, width: 112, height: 12 });
      assert.deepStrictEqual(
        [hitTarget.style?.fill, hitTarget.style?.stroke, hitTarget.style?.lineWidth],
        ["rgba(0, 0, 0, 0)", "none", 0],
      );
    });

    test("metro uses the theme background for station and group fills, with a white fallback", () => {
      const themeBackground = "#121314";
      const theme: ChartThemeData = { ...THEME, backgroundColor: themeBackground };
      const renderGroup = bindThemeToRenderer(VISUAL_STYLES.metro.renderGroup, theme);
      const renderMilestone = bindThemeToRenderer(VISUAL_STYLES.metro.renderMilestone, theme);
      const group = asElement(renderGroup(fakeParams(), fakeApi(TASK)));
      const milestone = asElement(renderMilestone(fakeParams(), fakeApi(MILESTONE)));
      const themeWithoutBackground: ChartThemeData = { palette: [], textStyle: {} };
      const fallbackGroup = asElement(
        bindThemeToRenderer(VISUAL_STYLES.metro.renderGroup, themeWithoutBackground)(
          fakeParams(),
          fakeApi(TASK),
        ),
      );
      const fallbackMilestone = asElement(
        bindThemeToRenderer(VISUAL_STYLES.metro.renderMilestone, themeWithoutBackground)(
          fakeParams(),
          fakeApi(MILESTONE),
        ),
      );

      assert.deepStrictEqual(
        [group.style?.fill, milestone.style?.fill],
        [themeBackground, themeBackground],
      );
      assert.deepStrictEqual(
        [fallbackGroup.style?.fill, fallbackMilestone.style?.fill],
        ["#ffffff", "#ffffff"],
      );
    });

    test("metro milestone is a station", () => {
      const style = bindStyle(VISUAL_STYLES.metro);
      const milestone = asElement(style.renderMilestone(fakeParams(), fakeApi(MILESTONE)));
      assert.deepStrictEqual(
        [milestone.type, milestone.shape?.cx, milestone.style?.stroke],
        ["circle", 200, ITEM_COLOR],
      );
    });

    test("metro group is an outlined interchange capsule", () => {
      const style = bindStyle(VISUAL_STYLES.metro);
      const group = asElement(style.renderGroup(fakeParams(), fakeApi(TASK)));
      assert.deepStrictEqual(
        [group.type, group.shape?.r, group.style?.stroke],
        ["rect", 5.25, ITEM_COLOR],
      );
    });

    test("metro dependency uses straight lines and cubic bends", () => {
      const style = bindStyle(VISUAL_STYLES.metro);
      const dependency = asElement(style.renderDependency(fakeParams(), fakeApi(LINK)));
      assert.deepStrictEqual(
        dependency.children?.map((child) => child.type),
        ["line", "bezierCurve", "line", "bezierCurve", "line"],
      );
      assert.deepStrictEqual(
        dependency.children?.map((child) => child.style?.lineWidth),
        [4, 4, 4, 4, 4],
      );
    });
  });

  suite("metro routes", () => {
    test("keeps the three route segments straight between their bends", () => {
      const points = metroRoute([150, 10], [240, 70], 10);
      assert.deepStrictEqual(points, [
        [150, 10],
        [180, 10],
        [210, 70],
        [240, 70],
      ]);
      assert.deepStrictEqual(segmentKinds(points), ["h", "other", "h"]);
    });

    test("uses one horizontal run and one oblique run when the span is too short for both bends", () => {
      const points = metroRoute([150, 10], [179, 70], 10);
      assert.deepStrictEqual(points, [
        [150, 10],
        [150 + 29 / 3, 10],
        [179, 70],
      ]);
      assert.deepStrictEqual(segmentKinds(points), ["h", "other"]);
    });

    test("keeps the three-run route when horizontal span equals the bend threshold", () => {
      assert.deepStrictEqual(metroRoute([150, 10], [180, 70], 10), [
        [150, 10],
        [160, 10],
        [180, 70],
      ]);
    });

    test("uses a vertical line when the horizontal gap is within tolerance", () => {
      assert.deepStrictEqual(metroRoute([150, 10], [150.25, 70], 10), [
        [150, 10],
        [150, 70],
      ]);
    });

    test("falls back to a right-angle route for backward links", () => {
      assert.deepStrictEqual(segmentKinds(metroRoute([250, 10], [150, 50], 10)), ["h", "v", "h"]);
    });
  });
});
