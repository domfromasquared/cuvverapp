import { NavLink } from "react-router-dom";
import { debugBadge } from "../../dev/uiDebug";

const tabs = [
  { to: "/app/schedule", label: "Schedule" },
  { to: "/app/feed", label: "Feed" },
  { to: "/app/pto", label: "PTO" },
  { to: "/app/settings", label: "Settings" }
];

export function BottomTabs(): JSX.Element {
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
