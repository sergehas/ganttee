import "../../../components/Form.scss";
import { FormField } from "../../../components/FormField";
import { IconButton } from "../../../components/IconButton";
import { useTranslate, useWebviewL10n } from "../../../l10n";
import { GroupFieldsProps } from "../entityEditor.types";
import { displayGroupDate, entityKindLabel } from "../entityEditorPresentation";
import { makeUpdater } from "../hooks/useFieldUpdater";
import { useGroupScheduleScope } from "../hooks/useGroupScheduleScope";
import { CommonTextFields } from "./CommonTextFields";

import "./GroupFields.scss";

/** Renders group-specific fields: schedule summary, collapsed toggle, and owned member list. */
export function GroupFields(props: GroupFieldsProps): React.JSX.Element {
  const { group, document } = props;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(group, props.onChange);
  const { schedule, directMemberRows } = useGroupScheduleScope(document, group.id);

  return (
    <div className="ganttee-form ganttee-group-fields">
      <CommonTextFields
        name={group.name}
        description={group.description}
        groupId={group.groupId}
        groups={document.groups}
        excludedGroupId={group.id}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />

      <div className="ganttee-form__row">
        <FormField label={t("Start")}>
          <input type="text" value={displayGroupDate(schedule.start, locale)} readOnly />
        </FormField>
        <FormField label={t("End")}>
          <input type="text" value={displayGroupDate(schedule.end, locale)} readOnly />
        </FormField>
      </div>

      <div className="ganttee-form__row">
        <FormField label={t("Duration")}>
          <input type="text" value={schedule.durationDays?.toString() ?? ""} readOnly />
        </FormField>

        <FormField checkbox label={t("Collapsed")}>
          <input
            type="checkbox"
            checked={group.collapsed ?? false}
            onChange={(event) => update("collapsed", event.target.checked)}
          />
        </FormField>
      </div>

      <fieldset>
        <legend>{t("Owned Entities")}</legend>
        {directMemberRows.length === 0 ? (
          <p className="ganttee-group-fields__empty">{t("No owned entities.")}</p>
        ) : (
          <table className="ganttee-group-fields__table">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Type")}</th>
                <th aria-label={t("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {directMemberRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <a
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        props.onRequestEditEntity(row.entity);
                      }}
                    >
                      {row.name}
                    </a>
                  </td>
                  <td>{t(entityKindLabel(row.kind))}</td>
                  <td>
                    <IconButton
                      icon="remove"
                      label={t("Remove from group")}
                      onClick={() => props.onUngroupEntity(row.entity)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
    </div>
  );
}
