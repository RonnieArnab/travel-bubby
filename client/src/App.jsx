import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { MapPage } from "./pages/MapPage.jsx";
import { PlacesPage } from "./pages/PlacesPage.jsx";
import { AddPlacePage } from "./pages/AddPlacePage.jsx";
import { ImportLinkPage } from "./pages/ImportLinkPage.jsx";
import { WalkReplayPage } from "./pages/WalkReplayPage.jsx";
import { GroupsPage } from "./pages/GroupsPage.jsx";
import { GroupDetailPage } from "./pages/GroupDetailPage.jsx";
import { TripDetailPage } from "./pages/TripDetailPage.jsx";

// Landing is full-bleed and ships its own footer — render outside the chrome shell.
function ShellOrLanding() {
  const { pathname } = useLocation();
  if (pathname === "/") {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:token" element={<GroupDetailPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/add" element={<AddPlacePage />} />
          <Route path="/import" element={<ImportLinkPage />} />
          <Route path="/walks/:id/replay" element={<WalkReplayPage />} />

          {/* Backward-compat: old dedicated map pages now redirect into Map tabs */}
          <Route path="/plan" element={<Navigate to="/map?mode=plan" replace />} />
          <Route path="/walk" element={<Navigate to="/map?mode=walk" replace />} />
          <Route path="/walks" element={<Navigate to="/map?mode=history" replace />} />
          <Route path="/here" element={<Navigate to="/map?mode=near" replace />} />

          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <ShellOrLanding />;
}
