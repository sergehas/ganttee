import {
  Dependency,
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
  /** Kind of entity currently being edited. */
  kind: EditableEntityKind;
  /** Entity data currently being edited. */
  entity: EditableEntityMap[EditableEntityKind];
}

/** Props for the TaskForm orchestrator component. */
export interface TaskFormProps {
  /** Entity selected for editing. */
  editingEntity: TaskFormEditingEntity;
  /** Current parsed Gantt document. */
  document: GanttDocument;
  /** Saves an edited entity and its dependencies. */
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: { keepEditorOpen?: boolean },
    dependencies?: Dependency[],
  ) => void;
  /** Deletes an entity. */
  onDelete: (entity: EditableEntityRef) => void;
  /** Closes the edit form. */
  onClose: () => void;
  /** Adds a dependency for the current entity. */
  onAddDependency: (
    ownerId: string | undefined,
    targetId: string,
    type: DependencyType,
  ) => void;
  /** Removes a dependency by identifier. */
  onRemoveDependency: (dependencyId: string) => void;
  /** Removes an entity from its group. */
  onUngroupEntity: (
    entity: EditableEntityRef,
    options?: SaveEntityOptions,
  ) => void;
  /** Opens another entity in the edit form. */
  onRequestEditEntity: (entity: EditableEntityRef) => void;
}

/** Props for the CommonTextFields section shared by all entity editors. */
export interface CommonTextFieldsProps {
  /** Entity name value. */
  name: string;
  /** Optional entity description. */
  description?: string;
  /** Optional containing group identifier. */
  groupId?: string;
  /** Groups available for selection. */
  groups: Group[];
  /** Group identifier excluded from the selection. */
  excludedGroupId?: string;
  /** Updates the entity name. */
  onName: (name: string) => void;
  /** Updates or clears the entity description. */
  onDescription: (description: string | undefined) => void;
  /** Updates or clears the containing group. */
  onGroupId: (groupId: string | undefined) => void;
}

/** Props for the task-specific fields section. */
export interface TaskFieldsProps extends DependencyEditorProps {
  /** Task draft displayed by the fields. */
  task: Task;
  /** Replaces the task draft. */
  onChange: (task: Task) => void;
}

/** Props for the milestone-specific fields section. */
export interface MilestoneFieldsProps extends DependencyEditorProps {
  /** Milestone draft displayed by the fields. */
  milestone: Milestone;
  /** Replaces the milestone draft. */
  onChange: (milestone: Milestone) => void;
}

/** Props for the group-specific fields section. */
export interface GroupFieldsProps {
  /** Group draft displayed by the fields. */
  group: Group;
  /** Current parsed Gantt document. */
  document: GanttDocument;
  /** Replaces the group draft. */
  onChange: (group: Group) => void;
  /** Opens a member entity in the edit form. */
  onRequestEditEntity: (entity: EditableEntityRef) => void;
  /** Removes the group membership from an entity. */
  onUngroupEntity: (ref: EditableEntityRef) => void;
}

/** Props for dependency list/add controls section. */
export type DependencyFieldsProps = DependencyEditorProps;
