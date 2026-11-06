import { emptyData, validateData } from "../model/tracker.js";
export const KEY = "better-every-day-v2";
export function readLocal(storage = localStorage) {
  const raw = storage.getItem(KEY);
  return raw ? validateData(JSON.parse(raw)) : emptyData();
}
export function writeLocal(data, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(validateData(data)));
}
export function saveDownload(data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `better-every-day-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
