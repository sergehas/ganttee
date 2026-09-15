import { DependencyType } from "@common/documents";
import { IconButton } from "../../../components/IconButton";
import { Select } from "../../../components/Select";
import { useTranslate } from "../../../l10n";
import { DependencyFieldsProps } from "../entityEditor.types";
import {
  DEPENDENCY_OPTIONS,
  dependencyTypeLabel,
  describeDependency,
} from "../entityEditorPresentation";
import "./DependencyFields.scss";

/** Renders the dependency list and add-dependency controls. */
export function DependencyFields(props: DependencyFieldsProps): React.JSX.Element {
  const t = useTranslate();
  return (
    <fieldset className="ganttee-dependency-fields">
      <legend>{t("Dependencies")}</legend>
      {props.dependencies.length === 0 && (
        <p className="ganttee-dependency-fields__empty">{t("No dependencies.")}</p>
      )}
      <ul>
        {props.dependencies.map((dep) => (
          <li key={dep.id}>
            <span>{describeDependency(dep, props.document, t)}</span>
            <IconButton
              icon="trash"
              label={t("Remove dependency")}
              onClick={() => props.onRemoveDependency(dep.id)}
            />
          </li>
        ))}
      </ul>
      <div className="ganttee-dependency-fields__controls">
        <Select
          value={props.dependencyType}
          aria-label={t("Dependency type")}
          onChange={(event) => props.onDependencyTypeChange(event.target.value as DependencyType)}
        >
          {DEPENDENCY_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {t(dependencyTypeLabel(type))}
            </option>
          ))}
        </Select>
        <Select
          value={props.dependencyTarget}
          aria-label={t("Dependency target")}
          onChange={(event) => props.onDependencyTargetChange(event.target.value)}
        >
          <option value="">{t("Select work item...")}</option>
          {props.dependencyCandidates.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </Select>
        <IconButton icon="add" label={t("Add")} onClick={props.onAddDependency} />
      </div>
    </fieldset>
  );
}
