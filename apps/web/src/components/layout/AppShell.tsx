import type { PropsWithChildren } from "react";
import { BottomTabs } from "./BottomTabs";
import { debugBadge } from "../../dev/uiDebug";

export function AppShell({ children, householdName, role }: PropsWithChildren<{ householdName?: string; role?: string | null }>): JSX.Element {
  return (
    <div className="app" data-ui="layout-app-shell">
      {debugBadge("AppShell", "src/components/layout/AppShell.tsx")}
      <header className="header" data-ui="layout-app-shell-header">
        <p className="kicker">{role ?? "Household"}</p>
        <h1 className="header-title">{householdName ?? "Cuvver"}</h1>
        <p className="header-subtitle">You&apos;re covered.</p>
      </header>
      <main className="page stack" data-ui="layout-app-shell-main">{children}</main>
      <BottomTabs />
    </div>
  );
}
