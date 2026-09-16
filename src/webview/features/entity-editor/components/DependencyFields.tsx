import { DependencyType } from "@common/documents";
import { IconButton } from "@webview/components/IconButton";
import { Select } from "@webview/components/Select";
import "@webview/features/entity-editor/components/DependencyFields.scss";
import { DependencyFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import {
  DEPENDENCY_OPTIONS,
  dependencyTypeLabel,
  describeDependency,
} from "@webview/features/entity-editor/entityEditorPresentation";
import { useTranslate } from "@webview/l10n";

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
