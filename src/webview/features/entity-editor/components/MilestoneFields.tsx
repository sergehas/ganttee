import { formatShortDate } from "@common/datePresentation";
import { validateMilestoneConstraints } from "@services/schedule/scheduleConstraintService";
import { makeUpdater } from "../hooks/useFieldUpdater";
import { useTranslate, useWebviewL10n } from "../../../l10n";
import { MilestoneFieldsProps } from "../entityEditor.types";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";
import { ValidationMessage } from "./ValidationMessage";
import { milestoneValidationMessages } from "../entityEditorPresentation";

/** Renders milestone-specific fields plus dependency editing controls. */
export function MilestoneFields(props: MilestoneFieldsProps): React.JSX.Element {
  const { milestone, scheduledMilestone, onChange, ...depProps } = props;
  const { document } = depProps;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(milestone, onChange);
  const validation = validateMilestoneConstraints(milestone, document.dependencies);

  return (
    <>
      <CommonTextFields
        name={milestone.name}
        description={milestone.description}
        groupId={milestone.groupId}
        groups={document.groups}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />

      <label className="ganttee-field">
        <span>{t("Date")}</span>
        <input
          type="date"
          value={milestone.date ?? ""}
          onChange={(event) => update("date", event.target.value || undefined)}
        />
        {scheduledMilestone && (
          <output>{formatShortDate(scheduledMilestone.effectiveStart(), locale)}</output>
        )}
      </label>

      {milestoneValidationMessages(validation).map((message) => (
        <ValidationMessage severity={message.severity} key={message.source}>
          {t(message.source)}
        </ValidationMessage>
      ))}

      <DependencyFields {...depProps} />
    </>
  );
}
