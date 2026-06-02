const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch {}
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),
  listPlaces: () => request("/places"),
  getPlace: (id) => request(`/places/${id}`),
  createPlace: (data) =>
    request("/places", { method: "POST", body: JSON.stringify(data) }),
  updatePlace: (id, data) =>
    request(`/places/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePlace: (id) => request(`/places/${id}`, { method: "DELETE" }),
  nearbyCheck: (lat, lng, radius) =>
    request("/places/nearby-check", {
      method: "POST",
      body: JSON.stringify({ lat, lng, radius }),
    }),
  visitsForPlace: (placeId) => request(`/visits/place/${placeId}`),
  logVisit: (placeId, note) =>
    request("/visits", {
      method: "POST",
      body: JSON.stringify({ place_id: placeId, note }),
    }),
  extract: (url) =>
    request("/extract", { method: "POST", body: JSON.stringify({ url }) }),
  summarize: (url) =>
    request("/extract/summarize", { method: "POST", body: JSON.stringify({ url }) }),

  // Walks — tracked outings. Start a walk, append GPS breadcrumbs, end it.
  // The server auto-marks places visited when the user passes within radius.
  startWalk: (data = {}) =>
    request("/walks", { method: "POST", body: JSON.stringify(data) }),
  endWalk: (id) => request(`/walks/${id}/end`, { method: "POST" }),
  appendWalkPoint: (id, point) =>
    request(`/walks/${id}/points`, {
      method: "POST",
      body: JSON.stringify(point),
    }),
  listWalks: () => request("/walks"),
  getWalk: (id) => request(`/walks/${id}`),

  smartRoute: (params) =>
    request("/places/smart-route", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  // Groups / trips / guides — multi-user collaboration via share-link.
  createGroup: (data) =>
    request("/groups", { method: "POST", body: JSON.stringify(data) }),
  getGroup: (token) => request(`/groups/${token}`),
  joinGroup: (token, name) =>
    request(`/groups/${token}/join`, { method: "POST", body: JSON.stringify({ name }) }),
  createTrip: (data) =>
    request("/trips", { method: "POST", body: JSON.stringify(data) }),
  getTrip: (id) => request(`/trips/${id}`),
  deleteTrip: (id) => request(`/trips/${id}`, { method: "DELETE" }),
  addGuide: (tripId, data) =>
    request(`/trips/${tripId}/guides`, { method: "POST", body: JSON.stringify(data) }),
  deleteGuide: (guideId) =>
    request(`/trips/guides/${guideId}`, { method: "DELETE" }),

  heatmapPoints: () => request("/walks/heatmap"),
};
