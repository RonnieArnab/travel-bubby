import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./styles/theme.css";
import { registerServiceWorker } from "./lib/registerSW.js";
import { watchAutoDrain } from "./lib/offlineQueue.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
watchAutoDrain((r) => {
  if (r.drained) {
    console.log(`[travel-buddy] synced ${r.drained} queued point(s); ${r.remaining} remaining`);
  }
});
