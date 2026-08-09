import { useEffect, useMemo, useState } from "react";
import {
  Dependency,
  DependencyType,
  effectiveEnd,
  effectiveStart,
  GanttDocument,
  Group,
  Milestone,
  Task,
  TaskStatus,
} from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../common/protocol";

/** Props for the {@link TaskForm} component. */
interface TaskFormProps {
  editingEntity: {
    kind: EditableEntityKind;
    entity: EditableEntityMap[EditableEntityKind];
  };
  document: GanttDocument;
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: { keepEditorOpen?: boolean },
  ) => void;
  onDelete: (entity: EditableEntityRef) => void;
  onClose: () => void;
  onAddDependency: (dependency: Dependency) => void;
  onRemoveDependency: (dependencyId: string) => void;
  onRequestEditEntity: (entity: EditableEntityRef) => void;
}

/** Selectable status values for the task status dropdown. */
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "inProgress", label: "In Progress" },
  { value: "done", label: "Done" },
];

/** Selectable dependency type values for the dependency type dropdown. */
const DEPENDENCY_OPTIONS: { value: DependencyType; label: string }[] = [
  { value: "startAfter", label: "Start After" },
  { value: "startWith", label: "Start With" },
  { value: "endBefore", label: "End Before" },
  { value: "endWith", label: "End With" },
];

/**
 * Entity-aware edit form for tasks, milestones, and groups.
 */
export function TaskForm(props: TaskFormProps): JSX.Element {
  const { editingEntity, document } = props;
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState<Milestone | null>(null);
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);

  useEffect(() => {
    if (editingEntity.kind === "task") {
      setTaskDraft(editingEntity.entity as Task);
      setMilestoneDraft(null);
      setGroupDraft(null);
      return;
    }
    if (editingEntity.kind === "milestone") {
      setMilestoneDraft(editingEntity.entity as Milestone);
      setTaskDraft(null);
      setGroupDraft(null);
      return;
    }
    setGroupDraft(editingEntity.entity as Group);
    setTaskDraft(null);
    setMilestoneDraft(null);
  }, [editingEntity]);

  const dependencyOwnerId = taskDraft?.id ?? milestoneDraft?.id;
  const depEditor = useDependencyEditor(
    dependencyOwnerId,
    document,
    props.onAddDependency,
    props.onRemoveDependency,
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (taskDraft) {
      if (
        taskDraft.start !== undefined &&
        taskDraft.end !== undefined &&
        taskDraft.start > taskDraft.end
      ) {
        return;
      }
      props.onSave("task", taskDraft);
      return;
    }
    if (milestoneDraft) {
      if (!milestoneDraft.date) {
        return;
      }
      props.onSave("milestone", milestoneDraft);
      return;
    }
    if (!groupDraft) {
      return;
    }
    if (groupDraft.groupId === groupDraft.id) {
      return;
    }
    props.onSave("group", groupDraft);
  };

  return (
    <form className="ganttee-form" onSubmit={submit}>
      <div className="ganttee-form__header">
        <h2>{titleOf(editingEntity.kind)}</h2>
        <button
          type="button"
          className="ganttee-icon-button"
          onClick={props.onClose}
        >
          Close
        </button>
      </div>

      {taskDraft && (
        <TaskFields task={taskDraft} onChange={setTaskDraft} {...depEditor} />
      )}

      {milestoneDraft && (
        <MilestoneFields
          milestone={milestoneDraft}
          onChange={setMilestoneDraft}
          {...depEditor}
        />
      )}

      {groupDraft && (
        <GroupFields
          group={groupDraft}
          document={document}
          onChange={setGroupDraft}
          onRequestEditEntity={props.onRequestEditEntity}
          onUngroupEntity={(ref) => {
            if (ref.kind === "task") {
              const task = document.tasks.find((t) => t.id === ref.id);
              if (task) {
                props.onSave(
                  "task",
                  { ...task, groupId: undefined },
                  { keepEditorOpen: true },
                );
              }
              return;
            }
            if (ref.kind === "group") {
              const group = document.groups.find((g) => g.id === ref.id);
              if (group) {
                props.onSave(
                  "group",
                  { ...group, groupId: undefined },
                  { keepEditorOpen: true },
                );
              }
              return;
            }
            const milestone = document.milestones.find((m) => m.id === ref.id);
            if (milestone) {
              props.onSave(
                "milestone",
                { ...milestone, groupId: undefined },
                { keepEditorOpen: true },
              );
            }
          }}
        />
      )}

      <div className="ganttee-form__actions">
        <button type="submit" className="ganttee-primary">
          Save
        </button>
        <button
          type="button"
          className="ganttee-danger"
          onClick={() =>
            props.onDelete({
              kind: editingEntity.kind,
              id: editingEntity.entity.id,
            })
          }
        >
          Delete
        </button>
      </div>
    </form>
  );
}

/**
 * Shared dependency-editor state and callbacks for task and milestone forms.
 * Produced by {@link useDependencyEditor} and spread onto {@link DependencyFields}.
 */
interface DependencyEditorProps {
  document: GanttDocument;
  dependencies: Dependency[];
  dependencyType: DependencyType;
  dependencyTarget: string;
  dependencyCandidates: { id: string; name: string }[];
  onDependencyTypeChange: (value: DependencyType) => void;
  onDependencyTargetChange: (value: string) => void;
  onAddDependency: () => void;
  onRemoveDependency: (dependencyId: string) => void;
}

/** Produces a field-updater that spreads a single changed key-value pair onto the entity draft. */
function makeUpdater<T extends object>(
  entity: T,
  onChange: (updated: T) => void,
) {
  return <K extends keyof T>(key: K, value: T[K]) =>
    onChange({ ...entity, [key]: value });
}

/**
 * Manages dependency-editor state for a task or milestone owner.
 * Returns props ready to spread onto {@link DependencyFields}.
 */
function useDependencyEditor(
  ownerId: string | undefined,
  document: GanttDocument,
  onAddDependency: (dep: Dependency) => void,
  onRemoveDependency: (depId: string) => void,
): DependencyEditorProps {
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyType, setDependencyType] =
    useState<DependencyType>("startAfter");

  const dependencies = useMemo(
    () =>
      ownerId
        ? document.dependencies.filter(
            (dep) => dep.sourceId === ownerId || dep.targetId === ownerId,
          )
        : [],
    [ownerId, document.dependencies],
  );

  const dependencyCandidates = useMemo(() => {
    if (!ownerId) {
      return [];
    }
    return [
      ...document.tasks.map((task) => ({ id: task.id, name: task.name })),
      ...document.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
      })),
    ].filter((entity) => entity.id !== ownerId);
  }, [ownerId, document.tasks, document.milestones]);

  const addDependency = () => {
    if (!ownerId || !dependencyTarget) {
      return;
    }
    onAddDependency({
      id: `dep-${Math.random().toString(36).slice(2, 10)}`,
      sourceId: ownerId,
      targetId: dependencyTarget,
      type: dependencyType,
    });
    setDependencyTarget("");
  };

  return {
    document,
    dependencies,
    dependencyType,
    dependencyTarget,
    dependencyCandidates,
    onDependencyTypeChange: setDependencyType,
    onDependencyTargetChange: setDependencyTarget,
    onAddDependency: addDependency,
    onRemoveDependency,
  };
}

/** Props for the {@link TaskFields} sub-form. */
interface TaskFieldsProps extends DependencyEditorProps {
  task: Task;
  onChange: (task: Task) => void;
}

/** Renders the task-specific fields (dates, duration, progress, status) plus dependency editing. */
function TaskFields(props: TaskFieldsProps): JSX.Element {
  const { task, onChange, ...depProps } = props;
  const { document } = depProps;
  const update = makeUpdater(task, onChange);

  return (
    <>
      <CommonTextFields
        name={task.name}
        description={task.description}
        groupId={task.groupId}
        groups={document.groups}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Start</span>
          <input
            type="date"
            value={task.start ?? ""}
            onChange={(event) =>
              update("start", event.target.value || undefined)
            }
          />
        </label>
        <label className="ganttee-field">
          <span>End</span>
          <input
            type="date"
            min={task.start}
            value={task.end ?? ""}
            onChange={(event) => update("end", event.target.value || undefined)}
          />
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Duration</span>
          <input
            type="number"
            min={0}
            step="any"
            value={task.duration ?? ""}
            onChange={(event) =>
              update(
                "duration",
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
              )
            }
          />
        </label>
        <label className="ganttee-field">
          <span>Progress</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((task.progress ?? 0) * 100)}
            onChange={(event) =>
              update("progress", Number(event.target.value) / 100)
            }
          />
        </label>
      </div>

      <label className="ganttee-field">
        <span>Status</span>
        <select
          value={task.status ?? "todo"}
          onChange={(event) =>
            update("status", event.target.value as TaskStatus)
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <DependencyFields {...depProps} />
    </>
  );
}

/** Props for the {@link MilestoneFields} sub-form. */
interface MilestoneFieldsProps extends DependencyEditorProps {
  milestone: Milestone;
  onChange: (milestone: Milestone) => void;
}

/** Renders the milestone-specific fields (date) plus dependency editing. */
function MilestoneFields(props: MilestoneFieldsProps): JSX.Element {
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

/** Props for the {@link GroupFields} sub-form. */
interface GroupFieldsProps {
  group: Group;
  document: GanttDocument;
  onChange: (group: Group) => void;
  onRequestEditEntity: (entity: EditableEntityRef) => void;
  onUngroupEntity: (ref: EditableEntityRef) => void;
}

/** Renders group-specific fields: name, schedule summary, collapsed toggle, and member list. */
function GroupFields(props: GroupFieldsProps): JSX.Element {
  const { group, document } = props;
  const update = makeUpdater(group, props.onChange);

  const scope = useMemo(
    () => collectGroupScope(document, group.id),
    [document, group.id],
  );
  const schedule = useMemo(
    () => computeGroupEffectiveSchedule(scope.tasks, scope.milestones),
    [scope.tasks, scope.milestones],
  );
  const directMemberRows = useMemo(
    () => buildDirectGroupMemberRows(document, group.id),
    [document, group.id],
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
          <input type="text" value={schedule.duration ?? ""} readOnly />
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

/** Props for the {@link CommonTextFields} sub-form shared by all entity types. */
interface CommonTextFieldsProps {
  name: string;
  description?: string;
  groupId?: string;
  groups: Group[];
  excludedGroupId?: string;
  onName: (name: string) => void;
  onDescription: (description: string | undefined) => void;
  onGroupId: (groupId: string | undefined) => void;
}

/** Renders name, description, and group assignment fields shared by all entity types. */
function CommonTextFields(props: CommonTextFieldsProps): JSX.Element {
  const groupOptions = props.groups.filter(
    (group) => group.id !== props.excludedGroupId,
  );

  return (
    <>
      <label className="ganttee-field">
        <span>Name</span>
        <input
          type="text"
          value={props.name}
          onChange={(event) => props.onName(event.target.value)}
          required
        />
      </label>

      <label className="ganttee-field">
        <span>Description</span>
        <textarea
          value={props.description ?? ""}
          onChange={(event) =>
            props.onDescription(event.target.value || undefined)
          }
          rows={3}
        />
      </label>

      <label className="ganttee-field">
        <span>Group</span>
        <select
          value={props.groupId ?? ""}
          onChange={(event) => props.onGroupId(event.target.value || undefined)}
        >
          <option value="">(none)</option>
          {groupOptions.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/** Props for the {@link DependencyFields} sub-form (alias of {@link DependencyEditorProps}). */
type DependencyFieldsProps = DependencyEditorProps;

/** Renders the dependency list and the add-dependency controls. */
function DependencyFields(props: DependencyFieldsProps): JSX.Element {
  return (
    <fieldset className="ganttee-dependencies">
      <legend>Dependencies</legend>
      {props.dependencies.length === 0 && (
        <p className="ganttee-muted">No dependencies.</p>
      )}
      <ul>
        {props.dependencies.map((dep) => (
          <li key={dep.id}>
            <span>{describeDependency(dep, props.document)}</span>
            <button
              type="button"
              className="ganttee-icon-button"
              onClick={() => props.onRemoveDependency(dep.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="ganttee-field-row">
        <select
          value={props.dependencyType}
          onChange={(event) =>
            props.onDependencyTypeChange(event.target.value as DependencyType)
          }
        >
          {DEPENDENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={props.dependencyTarget}
          onChange={(event) =>
            props.onDependencyTargetChange(event.target.value)
          }
        >
          <option value="">Select work item…</option>
          {props.dependencyCandidates.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={props.onAddDependency}>
          Add
        </button>
      </div>
    </fieldset>
  );
}

/** The full set of group IDs, tasks, and milestones that belong to a group hierarchy. */
interface GroupScope {
  /** All group IDs in the hierarchy, including the root and all descendants. */
  groupIds: Set<string>;
  /** Tasks directly or transitively assigned to the group hierarchy. */
  tasks: Task[];
  /** Milestones directly or transitively assigned to the group hierarchy. */
  milestones: Milestone[];
}

/** A direct member row shown in the group-owned-entities list. */
interface DirectGroupMemberRow {
  /** Stable row id (`kind:id`) for React rendering. */
  id: string;
  /** Display name for the member entity. */
  name: string;
  /** Kind of entity (`task`, `milestone`, or `group`). */
  kind: EditableEntityKind;
  /** Navigable reference to the member entity. */
  entity: EditableEntityRef;
}

/**
 * Collects all groups, tasks, and milestones that belong to the given group hierarchy.
 * Traverses nested sub-groups via a breadth-first scan.
 */
function collectGroupScope(
  document: GanttDocument,
  rootGroupId: string,
): GroupScope {
  const groupIds = new Set<string>([rootGroupId]);
  let frontier = [rootGroupId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const parentId of frontier) {
      for (const group of document.groups) {
        if (group.groupId === parentId && !groupIds.has(group.id)) {
          groupIds.add(group.id);
          next.push(group.id);
        }
      }
    }
    frontier = next;
  }

  const tasks = document.tasks.filter(
    (task) => task.groupId !== undefined && groupIds.has(task.groupId),
  );
  const milestones = document.milestones.filter(
    (milestone) =>
      milestone.groupId !== undefined && groupIds.has(milestone.groupId),
  );

  return { groupIds, tasks, milestones };
}

/**
 * Computes the earliest start, latest end, and total duration (in days) across a set of tasks and milestones.
 * Returns an empty object when no dated entities are present.
 */
function computeGroupEffectiveSchedule(
  tasks: Task[],
  milestones: Milestone[],
): { start?: string; end?: string; duration?: string } {
  const starts: string[] = [];
  const ends: string[] = [];

  for (const task of tasks) {
    const start = effectiveStart(task);
    const end = effectiveEnd(task);
    if (start) {
      starts.push(start);
    }
    if (end) {
      ends.push(end);
    }
  }

  for (const milestone of milestones) {
    starts.push(milestone.date);
    ends.push(milestone.date);
  }

  if (starts.length === 0 || ends.length === 0) {
    return {};
  }

  const start = starts.reduce(
    (min, date) => (date < min ? date : min),
    starts[0],
  );
  const end = ends.reduce((max, date) => (date > max ? date : max), ends[0]);
  const duration = Math.max(0, diffInDays(start, end));

  return {
    start,
    end,
    duration: duration.toString(),
  };
}

/**
 * Builds direct-member rows for entities owned by a group.
 * Includes only entities with `groupId === ownerGroupId` (no transitive descendants).
 */
function buildDirectGroupMemberRows(
  document: GanttDocument,
  ownerGroupId: string,
): DirectGroupMemberRow[] {
  const groupRows: DirectGroupMemberRow[] = document.groups
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `group:${item.id}`,
      name: item.name,
      kind: "group",
      entity: { kind: "group", id: item.id },
    }));

  const taskRows: DirectGroupMemberRow[] = document.tasks
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `task:${item.id}`,
      name: item.name,
      kind: "task",
      entity: { kind: "task", id: item.id },
    }));

  const milestoneRows: DirectGroupMemberRow[] = document.milestones
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `milestone:${item.id}`,
      name: item.name,
      kind: "milestone",
      entity: { kind: "milestone", id: item.id },
    }));

  return [...groupRows, ...taskRows, ...milestoneRows];
}

/**
 * Finds a task or milestone by ID and returns a typed ref with its name.
 * @returns `undefined` when no matching entity exists.
 */
function findEntityRefById(
  document: GanttDocument,
  id: string,
): { id: string; kind: "task" | "milestone"; name: string } | undefined {
  const task = document.tasks.find((item) => item.id === id);
  if (task) {
    return { id: task.id, kind: "task", name: task.name };
  }
  const milestone = document.milestones.find((item) => item.id === id);
  if (milestone) {
    return { id: milestone.id, kind: "milestone", name: milestone.name };
  }
  return undefined;
}

/** Returns a human-readable description of a dependency in the form "Source -> Type -> Target". */
function describeDependency(dep: Dependency, document: GanttDocument): string {
  const source = findEntityName(document, dep.sourceId);
  const target = findEntityName(document, dep.targetId);
  const label = DEPENDENCY_OPTIONS.find(
    (option) => option.value === dep.type,
  )?.label;
  return `${source} -> ${label ?? dep.type} -> ${target}`;
}

/** Resolves a task or milestone ID to its display name, returning `"?"` when not found. */
function findEntityName(document: GanttDocument, id: string): string {
  return findEntityRefById(document, id)?.name ?? "?";
}

/** Returns the number of whole days between two ISO date strings (end minus start). */
function diffInDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  return (endMs - startMs) / (24 * 60 * 60 * 1000);
}

/** Maps an entity kind to the corresponding form heading text. */
function titleOf(kind: EditableEntityKind): string {
  switch (kind) {
    case "task":
      return "Edit Task";
    case "milestone":
      return "Edit Milestone";
    case "group":
      return "Edit Group";
  }
}
