import {
  DependencyType,
  GanttDocument,
  Group,
  Milestone,
  Task,
} from "../../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../../common/protocol";
import { SaveEntityOptions } from "../../services/entityEditWorkflowService";
import { DependencyEditorProps } from "../useEntityEditWorkflow";

/** Routed editing target consumed by the TaskForm orchestrator. */
export interface TaskFormEditingEntity {
  kind: EditableEntityKind;
  entity: EditableEntityMap[EditableEntityKind];
}

/** Props for the TaskForm orchestrator component. */
export interface TaskFormProps {
  editingEntity: TaskFormEditingEntity;
  document: GanttDocument;
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: { keepEditorOpen?: boolean },
  ) => void;
  onDelete: (entity: EditableEntityRef) => void;
  onClose: () => void;
  onAddDependency: (
    ownerId: string | undefined,
    targetId: string,
    type: DependencyType,
  ) => void;
  onRemoveDependency: (dependencyId: string) => void;
  onUngroupEntity: (
    entity: EditableEntityRef,
    options?: SaveEntityOptions,
  ) => void;
  onRequestEditEntity: (entity: EditableEntityRef) => void;
}

/** Props for the CommonTextFields section shared by all entity editors. */
export interface CommonTextFieldsProps {
  name: string;
  description?: string;
  groupId?: string;
  groups: Group[];
  excludedGroupId?: string;
  onName: (name: string) => void;
  onDescription: (description: string | undefined) => void;
  onGroupId: (groupId: string | undefined) => void;
}

/** Props for the task-specific fields section. */
export interface TaskFieldsProps extends DependencyEditorProps {
  task: Task;
  onChange: (task: Task) => void;
}

/** Props for the milestone-specific fields section. */
export interface MilestoneFieldsProps extends DependencyEditorProps {
  milestone: Milestone;
  onChange: (milestone: Milestone) => void;
}

/** Props for the group-specific fields section. */
export interface GroupFieldsProps {
  group: Group;
  document: GanttDocument;
  onChange: (group: Group) => void;
  onRequestEditEntity: (entity: EditableEntityRef) => void;
  onUngroupEntity: (ref: EditableEntityRef) => void;
}

/** Props for dependency list/add controls section. */
export type DependencyFieldsProps = DependencyEditorProps;
