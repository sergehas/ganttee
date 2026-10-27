import { toChartMs } from "@webview/features/chart/chartTime";
import * as assert from "assert";

suite("chartTime", () => {
  test("uses local midnight for date-only values", () => {
    assert.strictEqual(toChartMs("2026-01-01"), new Date(2026, 0, 1).getTime());
  });

  test("preserves an ISO timestamp's instant", () => {
    const timestamp = "2026-01-01T11:30:00.000Z";

    assert.strictEqual(toChartMs(timestamp), new Date(timestamp).getTime());
  });
});
