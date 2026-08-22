import { makeUpdater } from "../../hooks/useFieldUpdater";
import { useGroupScheduleScope } from "../../hooks/useGroupScheduleScope";
import { GroupFieldsProps } from "../../types/taskForm";
import { CommonTextFields } from "./CommonTextFields";

/** Renders group-specific fields: schedule summary, collapsed toggle, and owned member list. */
export function GroupFields(props: GroupFieldsProps): JSX.Element {
  const { group, document } = props;
  const update = makeUpdater(group, props.onChange);
  const { schedule, directMemberRows } = useGroupScheduleScope(
    document,
    group.id,
  );

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
          <span>Start</span>
          <input type="text" value={schedule.start ?? ""} readOnly />
        </label>
        <label className="ganttee-field">
          <span>End</span>
          <input type="text" value={schedule.end ?? ""} readOnly />
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Duration</span>
          <input
            type="text"
            value={schedule.durationDays?.toString() ?? ""}
            readOnly
          />
        </label>

        <label className="ganttee-field ganttee-field--checkbox">
          <input
            type="checkbox"
            checked={group.collapsed ?? false}
            onChange={(event) => update("collapsed", event.target.checked)}
          />
          <span>Collapsed</span>
        </label>
      </div>

      <fieldset className="ganttee-dependencies">
        <legend>Owned Entities</legend>
        {directMemberRows.length === 0 ? (
          <p className="ganttee-muted">No owned entities.</p>
        ) : (
          <table className="ganttee-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th></th>
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
                  <td>{row.kind}</td>
                  <td>
                    <button
                      type="button"
                      className="ganttee-icon-button"
                      onClick={() => props.onUngroupEntity(row.entity)}
                    >
                      Remove
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
