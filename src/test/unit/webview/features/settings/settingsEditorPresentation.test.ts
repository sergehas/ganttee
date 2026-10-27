import { createEmptyDocument } from "@common/documents";
import {
  createHolidayRange,
  createNewStatus,
  createSettingsEditorPresentation,
  statusColorInputValue,
  decimalHourFromTimeInputValue,
  timeInputValueFromDecimalHour,
  updateStatusDraft,
} from "@webview/features/settings/settingsEditorPresentation";
import * as assert from "assert";

suite("settingsEditorPresentation", () => {
  test("builds Monday-first weekday controls from daysOff", () => {
    const settings = createEmptyDocument().settings;
    settings.workingCalendar.daysOff = [1, 3, 7];
    const document = createEmptyDocument();
    document.settings = settings;
    const presentation = createSettingsEditorPresentation(settings, document, localize);

    assert.deepStrictEqual(
      presentation.weekdays.map(({ weekday, label, isDayOff }) => [weekday, label, isDayOff]),
      [
        [1, "[Monday]", true],
        [2, "[Tuesday]", false],
        [3, "[Wednesday]", true],
        [4, "[Thursday]", false],
        [5, "[Friday]", false],
        [6, "[Saturday]", false],
        [7, "[Sunday]", true],
      ],
    );
  });

  test("builds localized holiday rows with stable range keys", () => {
    const settings = createEmptyDocument().settings;
    settings.holidays = [
      { start: "2026-12-24", end: "2026-12-26" },
      { start: "2027-01-01", end: "2027-01-01" },
    ];
    const document = createEmptyDocument();
    document.settings = settings;
    const presentation = createSettingsEditorPresentation(settings, document, localize);

    assert.deepStrictEqual(presentation.holidays, [
      {
        key: "2026-12-24-2026-12-26-0",
        index: 0,
        range: settings.holidays[0],
        label: "[2026-12-24 to 2026-12-26]",
        deleteLabel: "[Delete holiday 2026-12-24 to 2026-12-26]",
      },
      {
        key: "2027-01-01-2027-01-01-1",
        index: 1,
        range: settings.holidays[1],
        label: "[2027-01-01 to 2027-01-01]",
        deleteLabel: "[Delete holiday 2027-01-01 to 2027-01-01]",
      },
    ]);
  });

  test("builds status rows with one aggregate usage count", () => {
    const document = createEmptyDocument();
    document.settings.statuses = [
      { id: "active", name: "Active", color: "#008000ff" },
      { id: "unused", name: "Unused", color: "#000000ff" },
    ];
    document.groups = [{ id: "group", name: "Group", status: "active" }];
    document.tasks = [{ id: "task", name: "Task", status: "active" }];
    document.milestones = [{ id: "milestone", name: "Milestone", status: "active" }];

    const presentation = createSettingsEditorPresentation(document.settings, document, localize);

    assert.deepStrictEqual(
      presentation.statuses.map(({ status, usageCount }) => [status.id, usageCount]),
      [
        ["active", 3],
        ["unused", 0],
      ],
    );
  });

  test("builds only ordered, non-empty holiday ranges", () => {
    assert.deepStrictEqual(createHolidayRange("2026-01-01", "2026-01-01"), {
      start: "2026-01-01",
      end: "2026-01-01",
    });
    assert.strictEqual(createHolidayRange("", "2026-01-02"), undefined);
    assert.strictEqual(createHolidayRange("2026-01-03", "2026-01-02"), undefined);
  });

  test("normalizes color-input values from persisted colors", () => {
    assert.strictEqual(statusColorInputValue("#aabbccff"), "#aabbcc");
    assert.strictEqual(statusColorInputValue("#aabbcc"), "#aabbcc");
    assert.strictEqual(statusColorInputValue("invalid"), "#000000");
  });

  test("formats decimal hours for a time input without wrapping past midnight", () => {
    assert.strictEqual(timeInputValueFromDecimalHour(0), "00:00");
    assert.strictEqual(timeInputValueFromDecimalHour(9.25), "09:15");
    assert.strictEqual(timeInputValueFromDecimalHour(23.999), "23:59");
    assert.strictEqual(timeInputValueFromDecimalHour(-1), "");
    assert.strictEqual(timeInputValueFromDecimalHour(24), "");
  });

  test("converts a time input's milliseconds to decimal hours", () => {
    assert.strictEqual(decimalHourFromTimeInputValue(0), 0);
    assert.strictEqual(decimalHourFromTimeInputValue(9.25 * 60 * 60 * 1000), 9.25);
    assert.strictEqual(decimalHourFromTimeInputValue(Number.NaN), undefined);
    assert.strictEqual(decimalHourFromTimeInputValue(-1), undefined);
    assert.strictEqual(decimalHourFromTimeInputValue(24 * 60 * 60 * 1000), undefined);
  });

  test("builds new statuses with trimmed names and optional enforced state", () => {
    assert.deepStrictEqual(createNewStatus("  Active  ", "#008000", ""), {
      name: "Active",
      color: "#008000ff",
    });
    assert.deepStrictEqual(createNewStatus("Closed", "#ff0000", "closed"), {
      name: "Closed",
      color: "#ff0000ff",
      state: "closed",
    });
    assert.strictEqual(createNewStatus("   ", "#008000", ""), undefined);
  });

  test("updates status drafts without changing ids or existing alpha", () => {
    assert.deepStrictEqual(
      updateStatusDraft(
        { id: "status-1", name: "Active", color: "#00800080" },
        " Complete ",
        "#0000ff",
        "closed",
      ),
      { id: "status-1", name: "Complete", color: "#0000ff80", state: "closed" },
    );
  });
});

/** Brackets messages and substitutes localized placeholder values. */
function localize(source: string, ...values: unknown[]): string {
  return `[${source.replace(/\{(\d+)\}/g, (_placeholder, index: string) => String(values[Number(index)]))}]`;
}
