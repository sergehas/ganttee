import { ProjectItemState, ProjectSettings, ProjectStatus } from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";
import { updateProjectDayOff } from "@services/settings/projectSettingsWorkflow";
import { BooleanToggleField } from "@webview/components/BooleanToggleField";
import { FormField } from "@webview/components/FormField";
import { StatusRow } from "@webview/features/settings/components/StatusRow";
import {
  createHolidayRange,
  createNewStatus,
  createSettingsEditorPresentation,
  decimalHourFromTimeInputValue,
  HolidayRowPresentation,
  StatusRowPresentation,
  timeInputValueFromDecimalHour,
  WeekdayControlPresentation,
} from "@webview/features/settings/settingsEditorPresentation";
import { useTranslate } from "@webview/l10n";
import { ChangeEvent, SubmitEvent, useState } from "react";
import "./SettingsEditor.scss";

interface SettingsEditorProps {
  /** Current authoritative project document projection. */
  readonly project: ProjectPresentation;
  /** Whether the host is processing a settings proposal. */
  readonly busy: boolean;
  /** Localized host rejection message, when the last proposal failed. */
  readonly error: string | null;
  /** Proposes the next complete settings value. */
  readonly onUpdateSettings: (settings: ProjectSettings) => void;
  /** Proposes a status without a client-generated identifier. */
  readonly onAddStatus: (status: Omit<ProjectStatus, "id">) => void;
  /** Proposes an update to an existing status. */
  readonly onUpdateStatus: (status: ProjectStatus) => void;
  /** Requests deletion of a status after required confirmation. */
  readonly onDeleteStatus: (statusId: string) => void;
}

/** Renders document-backed working calendar, holidays, and status settings. */
export function SettingsEditor({
  project,
  busy,
  error,
  onUpdateSettings,
  onAddStatus,
  onUpdateStatus,
  onDeleteStatus,
}: SettingsEditorProps): React.JSX.Element {
  const translate = useTranslate();
  const settings = project.settings;
  const presentation = createSettingsEditorPresentation(settings, project, translate);
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusColor, setStatusColor] = useState("#008000");
  const [statusState, setStatusState] = useState<ProjectItemState | "">("");
  const [statusError, setStatusError] = useState<string | null>(null);

  /** Adds the entered inclusive range after checking its date order. */
  function submitHoliday(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const holiday = createHolidayRange(holidayStart, holidayEnd);
    if (!holiday) {
      setHolidayError(translate("Holiday end must not be before its start."));
      return;
    }
    setHolidayError(null);
    onUpdateSettings({
      ...settings,
      holidays: [...settings.holidays, holiday],
    });
    setHolidayStart("");
    setHolidayEnd("");
  }

  /** Adds a status definition and leaves id creation to the host. */
  function submitStatus(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const status = createNewStatus(statusName, statusColor, statusState);
    if (!status) {
      setStatusError(translate("Status name is required."));
      return;
    }
    setStatusError(null);
    onAddStatus(status);
    setStatusName("");
    setStatusState("");
  }

  /** Stores the current new-status name field value. */
  function updateStatusName(event: ChangeEvent<HTMLInputElement>): void {
    setStatusName(event.currentTarget.value);
  }

  /** Stores the current new-status color field value. */
  function updateNewStatusColor(event: ChangeEvent<HTMLInputElement>): void {
    setStatusColor(event.currentTarget.value);
  }

  /** Stores the current new-status lifecycle choice. */
  function updateNewStatusState(event: ChangeEvent<HTMLSelectElement>): void {
    setStatusState(event.currentTarget.value as ProjectItemState | "");
  }

  /** Stores the currently entered holiday start date. */
  function updateHolidayStart(event: ChangeEvent<HTMLInputElement>): void {
    setHolidayStart(event.currentTarget.value);
  }

  /** Stores the currently entered holiday end date. */
  function updateHolidayEnd(event: ChangeEvent<HTMLInputElement>): void {
    setHolidayEnd(event.currentTarget.value);
  }

  /** Proposes the working-hours value when its numeric field changes. */
  function updateWorkingHours(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.currentTarget.valueAsNumber;
    if (Number.isFinite(value)) {
      onUpdateSettings({ ...settings, workingDayHours: value });
    }
  }

  /** Proposes the working-day start value when its numeric field changes. */
  function updateWorkingDayStart(event: ChangeEvent<HTMLInputElement>): void {
    const value = decimalHourFromTimeInputValue(event.currentTarget.valueAsNumber);
    if (value !== undefined) {
      onUpdateSettings({ ...settings, workingDayStart: value });
    }
  }

  /** Proposes the selected weekday as working or non-working. */
  function updateWeekday(weekday: number, isDayOff: boolean): void {
    onUpdateSettings(updateProjectDayOff(settings, weekday, isDayOff ? "add" : "remove"));
  }

  /** Removes exactly one holiday range without changing the remaining ranges. */
  function deleteHoliday(index: number): void {
    onUpdateSettings({
      ...settings,
      holidays: [...settings.holidays.slice(0, index), ...settings.holidays.slice(index + 1)],
    });
  }

  /** Renders one weekday switch with its mapped ISO day-off behavior. */
  function renderWeekday(weekday: WeekdayControlPresentation): React.JSX.Element {
    /** Sends the selected state for this weekday to the shared settings workflow. */
    function handleWeekdayChange(isDayOff: boolean): void {
      updateWeekday(weekday.weekday, isDayOff);
    }

    return (
      <BooleanToggleField
        key={weekday.weekday}
        label={weekday.label}
        checked={weekday.isDayOff}
        disabled={busy}
        onChange={handleWeekdayChange}
      />
    );
  }

  /** Renders one inclusive holiday range and its delete action. */
  function renderHoliday(holiday: HolidayRowPresentation): React.JSX.Element {
    /** Deletes the range represented by this row. */
    function handleDeleteHoliday(): void {
      deleteHoliday(holiday.index);
    }

    return (
      <li className="ganttee-settings__list-row" key={holiday.key}>
        <span>{holiday.label}</span>
        <button
          type="button"
          className="ganttee-settings__quiet-button"
          aria-label={holiday.deleteLabel}
          disabled={busy}
          onClick={handleDeleteHoliday}
        >
          {translate("Delete")}
        </button>
      </li>
    );
  }

  /** Renders one status row with its current derived usage count. */
  function renderStatus(statusRow: StatusRowPresentation): React.JSX.Element {
    return (
      <StatusRow
        key={statusRow.status.id}
        status={statusRow.status}
        usageCount={statusRow.usageCount}
        busy={busy}
        onSave={onUpdateStatus}
        onDelete={onDeleteStatus}
      />
    );
  }

  return (
    <main className="ganttee-settings">
      <div className="ganttee-settings__content">
        <h1>{translate("Project settings")}</h1>
        {error && (
          <p className="ganttee-settings__error" role="alert">
            {error}
          </p>
        )}
        <section className="ganttee-settings__section" aria-labelledby="working-calendar-heading">
          <h2 id="working-calendar-heading">{translate("Working calendar")}</h2>
          <div className="ganttee-settings__weekday-list">
            {presentation.weekdays.map(renderWeekday)}
          </div>
          <div className="ganttee-settings__field-grid">
            <FormField label={translate("Working hours per day")}>
              <input
                type="number"
                min="0.01"
                max="24"
                step="0.25"
                value={settings.workingDayHours}
                disabled={busy}
                onChange={updateWorkingHours}
              />
            </FormField>
            <FormField label={translate("Working day starts at (UTC hour)")}>
              <input
                type="time"
                min="00:00"
                max="23:59"
                step="60"
                value={timeInputValueFromDecimalHour(settings.workingDayStart)}
                disabled={busy}
                onChange={updateWorkingDayStart}
              />
            </FormField>
          </div>
        </section>

        <section className="ganttee-settings__section" aria-labelledby="holidays-heading">
          <h2 id="holidays-heading">{translate("Holidays")}</h2>
          <ul className="ganttee-settings__list">{presentation.holidays.map(renderHoliday)}</ul>
          <form className="ganttee-settings__add-row" onSubmit={submitHoliday}>
            <FormField label={translate("Holiday start")}>
              <input
                type="date"
                required
                value={holidayStart}
                disabled={busy}
                onChange={updateHolidayStart}
              />
            </FormField>
            <FormField label={translate("Holiday end")}>
              <input
                type="date"
                required
                value={holidayEnd}
                disabled={busy}
                onChange={updateHolidayEnd}
              />
            </FormField>
            <button type="submit" disabled={busy}>
              {translate("Add holiday")}
            </button>
          </form>
          {holidayError && (
            <p className="ganttee-settings__error" role="alert">
              {holidayError}
            </p>
          )}
        </section>

        <section className="ganttee-settings__section" aria-labelledby="statuses-heading">
          <h2 id="statuses-heading">{translate("Statuses")}</h2>
          <ul className="ganttee-settings__status-list">
            {presentation.statuses.map(renderStatus)}
          </ul>
          <form className="ganttee-settings__add-row" onSubmit={submitStatus}>
            <FormField label={translate("Status name")}>
              <input
                type="text"
                required
                value={statusName}
                disabled={busy}
                onChange={updateStatusName}
              />
            </FormField>
            <FormField label={translate("Color")}>
              <input
                type="color"
                value={statusColor}
                disabled={busy}
                onChange={updateNewStatusColor}
              />
            </FormField>
            <FormField label={translate("Enforced state")}>
              <select value={statusState} disabled={busy} onChange={updateNewStatusState}>
                <option value="">{translate("No enforced state")}</option>
                <option value="open">{translate("Open")}</option>
                <option value="closed">{translate("Closed")}</option>
              </select>
            </FormField>
            <button type="submit" disabled={busy}>
              {translate("Add status")}
            </button>
          </form>
          {statusError && (
            <p className="ganttee-settings__error" role="alert">
              {statusError}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
