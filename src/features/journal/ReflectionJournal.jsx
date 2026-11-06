export default function ReflectionJournal({ selected, disabled, update }) {
  return (
    <fieldset disabled={disabled} className="tracker-fields">
      <section className="card">
        <span className="eyebrow">A QUIET MOMENT FOR YOU</span>
        <h2>Reflect without judging.</h2>
        {[
          ["wins", "What went well today?", "Even one small win matters."],
          [
            "journal",
            "What would you do differently tomorrow?",
            "Write with kindness and honesty.",
          ],
        ].map(([key, label, hint]) => (
          <label className="field" key={key}>
            {label}
            <textarea
              maxLength="10000"
              value={selected[key]}
              placeholder={hint}
              onChange={(e) => update({ [key]: e.target.value })}
            />
          </label>
        ))}
        <p className="notice">
          Saved to this browser as you write. Reflections are included when you
          export, back up, or enable live saving.
        </p>
      </section>
    </fieldset>
  );
}
