import {
  CURRENT_DOCUMENT_VERSION,
  DEFAULT_PROJECT_VIEW,
  PROJECT_STYLES,
  ProjectView,
  ZOOM_LEVELS,
} from "@common/documents";
import {
  validateDocumentShape,
  ViewDefaultWarning,
} from "@services/document/documentShapeValidationService";
import * as assert from "assert";

suite("documentShapeValidationService", () => {
  suite("validateDocumentShape root", () => {
    test("rejects non-object root values", () => {
      assert.throws(() => validateDocumentShape(null), /Document root must be an object/);
      assert.throws(() => validateDocumentShape("string"), /Document root must be an object/);
      assert.throws(() => validateDocumentShape(123), /Document root must be an object/);
      assert.throws(() => validateDocumentShape([]), /Document root must be an object/);
    });

    test("defaults version when omitted or non-number, and preserves numeric version", () => {
      const omitted = validateDocumentShape({});
      assert.strictEqual(omitted.version, CURRENT_DOCUMENT_VERSION);

      const nonNumber = validateDocumentShape({ version: "2" });
      assert.strictEqual(nonNumber.version, CURRENT_DOCUMENT_VERSION);

      const numeric = validateDocumentShape({ version: 42 });
      assert.strictEqual(numeric.version, 42);
    });

    test("rejects non-array collections", () => {
      assert.throws(() => validateDocumentShape({ tasks: "invalid" }), /tasks must be an array/);
      assert.throws(() => validateDocumentShape({ groups: 123 }), /groups must be an array/);
      assert.throws(() => validateDocumentShape({ milestones: {} }), /milestones must be an array/);
      assert.throws(
        () => validateDocumentShape({ dependencies: true }),
        /dependencies must be an array/,
      );
    });
  });

  suite("validateTask", () => {
    test("rejects non-object task entries", () => {
      assert.throws(() => validateDocumentShape({ tasks: [null] }), /tasks\[0\] must be an object/);
      assert.throws(
        () => validateDocumentShape({ tasks: ["string"] }),
        /tasks\[0\] must be an object/,
      );
    });

    test("validates required task id and name", () => {
      assert.throws(
        () => validateDocumentShape({ tasks: [{ name: "Task" }] }),
        /tasks\[0\]\.id must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "", name: "Task" }] }),
        /tasks\[0\]\.id must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1" }] }),
        /tasks\[0\]\.name must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "" }] }),
        /tasks\[0\]\.name must be a non-empty string/,
      );
    });

    test("validates optional task dates and duration", () => {
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", start: "bad-date" }] }),
        /tasks\[0\]\.start must be an ISO date/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", end: "2026-99-99" }] }),
        /tasks\[0\]\.end must be an ISO date/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", duration: -1 }] }),
        /tasks\[0\]\.duration must be a non-negative number/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", duration: NaN }] }),
        /tasks\[0\]\.duration must be a non-negative number/,
      );
    });

    test("validates optional task description, groupId, and state", () => {
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", description: "" }] }),
        /tasks\[0\]\.description must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ tasks: [{ id: "t1", name: "Task", groupId: "" }] }),
        /tasks\[0\]\.groupId must be a non-empty string/,
      );

      const doc = validateDocumentShape({
        tasks: [
          {
            id: "t1",
            name: "Task",
            description: "Some description",
            groupId: "g1",
            state: "closed",
            status: "status-1",
          },
          { id: "t2", name: "Task 2", state: "invalidState" as unknown as "open" },
        ],
      });
      assert.strictEqual(doc.tasks[0].description, "Some description");
      assert.strictEqual(doc.tasks[0].groupId, "g1");
      assert.strictEqual(doc.tasks[0].state, "closed");
      assert.strictEqual(doc.tasks[0].status, "status-1");
      assert.strictEqual(doc.tasks[1].state, undefined);
    });

    test("clamps task progress to the 0..1 range with non-number fallback", () => {
      const doc = validateDocumentShape({
        tasks: [
          { id: "t1", name: "Task 1", progress: -0.5 },
          { id: "t2", name: "Task 2", progress: 1.5 },
          { id: "t3", name: "Task 3", progress: 0.75 },
          { id: "t4", name: "Task 4", progress: NaN },
          { id: "t5", name: "Task 5", progress: "invalid" as unknown as number },
        ],
      });
      assert.strictEqual(doc.tasks[0].progress, 0);
      assert.strictEqual(doc.tasks[1].progress, 1);
      assert.strictEqual(doc.tasks[2].progress, 0.75);
      assert.strictEqual(doc.tasks[3].progress, 0);
      assert.strictEqual(doc.tasks[4].progress, 0);
    });
  });

  suite("validateGroup", () => {
    test("rejects non-object group entries", () => {
      assert.throws(
        () => validateDocumentShape({ groups: [null] }),
        /groups\[0\] must be an object/,
      );
    });

    test("validates required group id and name", () => {
      assert.throws(
        () => validateDocumentShape({ groups: [{ name: "Group" }] }),
        /groups\[0\]\.id must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ groups: [{ id: "g1" }] }),
        /groups\[0\]\.name must be a non-empty string/,
      );
    });

    test("validates optional group fields", () => {
      assert.throws(
        () => validateDocumentShape({ groups: [{ id: "g1", name: "Group", groupId: "" }] }),
        /groups\[0\]\.groupId must be a non-empty string/,
      );

      const doc = validateDocumentShape({
        groups: [
          {
            id: "g1",
            name: "G1",
            description: "Group description",
            groupId: "g0",
            state: "closed",
            status: "status-1",
            collapsed: true,
          },
        ],
      });
      assert.strictEqual(doc.groups[0].description, "Group description");
      assert.strictEqual(doc.groups[0].groupId, "g0");
      assert.strictEqual(doc.groups[0].state, "closed");
      assert.strictEqual(doc.groups[0].status, "status-1");
      assert.strictEqual("collapsed" in doc.groups[0], false);
    });
  });

  suite("validateMilestone", () => {
    test("rejects non-object milestone entries", () => {
      assert.throws(
        () => validateDocumentShape({ milestones: [null] }),
        /milestones\[0\] must be an object/,
      );
    });

    test("validates required milestone id and name", () => {
      assert.throws(
        () => validateDocumentShape({ milestones: [{ name: "M" }] }),
        /milestones\[0\]\.id must be a non-empty string/,
      );
      assert.throws(
        () => validateDocumentShape({ milestones: [{ id: "m1" }] }),
        /milestones\[0\]\.name must be a non-empty string/,
      );
    });

    test("validates optional milestone date, duration, and groupId", () => {
      assert.throws(
        () => validateDocumentShape({ milestones: [{ id: "m1", name: "M", date: "invalid" }] }),
        /milestones\[0\]\.date must be an ISO date/,
      );
      assert.throws(
        () => validateDocumentShape({ milestones: [{ id: "m1", name: "M", duration: 1 }] }),
        /milestones\[0\]\.duration must be 0/,
      );
      assert.throws(
        () => validateDocumentShape({ milestones: [{ id: "m1", name: "M", groupId: "" }] }),
        /milestones\[0\]\.groupId must be a non-empty string/,
      );

      const doc = validateDocumentShape({
        milestones: [
          {
            id: "m1",
            name: "M",
            date: "2026-06-01",
            duration: 0,
            description: "Milestone description",
            groupId: "g1",
            state: "open",
            status: "status-1",
          },
        ],
      });
      assert.strictEqual(doc.milestones[0].date, "2026-06-01");
      assert.strictEqual(doc.milestones[0].description, "Milestone description");
      assert.strictEqual(doc.milestones[0].groupId, "g1");
      assert.strictEqual(doc.milestones[0].state, "open");
      assert.strictEqual(doc.milestones[0].status, "status-1");
    });
  });

  suite("validateDependency", () => {
    test("rejects non-object dependency entries", () => {
      assert.throws(
        () => validateDocumentShape({ dependencies: [null] }),
        /dependencies\[0\] must be an object/,
      );
    });

    test("validates dependency type", () => {
      assert.throws(
        () =>
          validateDocumentShape({
            dependencies: [{ id: "d1", sourceId: "s", targetId: "t", type: "badType" }],
          }),
        /dependencies\[0\]\.type is invalid/,
      );
    });

    test("validates required dependency identifiers", () => {
      assert.throws(
        () =>
          validateDocumentShape({
            dependencies: [{ sourceId: "s", targetId: "t", type: "startAfter" }],
          }),
        /dependencies\[0\]\.id must be a non-empty string/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            dependencies: [{ id: "d1", targetId: "t", type: "startAfter" }],
          }),
        /dependencies\[0\]\.sourceId must be a non-empty string/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            dependencies: [{ id: "d1", sourceId: "s", type: "startAfter" }],
          }),
        /dependencies\[0\]\.targetId must be a non-empty string/,
      );

      const doc = validateDocumentShape({
        dependencies: [{ id: "d1", sourceId: "s", targetId: "t", type: "endWith" }],
      });
      assert.deepStrictEqual(doc.dependencies[0], {
        id: "d1",
        sourceId: "s",
        targetId: "t",
        type: "endWith",
      });
    });
  });

  suite("validateSettings", () => {
    test("resolves defaults when settings is not an object", () => {
      const doc = validateDocumentShape({ settings: "invalid" });
      assert.strictEqual(doc.settings.workingDayHours, 8);
    });

    test("validates working calendar daysOff ISO weekdays", () => {
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { workingCalendar: { daysOff: [0] } },
          }),
        /settings\.workingCalendar\.daysOff\[0\] must be an ISO weekday from 1 to 7/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { workingCalendar: { daysOff: [8] } },
          }),
        /settings\.workingCalendar\.daysOff\[0\] must be an ISO weekday from 1 to 7/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { workingCalendar: { daysOff: [1.5] } },
          }),
        /settings\.workingCalendar\.daysOff\[0\] must be an ISO weekday from 1 to 7/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { workingCalendar: { daysOff: ["1"] } },
          }),
        /settings\.workingCalendar\.daysOff\[0\] must be an ISO weekday from 1 to 7/,
      );

      const doc = validateDocumentShape({
        settings: { workingCalendar: { daysOff: [6, 7] } },
      });
      assert.deepStrictEqual(doc.settings.workingCalendar.daysOff, [6, 7]);
    });

    test("validates workingDayHours bounds", () => {
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayHours: 0 } }),
        /settings\.workingDayHours is outside its supported range/,
      );
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayHours: 25 } }),
        /settings\.workingDayHours is outside its supported range/,
      );
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayHours: "8" } }),
        /settings\.workingDayHours is outside its supported range/,
      );

      const doc = validateDocumentShape({ settings: { workingDayHours: 7.5 } });
      assert.strictEqual(doc.settings.workingDayHours, 7.5);
    });

    test("validates workingDayStart bounds", () => {
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayStart: -1 } }),
        /settings\.workingDayStart is outside its supported range/,
      );
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayStart: 24 } }),
        /settings\.workingDayStart is outside its supported range/,
      );
      assert.throws(
        () => validateDocumentShape({ settings: { workingDayStart: "9" } }),
        /settings\.workingDayStart is outside its supported range/,
      );

      const doc = validateDocumentShape({ settings: { workingDayStart: 9 } });
      assert.strictEqual(doc.settings.workingDayStart, 9);
    });

    test("validates holidays array and ranges", () => {
      assert.throws(
        () => validateDocumentShape({ settings: { holidays: "not-an-array" } }),
        /settings\.holidays must be an array/,
      );
      assert.throws(
        () => validateDocumentShape({ settings: { holidays: [null] } }),
        /settings\.holidays\[0\] must be an object/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: {
              holidays: [{ start: "2026-01-01", end: "2026-01-02", extra: true }],
            },
          }),
        /settings\.holidays\[0\] contains an unsupported property/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { holidays: [{ start: "2026-01-02", end: "2026-01-01" }] },
          }),
        /settings\.holidays\[0\]\.end must not precede settings\.holidays\[0\]\.start/,
      );
      assert.throws(
        () =>
          validateDocumentShape({
            settings: { holidays: [{ start: "2026-02-30", end: "2026-03-01" }] },
          }),
        /settings\.holidays\[0\]\.start must be an ISO date/,
      );

      const doc = validateDocumentShape({
        settings: {
          holidays: [{ start: "2026-12-25", end: "2026-12-26" }],
        },
      });
      assert.deepStrictEqual(doc.settings.holidays, [{ start: "2026-12-25", end: "2026-12-26" }]);
    });
  });

  suite("validateView", () => {
    test("resolves defaults when view is omitted", () => {
      const doc = validateDocumentShape({});
      assert.strictEqual(doc.view.zoomLevel, "week");
    });

    test("rejects non-object view and unsupported view properties", () => {
      assert.throws(() => validateDocumentShape({ view: "invalid" }), /view must be an object/);
      assert.throws(
        () => validateDocumentShape({ view: { unknownKey: true } }),
        /view\.unknownKey is not supported/,
      );
      assert.throws(
        () => validateDocumentShape({ view: { toString: true } }),
        /view\.toString is not supported/,
      );
    });

    test("defaults each recognized field holding an invalid value and reports it", () => {
      const invalidValues: [keyof ProjectView, unknown][] = [
        ["zoomLevel", "decade"],
        ["showDependencies", "not-a-bool"],
        ["showOffDays", 1],
        ["showHolidays", null],
        ["showCriticalPath", "yes"],
        ["style", "neon"],
        ["theme", ""],
        ["theme", "   "],
        ["theme", 3],
        ["showItemLabels", "yes"],
      ];
      for (const [field, value] of invalidValues) {
        const warnings: ViewDefaultWarning[] = [];
        const doc = validateDocumentShape({ view: { [field]: value } }, (warning) =>
          warnings.push(warning),
        );
        assert.deepStrictEqual(doc.view, DEFAULT_PROJECT_VIEW, field);
        assert.deepStrictEqual(warnings, [{ field, defaultValue: DEFAULT_PROJECT_VIEW[field] }]);
      }
    });

    test("defaults invalid values without a warning listener", () => {
      const doc = validateDocumentShape({ view: { style: "neon" } });
      assert.strictEqual(doc.view.style, "classic");
    });

    test("accepts every supported value without warnings", () => {
      const warnings: ViewDefaultWarning[] = [];
      for (const zoomLevel of ZOOM_LEVELS) {
        const doc = validateDocumentShape({ view: { zoomLevel } }, (warning) =>
          warnings.push(warning),
        );
        assert.strictEqual(doc.view.zoomLevel, zoomLevel);
      }
      for (const style of PROJECT_STYLES) {
        const doc = validateDocumentShape({ view: { style } }, (warning) => warnings.push(warning));
        assert.strictEqual(doc.view.style, style);
      }
      const view: ProjectView = {
        zoomLevel: "month",
        showDependencies: false,
        showOffDays: true,
        showHolidays: true,
        showCriticalPath: true,
        style: "metro",
        theme: "not-registered-yet",
        showItemLabels: true,
      };
      assert.deepStrictEqual(
        validateDocumentShape({ view }, (warning) => warnings.push(warning)).view,
        view,
      );
      assert.deepStrictEqual(warnings, []);
    });
  });
});
