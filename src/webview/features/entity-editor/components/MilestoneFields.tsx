import { formatShortDate, parseIsoTimestamp } from "@common/dates";
import { validateMilestoneConstraints } from "@services/schedule/scheduleConstraintService";
import "@webview/components/Form.scss";
import { FormField } from "@webview/components/FormField";
import { CommonTextFields } from "@webview/features/entity-editor/components/CommonTextFields";
import { DependencyFields } from "@webview/features/entity-editor/components/DependencyFields";
import "@webview/features/entity-editor/components/MilestoneFields.scss";
import { ValidationMessage } from "@webview/features/entity-editor/components/ValidationMessage";
import { MilestoneFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import { milestoneValidationMessages } from "@webview/features/entity-editor/entityEditorPresentation";
import { makeUpdater } from "@webview/features/entity-editor/hooks/useFieldUpdater";
import { useTranslate, useWebviewL10n } from "@webview/l10n";

/** Renders milestone-specific fields plus dependency editing controls. */
export function MilestoneFields(props: MilestoneFieldsProps): React.JSX.Element {
  const { milestone, scheduledMilestone, onChange, ...depProps } = props;
  const { document } = depProps;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(milestone, onChange);
  const validation = validateMilestoneConstraints(milestone, document.dependencies);

  return (
    <div className="ganttee-form ">
      <CommonTextFields
        name={milestone.name}
        description={milestone.description}
        groupId={milestone.groupId}
        groups={document.groups}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />

      <FormField label={t("Date")}>
        <input
          type="date"
          value={milestone.date ?? ""}
          onChange={(event) => update("date", event.target.value || undefined)}
        />
        {scheduledMilestone?.effectiveStart && (
          <output>
            {formatShortDate(parseIsoTimestamp(scheduledMilestone.effectiveStart), locale)}
          </output>
        )}
      </FormField>

      {milestoneValidationMessages(validation).map((message) => (
        <ValidationMessage severity={message.severity} key={message.source}>
          {t(message.source)}
        </ValidationMessage>
      ))}

      <DependencyFields {...depProps} />
    </div>
  );
}
