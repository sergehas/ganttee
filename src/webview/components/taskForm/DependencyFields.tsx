import { DependencyType } from "../../../common/models";
import { useTranslate } from "../../l10n";
import { DependencyFieldsProps } from "../../types/taskForm";
import {
  DEPENDENCY_OPTIONS,
  describeDependency,
} from "../../utils/taskForm/entityPresentation";

/** Renders the dependency list and add-dependency controls. */
export function DependencyFields(
  props: DependencyFieldsProps,
): React.JSX.Element {
  const t = useTranslate();
  return (
    <fieldset className="ganttee-dependencies">
      <legend>{t("Dependencies")}</legend>
      {props.dependencies.length === 0 && (
        <p className="ganttee-muted">{t("No dependencies.")}</p>
      )}
      <ul>
        {props.dependencies.map((dep) => (
          <li key={dep.id}>
            <span>{describeDependency(dep, props.document, t)}</span>
            <button
              type="button"
              className="ganttee-icon-button"
              onClick={() => props.onRemoveDependency(dep.id)}
              aria-label={t("Remove dependency")}
              title={t("Remove dependency")}
            >
              <span className="codicon codicon-trash" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="ganttee-field-row">
        <select
          value={props.dependencyType}
          aria-label={t("Dependency type")}
          onChange={(event) =>
            props.onDependencyTypeChange(event.target.value as DependencyType)
          }
        >
          {DEPENDENCY_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {t(dependencyTypeLabel(type))}
            </option>
          ))}
        </select>
        <select
          value={props.dependencyTarget}
          aria-label={t("Dependency target")}
          onChange={(event) =>
            props.onDependencyTargetChange(event.target.value)
          }
        >
          <option value="">{t("Select work item...")}</option>
          {props.dependencyCandidates.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ganttee-icon-button"
          onClick={props.onAddDependency}
          aria-label={t("Add")}
          title={t("Add")}
        >
          <span className="codicon codicon-add" aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  );
}

/** Maps a dependency type to its English localization source message. */
function dependencyTypeLabel(type: DependencyType): string {
  switch (type) {
    case "startAfter":
      return "Start After";
    case "startWith":
      return "Start With";
    case "endWith":
      return "End With";
  }
}
