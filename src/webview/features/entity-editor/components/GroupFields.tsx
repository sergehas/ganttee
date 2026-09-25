import { formatShortDate, parseIsoTimestamp } from "@common/dates";
import "@webview/components/Form.scss";
import { FormField } from "@webview/components/FormField";
import { IconButton } from "@webview/components/IconButton";
import { CommonTextFields } from "@webview/features/entity-editor/components/CommonTextFields";
import { GroupFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import { entityKindIcon } from "@webview/features/entity-editor/entityEditorPresentation";
import { makeUpdater } from "@webview/features/entity-editor/hooks/useFieldUpdater";
import { useGroupScheduleScope } from "@webview/features/entity-editor/hooks/useGroupScheduleScope";
import { useTranslate, useWebviewL10n } from "@webview/l10n";

import "@webview/features/entity-editor/components/GroupFields.scss";

/** Renders group-specific fields: schedule summary, collapsed toggle, and owned member list. */
export function GroupFields(props: GroupFieldsProps): React.JSX.Element {
  const { group, document } = props;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(group, props.onChange);
  const scheduledGroup = document.groups.find((candidate) => candidate.id === group.id);
  const { directMemberRows } = useGroupScheduleScope(document, group.id);

  return (
    <div className="ganttee-form ganttee-group-fields">
      <CommonTextFields
        item={group}
        groups={document.groups}
        excludedGroupId={group.id}
        statuses={document.settings.statuses}
        onChange={props.onChange}
      />
      <hr />
      <div className="ganttee-form__row">
        <FormField label={t("Start")}>
          <input
            type="text"
            value={
              scheduledGroup?.effectiveStart
                ? formatShortDate(parseIsoTimestamp(scheduledGroup.effectiveStart), locale)
                : ""
            }
            readOnly
          />
        </FormField>
        <FormField label={t("End")}>
          <input
            type="text"
            value={
              scheduledGroup?.effectiveEnd
                ? formatShortDate(parseIsoTimestamp(scheduledGroup.effectiveEnd), locale)
                : ""
            }
            readOnly
          />
        </FormField>
      </div>

      <div className="ganttee-form__row">
        <FormField label={t("Duration")}>
          <input type="text" value={scheduledGroup?.effectiveDuration?.toString() ?? ""} readOnly />
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
          <ul>
            {directMemberRows.map((row) => (
              <li key={row.id}>
                <span>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      props.onRequestEditEntity(row.entity);
                    }}
                  >
                    <span
                      className={`codicon codicon-${entityKindIcon(row.kind)}`}
                      aria-hidden="true"
                    />
                    {row.name}
                  </a>
                </span>
                <IconButton
                  icon="remove"
                  label={t("Remove from group")}
                  onClick={() => props.onUngroupEntity(row.entity)}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}
