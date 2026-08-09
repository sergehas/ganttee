import { makeUpdater } from "../../hooks/useFieldUpdater";
import { MilestoneFieldsProps } from "../../types/taskForm";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";

/** Renders milestone-specific fields plus dependency editing controls. */
export function MilestoneFields(props: MilestoneFieldsProps): JSX.Element {
  const { milestone, onChange, ...depProps } = props;
  const { document } = depProps;
  const update = makeUpdater(milestone, onChange);

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
          required
          value={milestone.date}
          onChange={(event) => update("date", event.target.value)}
        />
      </label>

      <DependencyFields {...depProps} />
    </>
  );
}
