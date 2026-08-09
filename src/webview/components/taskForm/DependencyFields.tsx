import { DependencyType } from "../../../common/models";
import { DependencyFieldsProps } from "../../types/taskForm";
import {
  DEPENDENCY_OPTIONS,
  describeDependency,
} from "../../utils/taskForm/entityPresentation";

/** Renders the dependency list and add-dependency controls. */
export function DependencyFields(props: DependencyFieldsProps): JSX.Element {
  return (
    <fieldset className="ganttee-dependencies">
      <legend>Dependencies</legend>
      {props.dependencies.length === 0 && (
        <p className="ganttee-muted">No dependencies.</p>
      )}
      <ul>
        {props.dependencies.map((dep) => (
          <li key={dep.id}>
            <span>{describeDependency(dep, props.document)}</span>
            <button
              type="button"
              className="ganttee-icon-button"
              onClick={() => props.onRemoveDependency(dep.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="ganttee-field-row">
        <select
          value={props.dependencyType}
          onChange={(event) =>
            props.onDependencyTypeChange(event.target.value as DependencyType)
          }
        >
          {DEPENDENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={props.dependencyTarget}
          onChange={(event) =>
            props.onDependencyTargetChange(event.target.value)
          }
        >
          <option value="">Select work item…</option>
          {props.dependencyCandidates.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={props.onAddDependency}>
          Add
        </button>
      </div>
    </fieldset>
  );
}
