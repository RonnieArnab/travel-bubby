import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav.jsx";
const LandingPage = lazy(() =>
  import("./pages/LandingPage.jsx").then((module) => ({
    default: module.LandingPage,
  })),
);
const MapPage = lazy(() =>
  import("./pages/MapPage.jsx").then((module) => ({ default: module.MapPage })),
);
const PlacesPage = lazy(() =>
  import("./pages/PlacesPage.jsx").then((module) => ({
    default: module.PlacesPage,
  })),
);
const AddPlacePage = lazy(() =>
  import("./pages/AddPlacePage.jsx").then((module) => ({
    default: module.AddPlacePage,
  })),
);
const ImportLinkPage = lazy(() =>
  import("./pages/ImportLinkPage.jsx").then((module) => ({
    default: module.ImportLinkPage,
  })),
);
const WalkReplayPage = lazy(() =>
  import("./pages/WalkReplayPage.jsx").then((module) => ({
    default: module.WalkReplayPage,
  })),
);
const GroupsPage = lazy(() =>
  import("./pages/GroupsPage.jsx").then((module) => ({
    default: module.GroupsPage,
  })),
);
const GroupDetailPage = lazy(() =>
  import("./pages/GroupDetailPage.jsx").then((module) => ({
    default: module.GroupDetailPage,
  })),
);
const TripDetailPage = lazy(() =>
  import("./pages/TripDetailPage.jsx").then((module) => ({
    default: module.TripDetailPage,
  })),
);

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
          <Route
            path="/plan"
            element={<Navigate to="/map?mode=plan" replace />}
          />
          <Route
            path="/walk"
            element={<Navigate to="/map?mode=walk" replace />}
          />
          <Route
            path="/walks"
            element={<Navigate to="/map?mode=history" replace />}
          />
          <Route
            path="/here"
            element={<Navigate to="/map?mode=near" replace />}
          />

          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="page-loading" role="status">
          <span className="loading-compass">✳</span> Finding your next
          adventure…
        </div>
      }
    >
      <ShellOrLanding />
    </Suspense>
  );
}
