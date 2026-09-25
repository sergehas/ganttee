import { ProjectItemState } from "@common/documents";
import { FormField } from "@webview/components/FormField";
import { Select } from "@webview/components/Select";
import "@webview/features/entity-editor/components/CommonTextFields.scss";
import { CommonTextFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import {
  ProjectItemStateLabel,
  STATE_OPTIONS,
} from "@webview/features/entity-editor/entityEditorPresentation";
import {
  makeMultiUpdater,
  makeUpdater,
} from "@webview/features/entity-editor/hooks/useFieldUpdater";
import { useTranslate } from "@webview/l10n";
import { createElement } from "react";

/** Renders name, description, and group assignment fields shared by all entity types. */
export function CommonTextFields({
  item,
  statuses = [],
  groups = [],
  excludedGroupId,
  onChange,
}: CommonTextFieldsProps): React.JSX.Element {
  const t = useTranslate();
  const update = onChange ? makeUpdater(item, onChange) : undefined;
  const multiUpdate = onChange ? makeMultiUpdater(item, onChange) : undefined;
  const groupOptions = groups.filter((group) => group.id !== excludedGroupId);

  const onName = (name: string) => update?.("name", name);
  const onDescription = (description: string | undefined) => update?.("description", description);
  const onGroupId = (groupId: string | undefined) => update?.("groupId", groupId);
  const onState = (state: ProjectItemState) => update?.("state", state);
  const onStatus = (statusId: string | undefined) => {
    const nextStatus = statuses.find((status) => status.id === statusId);
    if (nextStatus?.state !== undefined) {
      multiUpdate?.({ state: nextStatus.state, status: statusId });
    } else {
      multiUpdate?.({ status: statusId });
    }
  };

  return (
    <div className="ganttee-common-text-fields">
      <FormField label={t("Name")}>
        <input
          type="text"
          value={item.name}
          onChange={(event) => onName(event.target.value)}
          required
        />
      </FormField>

      <FormField label={t("Description")}>
        <textarea
          value={item.description ?? ""}
          onChange={(event) => onDescription(event.target.value || undefined)}
          rows={3}
        />
      </FormField>

      <FormField label={t("Group")}>
        <Select
          value={item.groupId ?? ""}
          onChange={(event) => onGroupId(event.target.value || undefined)}
        >
          <option value="">{t("(none)")}</option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="ganttee-form__row">
        <FormField label={t("State")}>
          <Select
            value={item.state ?? "open"}
            onChange={(event) => onState(event.target.value as ProjectItemState)}
          >
            {STATE_OPTIONS.map((state) => (
              <option key={state} value={state}>
                {t(ProjectItemStateLabel(state))}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("Status")}>
          <Select
            className="ganttee-status-select"
            value={item.status ?? ""}
            onChange={(event) => {
              const nextStatusId = event.target.value || undefined;
              onStatus(nextStatusId);
            }}
          >
            <button>
              {
                /* workaround as selectedcontent is not known by react */
                createElement("selectedcontent", { className: "ganttee-status-option" })
              }
            </button>
            <option className="ganttee-status-option" value="">
              <span className="ganttee-status-color"></span>
              <span className="ganttee-status-name">{t("None")}</span>
            </option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id} className="ganttee-status-option">
                <span
                  className="ganttee-status-color"
                  style={{ backgroundColor: status.color }}
                ></span>
                <span className="ganttee-status-name">{status.name}</span>
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </div>
  );
}
