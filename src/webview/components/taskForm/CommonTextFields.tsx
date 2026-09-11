import { useTranslate } from "../../l10n";
import { CommonTextFieldsProps } from "../../types/taskForm";

/** Renders name, description, and group assignment fields shared by all entity types. */
export function CommonTextFields(
  props: CommonTextFieldsProps,
): React.JSX.Element {
  const t = useTranslate();
  const groupOptions = props.groups.filter(
    (group) => group.id !== props.excludedGroupId,
  );

  return (
    <>
      <label className="ganttee-field">
        <span>{t("Name")}</span>
        <input
          type="text"
          value={props.name}
          onChange={(event) => props.onName(event.target.value)}
          required
        />
      </label>

      <label className="ganttee-field">
        <span>{t("Description")}</span>
        <textarea
          value={props.description ?? ""}
          onChange={(event) =>
            props.onDescription(event.target.value || undefined)
          }
          rows={3}
        />
      </label>

      <label className="ganttee-field">
        <span>{t("Group")}</span>
        <select
          value={props.groupId ?? ""}
          onChange={(event) => props.onGroupId(event.target.value || undefined)}
        >
          <option value="">{t("(none)")}</option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
