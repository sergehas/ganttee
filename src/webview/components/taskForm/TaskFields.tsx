import { TaskStatus } from "../../../common/models";
import { describeTaskConstraintValidation } from "../../../services/taskConstraintService";
import { makeUpdater } from "../../hooks/useFieldUpdater";
import { TaskFieldsProps } from "../../types/taskForm";
import { STATUS_OPTIONS } from "../../utils/taskForm/entityPresentation";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";

/** Renders task-specific fields plus dependency editing controls. */
export function TaskFields(props: TaskFieldsProps): JSX.Element {
  const { task, onChange, ...depProps } = props;
  const { document } = depProps;
  const update = makeUpdater(task, onChange);

  const validation = describeTaskConstraintValidation(
    task,
    document.dependencies,
  );

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
          <span>Start</span>
          <input
            type="date"
            value={task.start ?? ""}
            onChange={(event) =>
              update("start", event.target.value || undefined)
            }
          />
        </label>
        <label className="ganttee-field">
          <span>End</span>
          <input
            type="date"
            min={task.start}
            value={task.end ?? ""}
            onChange={(event) => update("end", event.target.value || undefined)}
          />
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Duration</span>
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
        </label>
        <label className="ganttee-field">
          <span>Progress</span>
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
        <span>Status</span>
        <select
          value={task.status ?? "todo"}
          onChange={(event) =>
            update("status", event.target.value as TaskStatus)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {(validation.underConstrained || validation.overConstrained) && (
        <div className="ganttee-validation-warning" role="status">
          <p>
            {validation.duplicateStart && validation.duplicateEnd
              ? "Task has duplicate start and end constraints."
              : validation.duplicateStart
                ? "Task has duplicate start constraints."
                : validation.duplicateEnd
                  ? "Task has duplicate end constraints."
                  : validation.underConstrained
                    ? `Task has ${validation.count} constraint(s); exactly 2 are needed to schedule.`
                    : `Task has ${validation.count} constraints; exactly 2 are needed to schedule.`}
          </p>
        </div>
      )}

      <DependencyFields {...depProps} />
    </>
  );
}
