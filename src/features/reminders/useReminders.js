import { useEffect, useRef, useState } from "react";
import { localDay } from "../../shared/model/tracker.js";
export function useReminders(days, notify) {
  const [enabled, setEnabled] = useState(false);
  const [alarm, setAlarm] = useState(null);
  const [sound, setSound] = useState(false);
  const audio = useRef(null),
    seen = useRef(new Set()),
    snoozes = useRef(new Map());
  async function enableSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error("Sound is unavailable in this browser.");
    audio.current ||= new Audio();
    await audio.current.resume();
    setSound(true);
  }
  function beep() {
    const ctx = audio.current;
    if (!sound || !ctx || ctx.state !== "running") return;
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        at = ctx.currentTime + i * 0.35;
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.12, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.23);
    }
  }
  useEffect(() => {
    if (!enabled || alarm) return;
    function check() {
      const now = new Date(),
        date = localDay(now),
        tasks = [...(days[date]?.tasks || [])];
      // Include yesterday's task if a five-minute snooze crosses midnight.
      for (const key of snoozes.current.keys()) {
        const savedDate = key.slice(0, 10);
        if (savedDate !== date) {
          const task = days[savedDate]?.tasks.find(
            (t) => key === `${savedDate}:${t.id}:${t.time}`,
          );
          if (task) tasks.push({ ...task, reminderDate: savedDate });
        }
      }
      for (const task of tasks) {
        if (task.done || !task.time) continue;
        const key = `${task.reminderDate || date}:${task.id}:${task.time}`,
          due =
            snoozes.current.get(key) ??
            new Date(`${date}T${task.time}:00`).getTime();
        // Only alert within 15 minutes of the due time; reopening never floods old alarms.
        if (
          due > now.getTime() ||
          now.getTime() - due > 15 * 60000 ||
          seen.current.has(key)
        )
          continue;
        seen.current.add(key);
        snoozes.current.delete(key);
        setAlarm({ key, name: task.name });
        notify(`Reminder: ${task.name}`);
        beep();
        if ("Notification" in window && Notification.permission === "granted") {
          navigator.serviceWorker
            ?.getRegistration()
            .then((reg) =>
              reg?.showNotification("Better Every Day", {
                body: "A planned task is ready. Open your tracker to review it.",
                tag: key,
              }),
            )
            .catch(() => {});
        }
        break;
      }
    }
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [enabled, days, alarm, sound, notify]);
  useEffect(
    () => () => {
      audio.current?.close().catch(() => {});
    },
    [],
  );
  async function enable() {
    // Foreground reminders work even if the optional OS permission prompt stays open.
    setEnabled(true);
    // Permission request starts directly in the click handler for iOS.
    if ("Notification" in window && Notification.permission === "default")
      await Notification.requestPermission();
  }
  function snooze() {
    if (!alarm) return;
    snoozes.current.set(alarm.key, Date.now() + 5 * 60000);
    seen.current.delete(alarm.key);
    setAlarm(null);
  }
  return {
    enabled,
    enable,
    testSound: beep,
    disable: () => {
      setEnabled(false);
      setAlarm(null);
    },
    alarm,
    dismiss: () => setAlarm(null),
    snooze,
    sound,
    enableSound,
    mute: () => setSound(false),
  };
}
