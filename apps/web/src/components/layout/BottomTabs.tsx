import { NavLink } from "react-router-dom";
import { useAppStore } from "../../state/appStore";
import { PermissionHelper } from "../../permissions/permissionHelper";
import { debugBadge } from "../../dev/uiDebug";

export function BottomTabs(): JSX.Element {
  const { role } = useAppStore();
  const canShowPto = PermissionHelper.shouldShowPtoTab(role);
  const canShowSettings = PermissionHelper.shouldShowSettingsTab(role);

  const tabs =
    role === "viewer"
      ? [
          { to: "/app/home", label: "Home" },
          { to: "/app/feed", label: "Updates" },
          { to: "/app/schedule", label: "Schedule" }
        ]
      : role === "caregiver"
        ? [
            { to: "/app/home", label: "Home" },
            { to: "/app/schedule", label: "Schedule" },
            { to: "/app/feed", label: "Feed" },
            { to: "/app/pto", label: "PTO" }
          ]
        : [
            { to: "/app/home", label: "Home" },
            { to: "/app/schedule", label: "Schedule" },
            { to: "/app/feed", label: "Feed" },
            ...(canShowPto ? [{ to: "/app/pto", label: "PTO" }] : []),
            ...(canShowSettings ? [{ to: "/app/settings", label: "Settings" }] : [])
          ];

  return (
    <nav className="tabs" aria-label="Primary navigation" data-ui="layout-bottom-tabs">
      {debugBadge("BottomTabs", "src/components/layout/BottomTabs.tsx")}
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`.trim()}
          data-ui={`tab-${tab.label.toLowerCase()}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
