import { useEffect, useState } from "react";
import {
    Dependency,
    DependencyType,
    GanttDocument,
    Task,
    TaskStatus,
} from "../common/models";

interface TaskFormProps {
  task: Task;
  document: GanttDocument;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
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
  { value: "finishAfter", label: "Finish After" },
  { value: "finishWith", label: "Finish With" },
];

/** Editable form for a single task, including its dependencies. */
export function TaskForm(props: TaskFormProps): JSX.Element {
  const { task, document } = props;
  const [draft, setDraft] = useState<Task>(task);
  const [dependencyTarget, setDependencyTarget] = useState<string>("");
  const [dependencyType, setDependencyType] =
    useState<DependencyType>("startAfter");

  useEffect(() => {
    setDraft(task);
  }, [task]);

  const update = <K extends keyof Task>(key: K, value: Task[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const outgoing = document.dependencies.filter(
    (dep) => dep.sourceId === task.id || dep.targetId === task.id,
  );
  const candidateTargets = document.tasks.filter((other) => other.id !== task.id);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    props.onSave(draft);
  };

  const addDependency = () => {
    if (!dependencyTarget) {
      return;
    }
    props.onAddDependency({
      id: `dep-${Math.random().toString(36).slice(2, 10)}`,
      sourceId: task.id,
      targetId: dependencyTarget,
      type: dependencyType,
    });
    setDependencyTarget("");
  };

  return (
    <form className="ganttee-form" onSubmit={submit}>
      <div className="ganttee-form__header">
        <h2>Edit Task</h2>
        <button type="button" className="ganttee-icon-button" onClick={props.onClose}>
          Close
        </button>
      </div>

      <label className="ganttee-field">
        <span>Title</span>
        <input
          type="text"
          value={draft.title}
          onChange={(event) => update("title", event.target.value)}
          required
        />
      </label>

      <label className="ganttee-field">
        <span>Description</span>
        <textarea
          value={draft.description ?? ""}
          onChange={(event) => update("description", event.target.value)}
          rows={3}
        />
      </label>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Start</span>
          <input
            type="date"
            value={draft.start}
            onChange={(event) => update("start", event.target.value)}
            required
          />
        </label>
        <label className="ganttee-field">
          <span>End</span>
          <input
            type="date"
            value={draft.end}
            onChange={(event) => update("end", event.target.value)}
            required
          />
        </label>
      </div>

      <div className="ganttee-field-row">
        <label className="ganttee-field">
          <span>Status</span>
          <select
            value={draft.status ?? "todo"}
            onChange={(event) => update("status", event.target.value as TaskStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ganttee-field">
          <span>Progress</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((draft.progress ?? 0) * 100)}
            onChange={(event) =>
              update("progress", Number(event.target.value) / 100)
            }
          />
        </label>
      </div>

      <label className="ganttee-field">
        <span>Group</span>
        <select
          value={draft.groupId ?? ""}
          onChange={(event) =>
            update("groupId", event.target.value || undefined)
          }
        >
          <option value="">(none)</option>
          {document.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="ganttee-dependencies">
        <legend>Dependencies</legend>
        {outgoing.length === 0 && (
          <p className="ganttee-muted">No dependencies.</p>
        )}
        <ul>
          {outgoing.map((dep) => (
            <li key={dep.id}>
              <span>{describeDependency(dep, document)}</span>
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
            value={dependencyType}
            onChange={(event) =>
              setDependencyType(event.target.value as DependencyType)
            }
          >
            {DEPENDENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={dependencyTarget}
            onChange={(event) => setDependencyTarget(event.target.value)}
          >
            <option value="">Select task…</option>
            {candidateTargets.map((other) => (
              <option key={other.id} value={other.id}>
                {other.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={addDependency}>
            Add
          </button>
        </div>
      </fieldset>

      <div className="ganttee-form__actions">
        <button type="submit" className="ganttee-primary">
          Save
        </button>
        <button
          type="button"
          className="ganttee-danger"
          onClick={() => props.onDelete(task.id)}
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function describeDependency(dep: Dependency, document: GanttDocument): string {
  const source = document.tasks.find((task) => task.id === dep.sourceId);
  const target = document.tasks.find((task) => task.id === dep.targetId);
  const label = DEPENDENCY_OPTIONS.find(
    (option) => option.value === dep.type,
  )?.label;
  return `${source?.title ?? "?"} → ${label} → ${target?.title ?? "?"}`;
}
