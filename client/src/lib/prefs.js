// Tiny localStorage-backed preferences with a pub/sub so React components
// can subscribe via useSyncExternalStore. Stores three things today:
//   - theme: "light" | "dark"  (also written to <html data-theme>)
//   - mapStyle: "light" | "dark" | "satellite"
//   - displayName: string  (the user's name used when joining shared groups)
//   - joinedGroups: [{ token, name, joinedAt }]

const KEY = "tb-prefs-v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

let state = {
  theme: "light",
  mapStyle: "light",
  displayName: "",
  joinedGroups: [],
  ...load(),
};

const listeners = new Set();
function notify() { listeners.forEach((l) => l()); }

export function getPrefs() { return state; }
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }

export function setPrefs(patch) {
  state = { ...state, ...patch };
  save(state);
  applyTheme(state.theme);
  notify();
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

export function rememberJoinedGroup({ token, name, group_name }) {
  const filtered = state.joinedGroups.filter((g) => g.token !== token);
  setPrefs({
    joinedGroups: [
      { token, name, group_name, joinedAt: Date.now() },
      ...filtered,
    ].slice(0, 20),
  });
}

export function forgetJoinedGroup(token) {
  setPrefs({ joinedGroups: state.joinedGroups.filter((g) => g.token !== token) });
}

// Apply theme on first import so flicker is minimised.
applyTheme(state.theme);
