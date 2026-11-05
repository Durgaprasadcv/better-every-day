import { Trash2 } from "lucide-react";
export default function PlannerTask({ task, onToggle, onDelete, onSave }) {
  return (
    <div className="planner-task">
      <div className="taskline">
        <label className="checkrow">
          <input type="checkbox" checked={task.done} onChange={onToggle} />
          <span className="task">
            <span>{task.name}</span>
            <small>
              {task.time || "Any time"} · {task.group}
            </small>
          </span>
        </label>
        <button
          type="button"
          className="delete"
          aria-label={`Delete ${task.name}`}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <details>
        <summary>Edit task</summary>
        <form
          className="task-edit"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              name = form.elements.name.value.trim();
            if (!name) return;
            onSave({
              name,
              time: form.elements.time.value,
              group: form.elements.group.value,
            });
            form.closest("details").open = false;
          }}
        >
          <label>
            Name
            <input
              name="name"
              defaultValue={task.name}
              required
              maxLength="140"
            />
          </label>
          <label>
            Time
            <input name="time" type="time" defaultValue={task.time} />
          </label>
          <label>
            Responsibility
            <select name="group" defaultValue={task.group}>
              {["Personal", "Home", "Family", "Childcare"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <button>Save task</button>
        </form>
      </details>
    </div>
  );
}
