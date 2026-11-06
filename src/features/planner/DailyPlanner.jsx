import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { HABITS, offsetDay } from "../../shared/model/tracker.js";
import PlannerTask from "./PlannerTask.jsx";
export default function DailyPlanner({
  data,
  date,
  selected,
  disabled,
  update,
  toggle,
  setMessage,
}) {
  const completed = selected.checked.length;
  const [taskName, setTaskName] = useState("");
  const [lastRemoved, setLastRemoved] = useState(null);
  function undoDelete() {
    if (!lastRemoved || lastRemoved.date !== date) return;
    if (selected.tasks.some((task) => task.id === lastRemoved.task.id)) {
      setLastRemoved(null);
      return;
    }
    if (selected.tasks.length >= 100) {
      setMessage(
        "This day already has 100 tasks. Remove a task before restoring this one.",
      );
      return;
    }
    if (update({ tasks: [...selected.tasks, lastRemoved.task] }))
      setLastRemoved(null);
  }
  return (
    <fieldset disabled={disabled} className="tracker-fields">
      <section className="card">
        <div className="sectiontop">
          <div>
            <span className="eyebrow">DAILY FOUNDATIONS</span>
            <h2>Keep a promise to yourself.</h2>
          </div>
          <div className="counter">
            {completed}
            <span> / {HABITS.length}</span>
          </div>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Daily habits"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={HABITS.length}
        >
          <div style={{ width: `${(completed / HABITS.length) * 100}%` }} />
        </div>
        <div className="checklist">
          {HABITS.map(([id, name, group]) => (
            <label className="checkrow" key={id}>
              <input
                type="checkbox"
                checked={selected.checked.includes(id)}
                onChange={() => toggle(id)}
              />
              <span className="task">
                <span>{name}</span>
                <small>{group}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="sectiontop">
          <div>
            <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
            <h2>Your daily plan</h2>
          </div>
          <CheckCircle2 size={22} />
        </div>
        <p className="muted">Give each responsibility a time and a place.</p>
        <button
          className="routine-copy"
          type="button"
          disabled={!data.days[offsetDay(date, -1)]?.tasks.length}
          onClick={() => {
            const previous = data.days[offsetDay(date, -1)]?.tasks || [];
            if (selected.tasks.length + previous.length > 100) {
              setMessage("There is room for at most 100 tasks in a day.");
              return;
            }
            update({
              tasks: [
                ...selected.tasks,
                ...previous.map((t) => ({
                  ...t,
                  id: crypto.randomUUID(),
                  done: false,
                })),
              ],
            });
            setMessage("Yesterday’s plan added with fresh checkboxes.");
          }}
        >
          Repeat yesterday’s plan
        </button>
        <form
          className="planner-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const name = taskName.trim();
            if (!name) return;
            if (selected.tasks.length >= 100) {
              setMessage("This day already has 100 tasks.");
              return;
            }
            const saved = update({
              tasks: [
                ...selected.tasks,
                {
                  id: crypto.randomUUID(),
                  name,
                  time: f.elements.time.value,
                  group: f.elements.group.value,
                  done: false,
                },
              ],
            });
            if (saved) {
              f.reset();
              setTaskName("");
            }
          }}
        >
          <input
            name="task"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            aria-label="Task name"
            placeholder="What will you make time for?"
            required
            maxLength="140"
          />
          <div className="plan-options">
            <label>
              Time
              <input name="time" type="time" />
            </label>
            <label>
              Responsibility
              <select name="group">
                {["Personal", "Home", "Family", "Childcare"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <button>Add task</button>
          </div>
        </form>
        {lastRemoved?.date === date && (
          <div className="notice" role="status">
            Task removed: {lastRemoved.task.name}
            <button className="routine-copy" type="button" onClick={undoDelete}>
              Undo deletion
            </button>
            <button
              className="textbutton"
              type="button"
              aria-label="Dismiss undo deletion"
              onClick={() => setLastRemoved(null)}
            >
              ×
            </button>
          </div>
        )}
        {selected.tasks.length === 0 && (
          <p className="empty">
            A clear day starts with one small plan. Add your first task above.
          </p>
        )}
        {[...selected.tasks]
          .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
          .map((t) => (
            <PlannerTask
              key={t.id}
              task={t}
              onToggle={() =>
                update({
                  tasks: selected.tasks.map((x) =>
                    x.id === t.id ? { ...x, done: !x.done } : x,
                  ),
                })
              }
              onDelete={() => {
                if (
                  update({ tasks: selected.tasks.filter((x) => x.id !== t.id) })
                )
                  setLastRemoved({ date, task: t });
              }}
              onSave={(patch) =>
                update({
                  tasks: selected.tasks.map((x) =>
                    x.id === t.id ? { ...x, ...patch } : x,
                  ),
                })
              }
            />
          ))}
      </section>
      <section className="card">
        <span className="eyebrow">A QUICK HEALTH CHECK-IN</span>
        <h2>Notice your everyday patterns.</h2>
        <div className="metrics">
          {[
            ["minutes", "Walking minutes", 1440],
            ["sleep", "Sleep hours", 24],
            ["screen", "Screen time hours", 24],
          ].map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                max={max}
                step={key === "minutes" ? 1 : 0.5}
                value={selected[key]}
                onChange={(e) =>
                  update({
                    [key]: Math.max(
                      0,
                      Math.min(max, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>
    </fieldset>
  );
}
