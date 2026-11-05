import { growthStats, dayXP } from "./gamification.js";
import { HABITS } from "../../shared/model/tracker.js";
export function GrowthSummary({ data, selected }) {
  const growth = growthStats(data),
    xp = dayXP(selected);
  return (
    <section className="growth-card">
      <div className="growth-heading">
        <div>
          <span className="eyebrow">YOUR EVERYDAY ADVENTURE</span>
          <h2>
            Level {growth.level} ·{" "}
            {growth.level < 3
              ? "Building roots"
              : growth.level < 7
                ? "Finding your rhythm"
                : "Growing stronger"}
          </h2>
        </div>
        <span className="level-badge" aria-hidden="true">
          🌱
        </span>
      </div>
      <div className="growth-metrics">
        <div>
          <b>{growth.streak}</b>
          <small>day streak</small>
        </div>
        <div>
          <b>{growth.xp}</b>
          <small>total XP</small>
        </div>
        <div>
          <b>{xp}</b>
          <small>selected day XP</small>
        </div>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Level progress"
        aria-valuemin={0}
        aria-valuemax={250}
        aria-valuenow={growth.levelXP}
      >
        <div style={{ width: `${(growth.levelXP / 250) * 100}%` }} />
      </div>
      <p className="small">
        {250 - growth.levelXP} XP to your next level. Small actions count.
        Missed days never take away earned XP.
      </p>
    </section>
  );
}
export function GrowthDetails({ data, week }) {
  const growth = growthStats(data);
  return (
    <>
      <section className="card">
        <span className="eyebrow">LITTLE MILESTONES</span>
        <h2>Watch yourself grow.</h2>
        <div className="badges">
          {growth.badges.map((b) => (
            <div key={b.name} className={b.earned ? "earned" : ""}>
              <span aria-hidden="true">{b.icon}</span>
              <strong>{b.name}</strong>
              <small>{b.earned ? "Unlocked" : b.hint}</small>
            </div>
          ))}
        </div>
        <p className="small">
          Best streak: {growth.best} days · {growth.activeDays} active days ·{" "}
          {growth.complete} days with all habits complete.
        </p>
      </section>
      <section className="card">
        <span className="eyebrow">YOUR WEEKLY HABIT MAP</span>
        <h2>See the pattern, then take a step.</h2>
        <div className="habit-map">
          {HABITS.map(([id, name]) => (
            <div className="habit-map-row" key={id}>
              <span>{name}</span>
              <div>
                {week.map((d) => (
                  <span
                    key={d.date}
                    className={
                      data.days[d.date]?.checked.includes(id) ? "hit" : ""
                    }
                    title={`${d.date}: ${data.days[d.date]?.checked.includes(id) ? "done" : "not checked"}`}
                    aria-label={`${d.date}: ${data.days[d.date]?.checked.includes(id) ? "done" : "not checked"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="small">
          Columns follow the seven dates in the chart above. Each filled square
          is one completed habit.
        </p>
      </section>
      <section className="card">
        <h3>How XP works</h3>
        <p className="muted">
          10 XP per habit, 5 XP per completed task (up to five tasks per day), 5
          XP for a daily win, and 10 XP for reflection. Levels need 250 XP.
          Points are calculated from saved entries, so checking an item
          repeatedly cannot earn extra points. Future dates count toward total
          XP when that day arrives.
        </p>
      </section>
    </>
  );
}
