import { DependencyType } from "@common/documents";
import { IconButton } from "@webview/components/IconButton";
import { Select } from "@webview/components/Select";
import "@webview/features/entity-editor/components/DependencyFields.scss";
import { DependencyFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import {
  DEPENDENCY_OPTIONS,
  dependencyTypeLabel,
  entityKindIcon,
  findEntityRefById,
} from "@webview/features/entity-editor/entityEditorPresentation";
import { useTranslate } from "@webview/l10n";

/** Renders the dependency lists (driven-by / drives) and add-dependency controls. */
export function DependencyFields(props: DependencyFieldsProps): React.JSX.Element {
  const t = useTranslate();
  const drivenBy = props.dependencies.filter((dep) => dep.sourceId === props.ownerId);
  const drives = props.dependencies.filter((dep) => dep.targetId === props.ownerId);

  /** Renders the other side of a dependency as a link opening its edit form. */
  const renderOtherEntity = (id: string): React.ReactNode => {
    const other = findEntityRefById(props.document, id);
    if (!other) {
      return t("?");
    }
    return (
      <a
        href="#"
        onClick={(event) => {
          event.preventDefault();
          props.onRequestEditEntity(other);
        }}
      >
        <span className={`codicon codicon-${entityKindIcon(other.kind)}`} aria-hidden="true" />
        {other.name}
      </a>
    );
  };

  return (
    <>
      <fieldset className="ganttee-dependency-fields">
        <legend>{t("Driven by")}</legend>
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
        {drivenBy.length === 0 && (
          <p className="ganttee-dependency-fields__empty">{t("Not driven by anything.")}</p>
        )}
        <ul>
          {drivenBy.map((dep) => (
            <li key={dep.id}>
              <span>
                {t(dependencyTypeLabel(dep.type))} {t("→")} {renderOtherEntity(dep.targetId)}
              </span>
              <IconButton
                icon="trash"
                label={t("Remove dependency")}
                onClick={() => props.onRemoveDependency(dep.id)}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="ganttee-dependency-fields">
        <legend>{t("Drives")}</legend>
        {drives.length === 0 && (
          <p className="ganttee-dependency-fields__empty">{t("Drives nothing.")}</p>
        )}
        {drives.length > 0 && (
          <ul>
            {drives.map((dep) => (
              <li key={dep.id}>
                <span>
                  {renderOtherEntity(dep.sourceId)} {t("→")} {t(dependencyTypeLabel(dep.type))}
                </span>
                <IconButton
                  icon="trash"
                  label={t("Remove dependency")}
                  onClick={() => props.onRemoveDependency(dep.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </>
  );
}
