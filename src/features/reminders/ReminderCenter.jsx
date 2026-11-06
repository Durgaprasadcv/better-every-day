import { useEffect, useRef, useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import {
  cancelPush,
  disablePush,
  enablePush,
  pushConfigured,
  pushSupport,
  schedulePush,
  watchReminders,
} from "./pushService.js";
export default function ReminderCenter({ user, reminders, notify, online }) {
  const pending = useRef(null);
  const [busy, setBusy] = useState(null),
    [items, setItems] = useState([]),
    [when, setWhen] = useState("");
  const [registered, setRegistered] = useState(false);
  useEffect(() => {
    setItems([]);
    setRegistered(false);
    if (!user || !pushConfigured) return;
    try {
      setRegistered(localStorage.getItem("bed-push-owner") === user.uid);
    } catch {}
    return watchReminders(user.uid, setItems, () =>
      notify(
        "Could not load phone reminders. Check your connection and try again.",
      ),
    );
  }, [user, notify]);
  const support = pushSupport();
  async function action(label, fn, success) {
    if (pending.current) return;
    pending.current = label;
    setBusy(label);
    try {
      await fn();
      notify(success);
    } catch (e) {
      notify(e.message);
    } finally {
      pending.current = null;
      setBusy(null);
    }
  }
  return (
    <>
      <section className="card">
        <span className="eyebrow">START HERE ON IPHONE</span>
        <h2>Keep your day within reach.</h2>
        <ol className="install-steps">
          <li>Open your deployed HTTPS site in Safari.</li>
          <li>
            Tap Share, then Add to Home Screen. Keep “Open as Web App” enabled
            if shown.
          </li>
          <li>Open Better Every Day from its new icon.</li>
          <li>Enable notifications below when you are ready.</li>
        </ol>
        <p className="notice">
          iPhone notifications require iOS 16.4 or later. Focus, Silent Mode,
          connectivity, and system settings affect alerts. This app cannot
          override them or act as a native Clock alarm.
        </p>
      </section>
      <section className="card">
        <div className="sectiontop">
          <div>
            <span className="eyebrow">WHILE THE APP IS OPEN</span>
            <h2>
              <Bell size={21} /> Task reminders & gentle sound
            </h2>
          </div>
        </div>
        <p className="muted">
          Timed tasks for today appear as a reminder at their due time, even
          while you view another day. Keep this app open and your screen awake.
          Very old tasks do not trigger a rush of alerts.
        </p>
        <div className="actions">
          <button
            onClick={() =>
              reminders.enabled
                ? reminders.disable()
                : reminders.enable().catch((e) => notify(e.message))
            }
          >
            {reminders.enabled
              ? "Pause task reminders"
              : "Enable task reminders"}
          </button>
          <button
            onClick={() =>
              reminders.sound
                ? reminders.mute()
                : reminders.enableSound().catch((e) => notify(e.message))
            }
          >
            {reminders.sound ? "Mute gentle sound" : "Enable gentle sound"}
          </button>
          {reminders.sound && (
            <button onClick={reminders.testSound}>Test sound</button>
          )}
        </div>
        <p className="small">
          Reminders and sound are enabled per session. Snooze lasts five minutes
          while this session stays open. Background phone reminders below are
          separate from planner tasks.
        </p>
      </section>
      <section className="card">
        <span className="eyebrow">EVEN WHEN THE APP IS CLOSED</span>
        <h2>
          <Smartphone size={22} /> Phone notifications
        </h2>
        <p className="muted">
          Schedule a private, one-time nudge. Only its time and this device’s
          push subscription go to your account; task names and journal text stay
          out of notification payloads.
        </p>
        {support && <p className="notice">{support}</p>}
        {!pushConfigured ? (
          <p className="notice">
            Phone push is not configured yet. The project owner must deploy the
            reminder service and add its public push key. Open-app task
            reminders work now.
          </p>
        ) : !user ? (
          <p className="notice">
            Sign in using the cloud button to set up phone notifications. Cloud
            backup remains optional.
          </p>
        ) : (
          <>
            <p className="small">
              {registered
                ? "This browser profile is registered. Disable notifications here before switching accounts."
                : "Enable this device before scheduling a phone reminder."}
            </p>
            <div className="actions">
              <button
                disabled={busy || !online || !!support}
                onClick={() =>
                  action(
                    "Enabling phone notifications…",
                    async () => {
                      await enablePush(user.uid);
                      setRegistered(true);
                    },
                    "This device is registered for phone reminders.",
                  )
                }
              >
                Enable this phone
              </button>
              <button
                disabled={busy || !online || !registered}
                onClick={() =>
                  action(
                    "Disabling phone notifications…",
                    async () => {
                      await disablePush(user.uid);
                      setRegistered(false);
                    },
                    "Phone notifications disabled on this device.",
                  )
                }
              >
                Disable this phone
              </button>
            </div>
            <form
              className="phone-schedule"
              onSubmit={(e) => {
                e.preventDefault();
                action(
                  "Scheduling reminder…",
                  async () => {
                    await schedulePush(user.uid, when);
                    setWhen("");
                  },
                  "Phone reminder saved. Delivery may be delayed by your device or network.",
                );
              }}
            >
              <label>
                Reminder date and time
                <input
                  type="datetime-local"
                  required
                  disabled={!!busy}
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
              <button disabled={busy || !online || !registered}>
                {busy === "Scheduling reminder…"
                  ? "Scheduling…"
                  : "Schedule phone reminder"}
              </button>
            </form>
            <div className="small" role="status">
              {busy}
            </div>
            <p className="small">
              Uses the time zone of this device. One-time reminders are
              independent of planner tasks and remain scheduled until canceled.
              Sign-out does not cancel reminders. Send times are checked
              approximately once a minute; delivery is best effort.
            </p>
            <ul className="phone-list">
              {items.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {item.dueAt?.toDate?.().toLocaleString() ||
                        "Scheduled reminder"}
                    </strong>
                    <small>
                      {item.status === "sent"
                        ? "Sent to push service"
                        : item.status}
                    </small>
                  </div>
                  <button
                    disabled={busy || !online}
                    onClick={() =>
                      action(
                        "Removing reminder…",
                        async () => {
                          await cancelPush(user.uid, item.id);
                          setItems((current) =>
                            current.filter(({ id }) => id !== item.id),
                          );
                        },
                        "Reminder removed. An alert already dispatched may still arrive.",
                      )
                    }
                  >
                    {item.status === "pending" ? "Cancel" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
            {items.length === 0 && (
              <p className="empty">
                No phone reminders yet. Schedule your first nudge above.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
