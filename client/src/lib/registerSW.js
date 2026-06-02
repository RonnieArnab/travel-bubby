// Register the service worker for offline tile / shell caching. We register
// in production builds only; the dev server's HMR doesn't play well with SW
// caching the JS bundle.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed", err));
  });
}
