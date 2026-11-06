import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../shared/services/firebase.js";
import { backup, restore } from "./backupService.js";
import { emptyData, validateData } from "../../shared/model/tracker.js";
const metadataKey = (uid) => `bed-live-sync:${uid}`;
const preferenceKey = (uid) => `bed-live-sync-enabled:${uid}`;

function readSyncState(uid) {
  const raw = JSON.parse(localStorage.getItem(metadataKey(uid)) || "null");
  return {
    revision: Number.isInteger(raw?.revision) ? raw.revision : 0,
    base: typeof raw?.base === "string" ? raw.base : null,
    ready: false,
    inflight: null,
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export const serialize = (data) =>
  JSON.stringify(canonical(validateData(data)));
export function decideRemote(
  local,
  base,
  remote,
  remoteRevision,
  baseRevision,
  inflight,
) {
  if (remoteRevision === 0 && baseRevision > 0) return "conflict";
  if (
    local === remote ||
    (inflight?.json === remote && remoteRevision === inflight.revision + 1)
  )
    return "acknowledge";
  if (remoteRevision === 0 && baseRevision === 0) return "upload";
  if (remote === base && remoteRevision === baseRevision) return "upload";
  if (local === base || local === serialize(emptyData())) return "download";
  return "conflict";
}
export function useLiveSync({ user, data, applyRemote, paused }) {
  const [enabledUid, setEnabledUid] = useState(null),
    [status, setStatus] = useState("Live saving is off"),
    [conflict, setConflict] = useState(null),
    [tick, setTick] = useState(0);
  const state = useRef({
      revision: 0,
      base: null,
      ready: false,
      inflight: null,
    }),
    dataRef = useRef(data),
    applyRef = useRef(applyRemote),
    pausedRef = useRef(paused);
  dataRef.current = data;
  applyRef.current = applyRemote;
  pausedRef.current = paused;
  const uid = user?.uid;
  const enabled = !!uid && enabledUid === uid;
  const session = useRef(0);
  function persist() {
    try {
      localStorage.setItem(
        metadataKey(uid),
        JSON.stringify({
          revision: state.current.revision,
          base: state.current.base,
        }),
      );
    } catch {
      setStatus(
        "Saved locally; sync metadata could not be stored. Free browser storage before continuing.",
      );
      setEnabledUid(null);
    }
  }
  function acknowledge(remote, revision) {
    state.current.base = remote;
    state.current.revision = revision;
    state.current.ready = true;
    persist();
  }
  useEffect(() => {
    setEnabledUid(null);
    setConflict(null);
    setStatus("Live saving is off");
    state.current = { revision: 0, base: null, ready: false, inflight: null };
    if (!uid) return;
    try {
      if (localStorage.getItem(preferenceKey(uid)) !== "true") return;
      state.current = readSyncState(uid);
      setEnabledUid(uid);
    } catch {
      setStatus(
        "Could not restore live saving. Your entries still save on this device.",
      );
    }
  }, [uid]);
  useEffect(() => {
    const online = () => {
      if (state.current.base !== null) state.current.ready = true;
      setTick((t) => t + 1);
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  useEffect(() => {
    if (!enabled || !uid) return;
    session.current++;
    let active = true;
    setStatus(
      navigator.onLine
        ? "Connecting live saving…"
        : "Offline · changes are saved on this device",
    );
    const unsubscribe = onSnapshot(
      doc(db, "users", uid, "app", "tracker"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          !active ||
          pausedRef.current ||
          snapshot.metadata.fromCache ||
          snapshot.metadata.hasPendingWrites
        )
          return;
        try {
          const value = snapshot.exists()
            ? snapshot.data()
            : { ...emptyData(), revision: 0 };
          if (!Number.isInteger(value.revision) || value.revision < 0)
            throw Error("Invalid cloud revision.");
          const remote = serialize(value),
            local = serialize(dataRef.current);
          const choice = decideRemote(
            local,
            state.current.base,
            remote,
            value.revision,
            state.current.revision,
            state.current.inflight,
          );
          if (choice === "conflict") {
            setConflict({
              data: validateData(value),
              revision: value.revision,
            });
            setStatus("Review a cloud conflict · device entries are safe");
            state.current.ready = false;
            return;
          }
          if (choice === "download") {
            if (!applyRef.current(validateData(value))) {
              setStatus(
                "Cloud update could not be saved locally. Your current entries are unchanged.",
              );
              return;
            }
            dataRef.current = validateData(value);
            acknowledge(remote, value.revision);
          } else if (choice === "acknowledge")
            acknowledge(remote, value.revision);
          else state.current.ready = true;
          setConflict(null);
          setStatus("Live saving ready");
          setTick((t) => t + 1);
        } catch (e) {
          setStatus(`Live saving paused: ${e.message}`);
          state.current.ready = false;
        }
      },
      () => {
        if (active) {
          setStatus(
            "Live saving could not connect. Check Firebase rules and your connection.",
          );
          state.current.ready = false;
        }
      },
    );
    return () => {
      active = false;
      session.current++;
      unsubscribe();
      state.current.ready = false;
      state.current.inflight = null;
    };
  }, [enabled, uid]);
  useEffect(() => {
    if (
      !enabled ||
      !uid ||
      paused ||
      conflict ||
      !state.current.ready ||
      state.current.inflight
    )
      return;
    const json = serialize(data);
    if (json === state.current.base) {
      setStatus("All changes saved to Firebase");
      return;
    }
    if (!navigator.onLine) {
      setStatus(
        "Offline · changes are saved on this device and will retry when online",
      );
      return;
    }
    const version = session.current;
    const validSession = () => version === session.current;
    const timer = setTimeout(async () => {
      const payload = dataRef.current,
        sent = { json: serialize(payload), revision: state.current.revision };
      state.current.inflight = sent;
      setStatus("Saving to Firebase…");
      try {
        const revision = await backup(uid, payload, sent.revision);
        if (!validSession()) return;
        acknowledge(sent.json, revision);
        setStatus("All changes saved to Firebase");
      } catch (error) {
        if (!validSession()) return;
        if (error.message.includes("changed on another device")) {
          try {
            const remote = await restore(uid);
            if (validSession()) {
              setConflict(remote);
              state.current.ready = false;
              setStatus("Review a cloud conflict · device entries are safe");
            }
          } catch {
            setStatus(
              "Saved locally. Reconnect live saving to review the latest cloud version.",
            );
          }
        } else {
          state.current.ready = false;
          setStatus(
            "Saved locally. Cloud saving failed; use Retry to reconnect.",
          );
        }
      } finally {
        if (validSession()) {
          state.current.inflight = null;
          setTick((t) => t + 1);
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [enabled, uid, data, paused, conflict, tick]);
  function enable() {
    if (!uid || enabled) return;
    try {
      state.current = readSyncState(uid);
      localStorage.setItem(preferenceKey(uid), "true");
      setConflict(null);
      setEnabledUid(uid);
    } catch {
      setStatus(
        "Live saving metadata is unavailable. Export your local entries and free browser storage first.",
      );
    }
  }
  function chooseCloud() {
    if (!conflict || !applyRef.current(conflict.data)) return;
    dataRef.current = conflict.data;
    acknowledge(serialize(conflict.data), conflict.revision);
    setConflict(null);
    setTick((t) => t + 1);
  }
  function chooseDevice() {
    if (!conflict) return;
    acknowledge(serialize(conflict.data), conflict.revision);
    setConflict(null);
    setTick((t) => t + 1);
  }
  return {
    enabled,
    status,
    conflict,
    enable,
    retry: () => {
      state.current.ready = true;
      setTick((t) => t + 1);
    },
    disable: () => {
      setEnabledUid(null);
      setConflict(null);
      setStatus("Live saving is off · entries still save on this device");
      try {
        if (uid) localStorage.removeItem(preferenceKey(uid));
      } catch {
        setStatus(
          "Live saving is off for now. The change could not be saved for next time.",
        );
      }
    },
    chooseCloud,
    chooseDevice,
  };
}
