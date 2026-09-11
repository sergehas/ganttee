import { formatShortDate } from "../../../common/datePresentation";
import { TaskStatus } from "../../../common/models";
import { validateTaskConstraints } from "../../../services/scheduleConstraintService";
import { makeUpdater } from "../../hooks/useFieldUpdater";
import { useTranslate, useWebviewL10n } from "../../l10n";
import { TaskFieldsProps } from "../../types/taskForm";
import { STATUS_OPTIONS } from "../../utils/taskForm/entityPresentation";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";
import { ValidationMessage } from "./ValidationMessage";

/** Renders task-specific fields plus dependency editing controls. */
export function TaskFields(props: TaskFieldsProps): React.JSX.Element {
  const { task, scheduledTask, onChange, ...depProps } = props;
  const { document } = depProps;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(task, onChange);

  const validation = validateTaskConstraints(task, document.dependencies);

  return (
    <>
      <CommonTextFields
        name={task.name}
        description={task.description}
        groupId={task.groupId}
        groups={document.groups}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />
      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>{t("Start")}</span>
          <input
            type="date"
            value={task.start ?? ""}
            onChange={(event) =>
              update("start", event.target.value || undefined)
            }
          />
          {scheduledTask && (
            <output>
              {formatShortDate(scheduledTask.effectiveStart(), locale)}
            </output>
          )}
        </label>
        <label className="ganttee-field">
          <span>{t("End")}</span>
          <input
            type="date"
            min={task.start}
            value={task.end ?? ""}
            onChange={(event) => update("end", event.target.value || undefined)}
          />
          {scheduledTask && (
            <output>
              {formatShortDate(scheduledTask.effectiveEnd(), locale)}
            </output>
          )}
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>{t("Duration")}</span>
          <input
            type="number"
            min={0}
            step="any"
            value={task.duration ?? ""}
            onChange={(event) =>
              update(
                "duration",
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
              )
            }
          />
          {scheduledTask && (
            <output>{scheduledTask.effectiveDuration()}</output>
          )}
        </label>
        <label className="ganttee-field">
          <span>{t("Progress")}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((task.progress ?? 0) * 100)}
            onChange={(event) =>
              update("progress", Number(event.target.value) / 100)
            }
          />
        </label>
      </div>

      <label className="ganttee-field">
        <span>{t("Status")}</span>
        <select
          value={task.status ?? "todo"}
          onChange={(event) =>
            update("status", event.target.value as TaskStatus)
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(taskStatusLabel(status))}
            </option>
          ))}
        </select>
      </label>

      {(validation.underConstrained || validation.overConstrained) && (
        <>
          {validation.blocking && (
            <ValidationMessage severity="error">
              {validation.underConstrained
                ? t(
                    "Task has {0} constraint(s); exactly 2 are needed to schedule.",
                    validation.count,
                  )
                : t(
                    "Task has {0} constraint(s); exactly 2 are needed to schedule.",
                    validation.count,
                  )}
            </ValidationMessage>
          )}
          {(validation.duplicateStart || validation.duplicateEnd) && (
            <ValidationMessage severity="warning">
              {validation.duplicateStart && validation.duplicateEnd
                ? t("Task has duplicate start and end constraints.")
                : validation.duplicateStart
                  ? t("Task has duplicate start constraints.")
                  : t("Task has duplicate end constraints.")}
            </ValidationMessage>
          )}
        </>
      )}

      <DependencyFields {...depProps} />
    </>
  );
}

/** Maps a task status to its English localization source message. */
function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "inProgress":
      return "In Progress";
    case "done":
      return "Done";
  }
}
