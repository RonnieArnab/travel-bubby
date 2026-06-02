import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Allow any host header so cloudflared / ngrok / LAN IPs all work without
    // having to edit this file every time the tunnel URL changes.
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
});
