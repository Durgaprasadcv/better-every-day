import {
  HABITS,
  PHASES,
  START,
  dayNumber,
  offsetDay,
  phaseIndex,
} from "../../shared/model/tracker.js";
export default function ChallengeView({ data, date, onSelect }) {
  const n = dayNumber(date);
  return (
    <section className="card">
      <span className="eyebrow">CONSISTENCY OVER PERFECTION</span>
      <h2>30 days. A stronger foundation.</h2>
      <p className="muted">
        6 November – 5 December 2026. Choose any day to plan ahead or check in.
      </p>
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
          const d = offsetDay(START, i),
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
