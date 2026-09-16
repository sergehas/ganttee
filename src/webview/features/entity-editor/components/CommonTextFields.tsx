import { FormField } from "@webview/components/FormField";
import { Select } from "@webview/components/Select";
import "@webview/features/entity-editor/components/CommonTextFields.scss";
import { CommonTextFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import { useTranslate } from "@webview/l10n";

/** Renders name, description, and group assignment fields shared by all entity types. */
export function CommonTextFields(props: CommonTextFieldsProps): React.JSX.Element {
  const t = useTranslate();
  const groupOptions = props.groups.filter((group) => group.id !== props.excludedGroupId);

  return (
    <div className="ganttee-common-text-fields">
      <FormField label={t("Name")}>
        <input
          type="text"
          value={props.name}
          onChange={(event) => props.onName(event.target.value)}
          required
        />
      </FormField>

      <FormField label={t("Description")}>
        <textarea
          value={props.description ?? ""}
          onChange={(event) => props.onDescription(event.target.value || undefined)}
          rows={3}
        />
      </FormField>

      <FormField label={t("Group")}>
        <Select
          value={props.groupId ?? ""}
          onChange={(event) => props.onGroupId(event.target.value || undefined)}
        >
          <option value="">{t("(none)")}</option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
