import { createHashRouter, Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../state/appStore";
import { AppShell } from "../components/layout/AppShell";
import { BootstrapPage } from "../pages/BootstrapPage";
import { AuthPage } from "../pages/AuthPage";
import { SchedulePage } from "../pages/SchedulePage";
import { FeedPage } from "../pages/FeedPage";
import { PtoPage } from "../pages/PtoPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ShiftDetailPage } from "../pages/ShiftDetailPage";
import { PtoDetailPage } from "../pages/PtoDetailPage";
import { FeedDetailPanel } from "../pages/FeedDetailPanel";
import { DmPanel } from "../pages/DmPanel";

function AppLayout(): JSX.Element {
  const { household, role } = useAppStore();

  if (!household) {
    return <Navigate to="/bootstrap" replace />;
  }

  return (
    <AppShell householdName={household.name} role={role}>
      <Outlet />
    </AppShell>
  );
}

export const router = createHashRouter([
  { path: "/", element: <Navigate to="/bootstrap" replace /> },
  { path: "/bootstrap", element: <BootstrapPage /> },
  { path: "/auth", element: <AuthPage /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { path: "schedule", element: <SchedulePage /> },
      { path: "shift/:shiftId", element: <ShiftDetailPage /> },
      { path: "feed", element: <FeedPage /> },
      { path: "feed/:feedItemId", element: <FeedDetailPanel /> },
      { path: "pto", element: <PtoPage /> },
      { path: "pto/:ptoId", element: <PtoDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "dm", element: <DmPanel /> }
    ]
  },
  { path: "*", element: <Navigate to="/bootstrap" replace /> }
]);
