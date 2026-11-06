import AccountPanel from "../features/sync/AccountPanel.jsx";
import ReflectionJournal from "../features/journal/ReflectionJournal.jsx";
import ProgressDashboard from "../features/progress/ProgressDashboard.jsx";
import ChallengeView from "../features/challenge/ChallengeView.jsx";
import DailyPlanner from "../features/planner/DailyPlanner.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, Download, Leaf } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, configured } from "../shared/services/firebase.js";
import {
  PHASES,
  dayNumber,
  emptyData,
  emptyDay,
  localDay,
  phaseIndex,
  validateData,
  weeklyStats,
} from "../shared/model/tracker.js";
import {
  KEY,
  readLocal,
  saveDownload,
  writeLocal,
} from "../shared/services/localStorage.js";
import { backup, restore } from "../features/sync/backupService.js";
import { useReminders } from "../features/reminders/useReminders.js";
import ReminderCenter from "../features/reminders/ReminderCenter.jsx";
import AlarmDialog from "../features/reminders/AlarmDialog.jsx";
import { useLiveSync } from "../features/sync/useLiveSync.js";
import { GrowthSummary } from "../features/progress/Growth.jsx";

export default function App() {
  const [initial] = useState(() => {
    try {
      return { data: readLocal() };
    } catch {
      return {
        data: emptyData(),
        error:
          "Saved data could not be read. Export the stored copy before replacing it.",
      };
    }
  });
  const [data, setData] = useState(initial.data);
  const current = useRef(data);
  current.current = data;
  const [storageError, setStorageError] = useState(initial.error || "");
  const [date, setDate] = useState(localDay);
  const [tab, setTab] = useState("Today");
  const [account, setAccount] = useState(false);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(
    !!navigator.serviceWorker?.controller,
  );
  const [pending, setPending] = useState(null);
  const [revision, setRevision] = useState(0);
  const [storageConflict, setStorageConflict] = useState(false);
  const live = useLiveSync({
    user,
    data,
    applyRemote: commit,
    paused: storageConflict || !!initial.error,
  });
  const selected = data.days[date] || emptyDay();
  const notify = useCallback((text) => setMessage(text), []);
  const reminders = useReminders(data.days, notify);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const ready = () => setOfflineReady(!!navigator.serviceWorker?.controller);
    navigator.serviceWorker?.addEventListener("controllerchange", ready);
    const changed = (e) => {
      if (e.key === KEY) {
        setStorageConflict(true);
        setMessage(
          "Another tab changed this tracker. Export this tab, then reload to use the latest saved entries. Editing is paused.",
        );
      }
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("storage", changed);
    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", ready);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("storage", changed);
    };
  }, []);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setRevision(0);
      setPending(null);
    });
  }, []);
  function commit(next) {
    if (storageConflict || initial.error) return false;
    try {
      writeLocal(next);
      current.current = next;
      setData(next);
      setStorageError("");
      return true;
    } catch (e) {
      setStorageError(
        `Unable to save: ${e.message}. Changes were not applied. Export a backup and free storage.`,
      );
      return false;
    }
  }
  function update(patch) {
    const latest = current.current;
    return commit({
      ...latest,
      days: {
        ...latest.days,
        [date]: { ...emptyDay(), ...latest.days[date], ...patch },
      },
    });
  }
  function toggle(id) {
    update({
      checked: selected.checked.includes(id)
        ? selected.checked.filter((x) => x !== id)
        : [...selected.checked, id],
    });
  }
  const n = dayNumber(date);
  const week = useMemo(() => weeklyStats(data, date), [data, date]);
  const disabled = busy || storageConflict || !!initial.error;
  async function cloud(direction) {
    setBusy(true);
    setMessage("Connecting to your private backup…");
    try {
      if (!navigator.onLine)
        throw Error(
          "You are offline. Local changes are saved; retry backup when connected.",
        );
      if (direction === "up") {
        setRevision(await backup(user.uid, current.current, revision));
        setMessage("Cloud backup saved.");
      } else {
        const result = await restore(user.uid);
        setPending({ ...result, uid: user.uid, source: "cloud" });
        setMessage(
          "Cloud backup loaded for review. Export current entries before replacing them.",
        );
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 700000) throw Error("Backup is too large.");
      setPending({
        data: validateData(JSON.parse(await file.text())),
        source: "file",
      });
      setMessage("File validated. Review before replacing local entries.");
    } catch (e) {
      setMessage(`Import failed: ${e.message}`);
    }
  }
  function acceptRestore() {
    if (pending.uid && pending.uid !== user?.uid) return;
    if (!commit(pending.data)) return;
    if (pending.source === "cloud") setRevision(pending.revision);
    setPending(null);
    setMessage("Restore saved to this device.");
  }
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <div className="logo">
            <Leaf size={26} />
          </div>
          <div>
            <strong>BETTER EVERY DAY</strong>
            <small>Small steps. Stronger days.</small>
          </div>
        </div>
        <button
          className="avatar"
          onClick={() => setAccount(!account)}
          aria-label="Account and backups"
        >
          <Cloud size={20} />
        </button>
      </header>
      <main>
        <div className="statusline">
          <span>
            <i className={online ? "online" : "offline"} />
            {online
              ? "Local first · ready for your day"
              : "Offline · your tracker still works"}
          </span>
          <span>PRIVATE BY DEFAULT</span>
        </div>
        {message && (
          <div className="notice" role="status">
            {message}
            <button
              className="textbutton"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}
        {storageError && (
          <div className="error notice" role="alert">
            {storageError}{" "}
            {initial.error && (
              <button
                onClick={() => {
                  const raw = localStorage.getItem(KEY);
                  const a = document.createElement("a");
                  const url = URL.createObjectURL(
                    new Blob([raw || ""], { type: "application/json" }),
                  );
                  a.href = url;
                  a.download = "unreadable-local-backup.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export stored copy
              </button>
            )}
          </div>
        )}
        {account && (
          <AccountPanel
            user={user}
            operationBusy={busy}
            disabled={disabled}
            online={online}
            live={live}
            cloud={cloud}
            setMessage={setMessage}
          />
        )}
        {live.conflict && (
          <section className="card">
            <h2>Two versions need your review.</h2>
            <p>
              Device: {Object.keys(data.days).length} days · Cloud:{" "}
              {Object.keys(live.conflict.data.days).length} days. Export both
              before choosing. Neither version is merged automatically.
            </p>
            <div className="actions">
              <button onClick={() => saveDownload(data)}>
                Export device version
              </button>
              <button onClick={() => saveDownload(live.conflict.data)}>
                Export cloud version
              </button>
              <button disabled={disabled} onClick={live.chooseCloud}>
                Use cloud version
              </button>
              <button disabled={disabled} onClick={live.chooseDevice}>
                Keep device version
              </button>
            </div>
          </section>
        )}
        {pending && (
          <section className="card" role="region" aria-label="Review restore">
            <h2>Review replacement</h2>
            <p>
              This {pending.source} backup contains{" "}
              {Object.keys(pending.data.days).length} days. Applying it replaces
              all entries in this browser. Export current entries first to keep
              both versions.
            </p>
            <div className="actions">
              <button onClick={() => saveDownload(data)}>
                Export current entries
              </button>
              <button disabled={disabled} onClick={acceptRestore}>
                Replace local entries
              </button>
              <button onClick={() => setPending(null)}>Cancel</button>
            </div>
          </section>
        )}
        <section className="hero">
          <div>
            <span className="eyebrow">A LITTLE BETTER, EVERY DAY</span>
            <h1>
              Show up for
              <br />
              the life you want.
            </h1>
            <p>
              Make time for yourself, your home, and the people who matter.
              Start with today.
            </p>
          </div>
          <div className="hero-icon" aria-hidden="true">
            ✳
          </div>
        </section>
        <div className="datebar">
          <div>
            <span className="eyebrow">
              YOUR 30-DAY RESET · 6 NOV – 5 DEC 2026
            </span>
            <h2>
              {n < 1
                ? "Your next chapter starts soon"
                : n > 30
                  ? "Keep your momentum"
                  : `Day ${n} of 30`}
            </h2>
            <span className="muted">
              {n >= 1 && n <= 30
                ? PHASES[phaseIndex(n)]
                : n < 1
                  ? "Prepare a simple routine for tomorrow."
                  : "Keep building your everyday routine."}
            </span>
          </div>
          <label className="date-label">
            View date
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        </div>
        <nav aria-label="Tracker views">
          {["Today", "Challenge", "Progress", "Reflect", "Reminders"].map(
            (t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        {tab === "Today" && <GrowthSummary data={data} selected={selected} />}
        {tab === "Today" && (
          <DailyPlanner
            data={data}
            date={date}
            selected={selected}
            disabled={disabled}
            update={update}
            toggle={toggle}
            setMessage={setMessage}
          />
        )}
        {tab === "Challenge" && (
          <ChallengeView
            data={data}
            date={date}
            onSelect={(d) => {
              setDate(d);
              setTab("Today");
            }}
          />
        )}
        {tab === "Progress" && (
          <ProgressDashboard
            data={data}
            date={date}
            selected={selected}
            week={week}
          />
        )}
        {tab === "Reflect" && (
          <ReflectionJournal
            selected={selected}
            disabled={disabled}
            update={update}
          />
        )}
        {tab === "Reminders" && (
          <ReminderCenter
            user={user}
            reminders={reminders}
            notify={notify}
            online={online}
          />
        )}
        {reminders.alarm && (
          <AlarmDialog
            alarm={reminders.alarm}
            onDismiss={reminders.dismiss}
            onSnooze={reminders.snooze}
          />
        )}
        <section className="backup">
          <div>
            <h3>Your information belongs to you.</h3>
            <p>Local by default. Yours to back up.</p>
          </div>
          <div className="actions">
            <button onClick={() => saveDownload(data)}>
              <Download size={16} /> Export JSON
            </button>
            <label className="import-button">
              Import JSON
              <input
                disabled={disabled}
                type="file"
                accept="application/json,.json"
                onChange={importFile}
              />
            </label>
          </div>
        </section>
      </main>
      <footer>
        Built for better habits, not perfect days.
        <span>
          {configured ? "Optional Firebase available" : "Local mode"} ·{" "}
          {offlineReady
            ? "Offline ready"
            : "Offline cache activates in production"}{" "}
          · v0.2
        </span>
      </footer>
    </div>
  );
}
