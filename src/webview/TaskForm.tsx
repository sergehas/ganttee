import { useEffect, useMemo, useState } from "react";
import {
    Dependency,
    DependencyType,
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

interface TaskFormProps {
  editingEntity: {
    kind: EditableEntityKind;
    entity: EditableEntityMap[EditableEntityKind];
  };
  document: GanttDocument;
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
  ) => void;
  onDelete: (entity: EditableEntityRef) => void;
  onClose: () => void;
  onAddDependency: (dependency: Dependency) => void;
  onRemoveDependency: (dependencyId: string) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "inProgress", label: "In Progress" },
  { value: "done", label: "Done" },
];

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
  const [dependencyTarget, setDependencyTarget] = useState<string>("");
  const [dependencyType, setDependencyType] =
    useState<DependencyType>("startAfter");

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
  const dependencies = useMemo(
    () =>
      dependencyOwnerId
        ? document.dependencies.filter(
            (dep) =>
              dep.sourceId === dependencyOwnerId || dep.targetId === dependencyOwnerId,
          )
        : [],
    [dependencyOwnerId, document.dependencies],
  );

  const dependencyCandidates = useMemo(() => {
    if (!dependencyOwnerId) {
      return [];
    }
    return [
      ...document.tasks.map((task) => ({ id: task.id, name: task.name })),
      ...document.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
      })),
    ].filter((entity) => entity.id !== dependencyOwnerId);
  }, [dependencyOwnerId, document.tasks, document.milestones]);

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

  const addDependency = () => {
    if (!dependencyOwnerId || !dependencyTarget) {
      return;
    }
    props.onAddDependency({
      id: `dep-${Math.random().toString(36).slice(2, 10)}`,
      sourceId: dependencyOwnerId,
      targetId: dependencyTarget,
      type: dependencyType,
    });
    setDependencyTarget("");
  };

  return (
    <form className="ganttee-form" onSubmit={submit}>
      <div className="ganttee-form__header">
        <h2>{titleOf(editingEntity.kind)}</h2>
        <button type="button" className="ganttee-icon-button" onClick={props.onClose}>
          Close
        </button>
      </div>

      {taskDraft && (
        <TaskFields
          task={taskDraft}
          document={document}
          onChange={setTaskDraft}
          dependencies={dependencies}
          dependencyType={dependencyType}
          dependencyTarget={dependencyTarget}
          dependencyCandidates={dependencyCandidates}
          onDependencyTypeChange={setDependencyType}
          onDependencyTargetChange={setDependencyTarget}
          onAddDependency={addDependency}
          onRemoveDependency={props.onRemoveDependency}
        />
      )}

      {milestoneDraft && (
        <MilestoneFields
          milestone={milestoneDraft}
          document={document}
          onChange={setMilestoneDraft}
          dependencies={dependencies}
          dependencyType={dependencyType}
          dependencyTarget={dependencyTarget}
          dependencyCandidates={dependencyCandidates}
          onDependencyTypeChange={setDependencyType}
          onDependencyTargetChange={setDependencyTarget}
          onAddDependency={addDependency}
          onRemoveDependency={props.onRemoveDependency}
        />
      )}

      {groupDraft && (
        <GroupFields
          group={groupDraft}
          document={document}
          onChange={setGroupDraft}
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
            props.onDelete({ kind: editingEntity.kind, id: editingEntity.entity.id })
          }
        >
          Delete
        </button>
      </div>
    </form>
  );
}

interface TaskFieldsProps {
  task: Task;
  document: GanttDocument;
  dependencies: Dependency[];
  dependencyType: DependencyType;
  dependencyTarget: string;
  dependencyCandidates: { id: string; name: string }[];
  onChange: (task: Task) => void;
  onDependencyTypeChange: (value: DependencyType) => void;
  onDependencyTargetChange: (value: string) => void;
  onAddDependency: () => void;
  onRemoveDependency: (dependencyId: string) => void;
}

function TaskFields(props: TaskFieldsProps): JSX.Element {
  const { task, document } = props;
  const update = <K extends keyof Task>(key: K, value: Task[K]) =>
    props.onChange({ ...task, [key]: value });

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
            onChange={(event) => update("start", event.target.value || undefined)}
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
                event.target.value === "" ? undefined : Number(event.target.value),
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
            onChange={(event) => update("progress", Number(event.target.value) / 100)}
          />
        </label>
      </div>

      <label className="ganttee-field">
        <span>Status</span>
        <select
          value={task.status ?? "todo"}
          onChange={(event) => update("status", event.target.value as TaskStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <DependencyFields
        document={document}
        dependencies={props.dependencies}
        dependencyType={props.dependencyType}
        dependencyTarget={props.dependencyTarget}
        dependencyCandidates={props.dependencyCandidates}
        onDependencyTypeChange={props.onDependencyTypeChange}
        onDependencyTargetChange={props.onDependencyTargetChange}
        onAddDependency={props.onAddDependency}
        onRemoveDependency={props.onRemoveDependency}
      />
    </>
  );
}

interface MilestoneFieldsProps {
  milestone: Milestone;
  document: GanttDocument;
  dependencies: Dependency[];
  dependencyType: DependencyType;
  dependencyTarget: string;
  dependencyCandidates: { id: string; name: string }[];
  onChange: (milestone: Milestone) => void;
  onDependencyTypeChange: (value: DependencyType) => void;
  onDependencyTargetChange: (value: string) => void;
  onAddDependency: () => void;
  onRemoveDependency: (dependencyId: string) => void;
}

function MilestoneFields(props: MilestoneFieldsProps): JSX.Element {
  const { milestone, document } = props;
  const update = <K extends keyof Milestone>(key: K, value: Milestone[K]) =>
    props.onChange({ ...milestone, [key]: value });

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

      <DependencyFields
        document={document}
        dependencies={props.dependencies}
        dependencyType={props.dependencyType}
        dependencyTarget={props.dependencyTarget}
        dependencyCandidates={props.dependencyCandidates}
        onDependencyTypeChange={props.onDependencyTypeChange}
        onDependencyTargetChange={props.onDependencyTargetChange}
        onAddDependency={props.onAddDependency}
        onRemoveDependency={props.onRemoveDependency}
      />
    </>
  );
}

interface GroupFieldsProps {
  group: Group;
  document: GanttDocument;
  onChange: (group: Group) => void;
}

function GroupFields(props: GroupFieldsProps): JSX.Element {
  const { group, document } = props;
  const update = <K extends keyof Group>(key: K, value: Group[K]) =>
    props.onChange({ ...group, [key]: value });

  const ownedTasks = document.tasks.filter((task) => task.groupId === group.id);
  const ownedMilestones = document.milestones.filter(
    (milestone) => milestone.groupId === group.id,
  );
  const ownedGroups = document.groups.filter((item) => item.groupId === group.id);

  return (
    <>
      <label className="ganttee-field">
        <span>Name</span>
        <input
          type="text"
          value={group.name}
          onChange={(event) => update("name", event.target.value)}
          required
        />
      </label>

      <label className="ganttee-field">
        <span>Parent Group</span>
        <select
          value={group.groupId ?? ""}
          onChange={(event) => update("groupId", event.target.value || undefined)}
        >
          <option value="">(none)</option>
          {document.groups
            .filter((candidate) => candidate.id !== group.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
        </select>
      </label>

      <label className="ganttee-field">
        <span>Collapsed</span>
        <input
          type="checkbox"
          checked={group.collapsed ?? false}
          onChange={(event) => update("collapsed", event.target.checked)}
        />
      </label>

      <fieldset className="ganttee-dependencies">
        <legend>Owned Entities</legend>
        {ownedGroups.length === 0 &&
        ownedTasks.length === 0 &&
        ownedMilestones.length === 0 ? (
          <p className="ganttee-muted">No owned entities.</p>
        ) : (
          <ul>
            {ownedGroups.map((item) => (
              <li key={`group:${item.id}`}>Group: {item.name}</li>
            ))}
            {ownedTasks.map((item) => (
              <li key={`task:${item.id}`}>Task: {item.name}</li>
            ))}
            {ownedMilestones.map((item) => (
              <li key={`milestone:${item.id}`}>Milestone: {item.name}</li>
            ))}
          </ul>
        )}
      </fieldset>
    </>
  );
}

interface CommonTextFieldsProps {
  name: string;
  description?: string;
  groupId?: string;
  groups: Group[];
  onName: (name: string) => void;
  onDescription: (description: string | undefined) => void;
  onGroupId: (groupId: string | undefined) => void;
}

function CommonTextFields(props: CommonTextFieldsProps): JSX.Element {
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
          onChange={(event) => props.onDescription(event.target.value || undefined)}
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
          {props.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

interface DependencyFieldsProps {
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
          onChange={(event) => props.onDependencyTargetChange(event.target.value)}
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

function describeDependency(dep: Dependency, document: GanttDocument): string {
  const source = findEntityName(document, dep.sourceId);
  const target = findEntityName(document, dep.targetId);
  const label = DEPENDENCY_OPTIONS.find((option) => option.value === dep.type)?.label;
  return `${source} → ${label ?? dep.type} → ${target}`;
}

function findEntityName(document: GanttDocument, id: string): string {
  const task = document.tasks.find((item) => item.id === id);
  if (task) {
    return task.name;
  }
  const milestone = document.milestones.find((item) => item.id === id);
  if (milestone) {
    return milestone.name;
  }
  return "?";
}

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
