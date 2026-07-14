import { useEffect, useState } from "react";
import { Dependency, GanttDocument, Task } from "../common/models";
import { GanttChart } from "./GanttChart";
import { TaskForm } from "./TaskForm";
import { onHostMessage, postToHost } from "./vscodeApi";

/** Root editor UI: the ECharts timeline and the task edit panel. */
export function App(): JSX.Element {
  const [document, setDocument] = useState<GanttDocument | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onHostMessage((message) => {
      switch (message.type) {
        case "init":
        case "documentChanged":
          setDocument(message.document);
          break;
        case "selectTask":
          setSelectedTaskId(message.taskId);
          break;
        case "editTask":
          setSelectedTaskId(message.taskId);
          setEditingTaskId(message.taskId);
          break;
      }
    });
    postToHost({ type: "ready" });
    return unsubscribe;
  }, []);

  if (!document) {
    return <div className="ganttee-empty">Loading Gantt chart…</div>;
  }

  const editingTask = document.tasks.find((task) => task.id === editingTaskId);

  const saveTask = (task: Task) => {
    postToHost({ type: "updateTask", task });
    setEditingTaskId(null);
  };

  const deleteTask = (taskId: string) => {
    postToHost({ type: "deleteTask", taskId });
    setEditingTaskId(null);
  };

  const addDependency = (dependency: Dependency) =>
    postToHost({ type: "addDependency", dependency });

  const removeDependency = (dependencyId: string) =>
    postToHost({ type: "removeDependency", dependencyId });

  return (
    <div className="ganttee-layout">
      <div className="ganttee-timeline">
        {document.tasks.length === 0 && document.milestones.length === 0 ? (
          <div className="ganttee-empty">
            No tasks yet. Use the Ganttee sidebar to add one.
          </div>
        ) : (
          <GanttChart
            document={document}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onEditTask={setEditingTaskId}
          />
        )}
      </div>
      {editingTask && (
        <aside className="ganttee-panel">
          <TaskForm
            task={editingTask}
            document={document}
            onSave={saveTask}
            onDelete={deleteTask}
            onClose={() => setEditingTaskId(null)}
            onAddDependency={addDependency}
            onRemoveDependency={removeDependency}
          />
        </aside>
      )}
    </div>
  );
}
