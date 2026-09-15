import { formatShortDate } from "@common/datePresentation";
import { TaskStatus } from "@common/documents";
import { validateTaskConstraints } from "@services/schedule/scheduleConstraintService";
import "../../../components/Form.scss";
import { FormField } from "../../../components/FormField";
import { Select } from "../../../components/Select";
import { useTranslate, useWebviewL10n } from "../../../l10n";
import { TaskFieldsProps } from "../entityEditor.types";

import {
  STATUS_OPTIONS,
  taskStatusLabel,
  taskValidationMessages,
} from "../entityEditorPresentation";
import { makeUpdater } from "../hooks/useFieldUpdater";
import { CommonTextFields } from "./CommonTextFields";
import { DependencyFields } from "./DependencyFields";
import "./TaskFields.scss";
import { ValidationMessage } from "./ValidationMessage";

/** Renders task-specific fields plus dependency editing controls. */
export function TaskFields(props: TaskFieldsProps): React.JSX.Element {
  const { task, scheduledTask, onChange, ...depProps } = props;
  const { document } = depProps;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(task, onChange);

  const validation = validateTaskConstraints(task, document.dependencies);

  return (
    <div className="ganttee-form">
      <CommonTextFields
        name={task.name}
        description={task.description}
        groupId={task.groupId}
        groups={document.groups}
        onName={(name) => update("name", name)}
        onDescription={(description) => update("description", description)}
        onGroupId={(groupId) => update("groupId", groupId)}
      />
      <div className="ganttee-form__row">
        <FormField label={t("Start")}>
          <input
            type="date"
            value={task.start ?? ""}
            onChange={(event) => update("start", event.target.value || undefined)}
          />
          {scheduledTask && (
            <output>{formatShortDate(scheduledTask.effectiveStart(), locale)}</output>
          )}
        </FormField>
        <FormField label={t("End")}>
          <input
            type="date"
            min={task.start}
            value={task.end ?? ""}
            onChange={(event) => update("end", event.target.value || undefined)}
          />
          {scheduledTask && (
            <output>{formatShortDate(scheduledTask.effectiveEnd(), locale)}</output>
          )}
        </FormField>
      </div>

      <div className="ganttee-form__row">
        <FormField label={t("Duration")}>
          <input
            type="number"
            min={0}
            step="any"
            value={task.duration ?? ""}
            onChange={(event) =>
              update("duration", event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
          {scheduledTask && <output>{scheduledTask.effectiveDuration()}</output>}
        </FormField>
        <FormField label={t("Progress")}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((task.progress ?? 0) * 100)}
            onChange={(event) => update("progress", Number(event.target.value) / 100)}
          />
        </FormField>
      </div>

      <FormField label={t("Status")}>
        <Select
          value={task.status ?? "todo"}
          onChange={(event) => update("status", event.target.value as TaskStatus)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(taskStatusLabel(status))}
            </option>
          ))}
        </Select>
      </FormField>

      {taskValidationMessages(validation).map((message) => (
        <ValidationMessage severity={message.severity} key={message.source}>
          {t(message.source, ...(message.values ?? []))}
        </ValidationMessage>
      ))}

      <DependencyFields {...depProps} />
    </div>
  );
}
