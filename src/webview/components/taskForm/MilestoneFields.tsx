import { describeMilestoneConstraintValidation } from "../../../services/taskConstraintService";
import { makeUpdater } from "../../hooks/useFieldUpdater";
import { MilestoneFieldsProps } from "../../types/taskForm";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";

/** Renders milestone-specific fields plus dependency editing controls. */
export function MilestoneFields(props: MilestoneFieldsProps): JSX.Element {
  const { milestone, onChange, ...depProps } = props;
  const { document } = depProps;
  const update = makeUpdater(milestone, onChange);
  const validation = describeMilestoneConstraintValidation(
    milestone,
    document.dependencies,
  );

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
        <span>Date</span>
        <input
          type="date"
          value={milestone.date ?? ""}
          onChange={(event) => update("date", event.target.value)}
        />
      </label>

      {(validation.underConstrained || validation.overConstrained) && (
        <div className="ganttee-validation-warning" role="status">
          {validation.overConstrained && (
            <p>Milestone has a duplicate date constraint.</p>
          )}
          {validation.blocking && (
            <p>Milestone needs a date or an outgoing dependency.</p>
          )}
        </div>
      )}

      <DependencyFields {...depProps} />
    </>
  );
}
