import { Routes, Route, Navigate } from "react-router-dom";
import { Nav } from "./components/Nav.jsx";
import { MapPage } from "./pages/MapPage.jsx";
import { PlacesPage } from "./pages/PlacesPage.jsx";
import { AddPlacePage } from "./pages/AddPlacePage.jsx";
import { ImportLinkPage } from "./pages/ImportLinkPage.jsx";
import { HereCheckPage } from "./pages/HereCheckPage.jsx";
import { WalkPage } from "./pages/WalkPage.jsx";
import { WalksPage } from "./pages/WalksPage.jsx";
import { WalkReplayPage } from "./pages/WalkReplayPage.jsx";
import { PlanPage } from "./pages/PlanPage.jsx";
import { GroupsPage } from "./pages/GroupsPage.jsx";
import { GroupDetailPage } from "./pages/GroupDetailPage.jsx";
import { TripDetailPage } from "./pages/TripDetailPage.jsx";

export default function App() {
  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/walk" element={<WalkPage />} />
          <Route path="/walks" element={<WalksPage />} />
          <Route path="/walks/:id/replay" element={<WalkReplayPage />} />
          <Route path="/here" element={<HereCheckPage />} />
          <Route path="/add" element={<AddPlacePage />} />
          <Route path="/import" element={<ImportLinkPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:token" element={<GroupDetailPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
