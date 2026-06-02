import { useSyncExternalStore } from "react";
import { getPrefs, subscribe } from "./prefs.js";

export function usePrefs() {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}
