import { TaskStatus } from "../../../common/models";
import { describeTaskConstraints } from "../../../services/taskConstraintService";
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

  const constraints = describeTaskConstraints(task);
  const isProblematic =
    constraints.status === "underConstrained" ||
    constraints.status === "hyperstatic";

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

      {isProblematic && (
        <div className="ganttee-validation-warning">
          <p>
            {constraints.status === "underConstrained"
              ? `Task has ${constraints.count} constraint(s); need at least 2 to schedule.`
              : `Task has ${constraints.count} constraints; typically 2 are used.`}
          </p>
        </div>
      )}

      <DependencyFields {...depProps} />
    </>
  );
}
