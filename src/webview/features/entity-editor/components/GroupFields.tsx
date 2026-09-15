import { makeUpdater } from "../hooks/useFieldUpdater";
import { useGroupScheduleScope } from "../hooks/useGroupScheduleScope";
import { useTranslate, useWebviewL10n } from "../../../l10n";
import { GroupFieldsProps } from "../entityEditor.types";
import { displayGroupDate, entityKindLabel } from "../entityEditorPresentation";
import { CommonTextFields } from "./CommonTextFields";

/** Renders group-specific fields: schedule summary, collapsed toggle, and owned member list. */
export function GroupFields(props: GroupFieldsProps): React.JSX.Element {
  const { group, document } = props;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(group, props.onChange);
  const { schedule, directMemberRows } = useGroupScheduleScope(document, group.id);

  return (
    <>
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

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>{t("Start")}</span>
          <input type="text" value={displayGroupDate(schedule.start, locale)} readOnly />
        </label>
        <label className="ganttee-field">
          <span>{t("End")}</span>
          <input type="text" value={displayGroupDate(schedule.end, locale)} readOnly />
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>{t("Duration")}</span>
          <input type="text" value={schedule.durationDays?.toString() ?? ""} readOnly />
        </label>

        <label className="ganttee-field ganttee-field--checkbox">
          <input
            type="checkbox"
            checked={group.collapsed ?? false}
            onChange={(event) => update("collapsed", event.target.checked)}
          />
          <span>{t("Collapsed")}</span>
        </label>
      </div>

      <fieldset className="ganttee-dependencies">
        <legend>{t("Owned Entities")}</legend>
        {directMemberRows.length === 0 ? (
          <p className="ganttee-muted">{t("No owned entities.")}</p>
        ) : (
          <table className="ganttee-table">
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
                    <button
                      type="button"
                      className="ganttee-icon-button"
                      onClick={() => props.onUngroupEntity(row.entity)}
                      aria-label={t("Remove from group")}
                      title={t("Remove from group")}
                    >
                      <span className="codicon codicon-remove" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
    </>
  );
}
