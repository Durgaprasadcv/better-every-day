import { useState } from "react";
import {
  HABITS,
  PHASES,
  START,
  dayNumber,
  offsetDay,
  phaseIndex,
  localDay,
} from "../../shared/model/tracker.js";
export default function ChallengeView({
  data,
  date,
  onSelect,
  onStartChange,
  disabled,
}) {
  const start = data.challengeStart || START;
  const [draftStart, setDraftStart] = useState(start);
  const n = dayNumber(date, start);
  return (
    <section className="card">
      <span className="eyebrow">CONSISTENCY OVER PERFECTION</span>
      <h2>30 days. A stronger foundation.</h2>
      <p className="muted">
        {start} – {offsetDay(start, 29)}. Choose any day to plan ahead or check
        in.
      </p>
      <form
        className="challenge-settings"
        onSubmit={(event) => {
          event.preventDefault();
          onStartChange(draftStart);
        }}
      >
        <label className="date-label">
          Challenge start date
          <input
            type="date"
            required
            value={draftStart}
            disabled={disabled}
            onChange={(event) => setDraftStart(event.target.value)}
          />
        </label>
        <div className="actions">
          <button disabled={disabled || !draftStart || draftStart === start}>
            Save start date
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const today = localDay();
              setDraftStart(today);
              onStartChange(today);
            }}
          >
            Start fresh today
          </button>
        </div>
        <p className="small">
          Your new date becomes Day 1. Previous entries stay on their original
          dates. The start date is included in backups and live saving.
        </p>
      </form>
      <div className="phases">
        {PHASES.map((p, i) => (
          <div
            key={p}
            className={n >= 1 && n <= 30 && phaseIndex(n) === i ? "active" : ""}
          >
            <small>
              DAYS {i * 7 + 1}–{i === 3 ? 30 : (i + 1) * 7}
            </small>
            <strong>{p}</strong>
          </div>
        ))}
      </div>
      <div className="calendar">
        {Array.from({ length: 30 }, (_, i) => {
          const d = offsetDay(start, i),
            count = data.days[d]?.checked.length || 0;
          return (
            <button
              key={d}
              title={`${d}: ${count} of ${HABITS.length} habits`}
              aria-label={`Day ${i + 1}, ${count} habits complete`}
              className={`${count === HABITS.length ? "complete" : count ? "started" : ""} ${date === d ? "current" : ""}`}
              onClick={() => {
                onSelect(d);
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="muted">
        Light green: started · Dark green: all daily habits complete
      </p>
    </section>
  );
}
