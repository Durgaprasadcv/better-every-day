import {
  collection,
  limit,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../shared/services/firebase.js";
const pushApi = import.meta.env.VITE_PUSH_API_URL?.replace(/\/$/, "");
async function request(uid, path, method = "GET", body, signal) {
  const user = auth?.currentUser;
  if (!user || user.uid !== uid)
    throw Error("Sign in again to manage reminders.");
  const token = await user.getIdToken();
  const response = await fetch(`${pushApi}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Reminder service unavailable.");
  return data;
}
export const pushConfigured = !!import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
export function pushSupport() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  if (ios && !installed)
    return "On iPhone: open in Safari, tap Share → Add to Home Screen, then open the new app icon.";
  if (!window.isSecureContext)
    return "Phone notifications require a secure HTTPS website.";
  if (
    !("PushManager" in window) ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  )
    return "Push notifications are unavailable here. Use a Home Screen app on iOS 16.4 or later.";
  return "";
}
function deviceId() {
  const key = "bed-push-device";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
function publicKey(value) {
  const text = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}
export async function enablePush(uid) {
  const support = pushSupport();
  if (support) throw Error(support);
  const owner = localStorage.getItem("bed-push-owner");
  if (owner && owner !== uid)
    throw Error(
      "Disable phone notifications in the previous account before enabling another account on this browser profile.",
    );
  // Request from the original gesture before awaiting registration/network.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Notifications are blocked. Enable them for Better Every Day in iPhone Settings → Notifications.",
    );
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active)
    throw Error(
      "Install the production app first, then reload once and try again.",
    );
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY),
  });
  const id = deviceId();
  // A browser push subscription may belong to only one signed-in account on this profile.
  if (owner && owner !== uid)
    throw Error(
      "Disable phone notifications in the previous account before enabling another account on this browser profile.",
    );
  if (pushApi)
    await request(uid, "/devices", "POST", {
      id,
      subscription: subscription.toJSON(),
    });
  else
    await setDoc(doc(db, "users", uid, "pushDevices", id), {
      subscription: subscription.toJSON(),
      updatedAt: serverTimestamp(),
    });
  localStorage.setItem("bed-push-owner", uid);
  return id;
}
export async function disablePush(uid) {
  if (pushApi) await request(uid, `/devices/${deviceId()}`, "DELETE");
  else await deleteDoc(doc(db, "users", uid, "pushDevices", deviceId()));
  const registration = await navigator.serviceWorker.getRegistration();
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
  localStorage.removeItem("bed-push-owner");
}
export function watchReminders(uid, next, error) {
  if (pushApi) {
    let stopped = false;
    let timer;
    const controller = new AbortController();
    async function refresh() {
      try {
        const { items } = await request(
          uid,
          "/reminders",
          "GET",
          undefined,
          controller.signal,
        );
        if (!stopped)
          next(
            items.map((item) => ({
              ...item,
              dueAt: Timestamp.fromMillis(item.due_at),
            })),
          );
      } catch (e) {
        if (!stopped) error(e);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 30000);
      }
    }
    refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }
  return onSnapshot(
    query(
      collection(db, "users", uid, "reminders"),
      orderBy("dueAt", "desc"),
      limit(30),
    ),
    (snapshot) => next(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error,
  );
}
export async function schedulePush(uid, value) {
  const due = new Date(value);
  if (
    !Number.isFinite(due.getTime()) ||
    due.getTime() < Date.now() + 60000 ||
    due.getTime() > Date.now() + 30 * 86400000
  )
    throw Error(
      "Choose a time at least one minute ahead and within the next 30 days.",
    );
  if (localStorage.getItem("bed-push-owner") !== uid)
    throw Error("Enable phone notifications on this device first.");
  const id = crypto.randomUUID();
  if (pushApi)
    return request(uid, "/reminders", "POST", {
      id,
      device: deviceId(),
      dueAt: due.getTime(),
    });
  await setDoc(doc(db, "users", uid, "reminders", id), {
    dueAt: Timestamp.fromDate(due),
    status: "pending",
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(due.getTime() + 7 * 86400000),
  });
}
export const cancelPush = (uid, id) =>
  pushApi
    ? request(uid, `/reminders/${encodeURIComponent(id)}`, "DELETE")
    : deleteDoc(doc(db, "users", uid, "reminders", id));
