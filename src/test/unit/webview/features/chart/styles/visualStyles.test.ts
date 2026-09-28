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
        task: { left: 145, top: 5, right: 255, bottom: 15 },
        group: { left: 145, top: 5, right: 255, bottom: 15 },
        milestone: { left: 195, top: 5, right: 205, bottom: 15 },
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
        ["circle", "circle"],
      );
    });
  });

  suite("shapes", () => {
    test("classic uses a rounded rectangle, a bracket, a diamond, and a right-angle link", () => {
      const style = bindStyle(VISUAL_STYLES.classic);
      assert.strictEqual(asElement(style.renderTask(fakeParams(), fakeApi(TASK))).shape?.r, 3);
      assert.strictEqual(
        asElement(style.renderGroup(fakeParams(), fakeApi(TASK))).type,
        "compoundPath",
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

    test("rounded uses half-circle task ends, circle milestones, and round joins", () => {
      const style = bindStyle(VISUAL_STYLES.rounded);
      assert.strictEqual(asElement(style.renderTask(fakeParams(), fakeApi(TASK))).shape?.r, 6);
      const group = asElement(style.renderGroup(fakeParams(), fakeApi(TASK)));
      assert.strictEqual((group.shape?.paths as unknown[]).length, 3);
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
      const [track, start, end] = task.children ?? [];
      assert.strictEqual(track.shape?.height, 4);
      assert.deepStrictEqual([start.shape?.cx, end.shape?.cx], [150, 250]);
      assert.deepStrictEqual([start.style?.stroke, start.style?.fill], [ITEM_COLOR, "#ffffff"]);
    });

    test("metro uses the theme background for station and group fills, with a white fallback", () => {
      const themeBackground = "#121314";
      const theme: ChartThemeData = { ...THEME, backgroundColor: themeBackground };
      const renderTask = bindThemeToRenderer(VISUAL_STYLES.metro.renderTask, theme);
      const renderGroup = bindThemeToRenderer(VISUAL_STYLES.metro.renderGroup, theme);
      const renderMilestone = bindThemeToRenderer(VISUAL_STYLES.metro.renderMilestone, theme);
      const task = asElement(renderTask(fakeParams(), fakeApi(TASK)));
      const group = asElement(renderGroup(fakeParams(), fakeApi(TASK)));
      const milestone = asElement(renderMilestone(fakeParams(), fakeApi(MILESTONE)));
      const themeWithoutBackground: ChartThemeData = { palette: [], textStyle: {} };
      const fallbackTask = asElement(
        bindThemeToRenderer(VISUAL_STYLES.metro.renderTask, themeWithoutBackground)(
          fakeParams(),
          fakeApi(TASK),
        ),
      );

      assert.deepStrictEqual(
        [task.children?.[1].style?.fill, group.style?.fill, milestone.style?.fill],
        [themeBackground, themeBackground, themeBackground],
      );
      assert.strictEqual(fallbackTask.children?.[1].style?.fill, "#ffffff");
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
        ["rect", 5, ITEM_COLOR],
      );
    });
  });

  suite("metro routes", () => {
    test("uses horizontal, 45°, horizontal segments when the horizontal gap is wide", () => {
      assert.deepStrictEqual(segmentKinds(metroRoute([150, 10], [250, 50])), ["h", "45", "h"]);
      assert.deepStrictEqual(segmentKinds(metroRoute([150, 10], [190, 50])), ["h", "45", "h"]);
    });

    test("uses a 45° then vertical segment when the horizontal gap is narrow", () => {
      assert.deepStrictEqual(segmentKinds(metroRoute([150, 10], [180, 110])), ["45", "v"]);
    });

    test("uses a vertical line when both ends share the same time", () => {
      assert.deepStrictEqual(metroRoute([150, 10], [150, 70]), [
        [150, 10],
        [150, 70],
      ]);
    });

    test("falls back to a right-angle route for backward links", () => {
      assert.deepStrictEqual(segmentKinds(metroRoute([250, 10], [150, 50])), ["h", "v", "h"]);
    });
  });
});
