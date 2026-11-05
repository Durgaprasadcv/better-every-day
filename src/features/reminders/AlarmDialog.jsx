import { useEffect, useRef } from "react";
export default function AlarmDialog({ alarm, onDismiss, onSnooze }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="alarm-dialog"
      aria-label="Task reminder"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <div>
        <span className="eyebrow">TIME TO CHECK IN</span>
        <h2>{alarm.name}</h2>
        <p>One small action brings you a step forward.</p>
        <div className="actions">
          <button autoFocus onClick={onDismiss}>
            Dismiss reminder
          </button>
          <button onClick={onSnooze}>Snooze 5 minutes</button>
        </div>
      </div>
    </dialog>
  );
}
