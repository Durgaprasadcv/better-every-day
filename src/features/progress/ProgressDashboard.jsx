import { HABITS } from "../../shared/model/tracker.js";
import { GrowthSummary, GrowthDetails } from "./Growth.jsx";
export default function ProgressDashboard({ data, date, selected, week }) {
  return (
    <>
      <GrowthSummary data={data} selected={selected} />
      <p className="muted">The seven days ending {date}</p>
      <div className="stats">
        {[
          ["HABITS DONE", week.reduce((s, d) => s + d.habits, 0)],
          ["TASKS DONE", week.reduce((s, d) => s + d.tasks, 0)],
          ["WALKING MIN", week.reduce((s, d) => s + d.minutes, 0)],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <span className="eyebrow">{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Your week, one day at a time.</h2>
        <div
          className="week-chart"
          role="img"
          aria-label={week
            .map((d) => `${d.date}: ${d.habits} habits`)
            .join("; ")}
        >
          {week.map((d) => (
            <div className="day-bar" key={d.date}>
              <span>
                {d.habits}/{HABITS.length}
              </span>
              <div className="bar-track">
                <div
                  style={{
                    height: `${(d.habits / HABITS.length) * 100}%`,
                  }}
                />
              </div>
              <small>{d.date.slice(5)}</small>
            </div>
          ))}
        </div>
      </section>
      <GrowthDetails data={data} week={week} />
    </>
  );
}
