import type { PropsWithChildren } from "react";
import { BottomTabs } from "./BottomTabs";
import { Button } from "../common/Button";
import { signOut } from "../../auth/authService";
import { debugBadge } from "../../dev/uiDebug";

function roleLabel(role: string | null | undefined): string {
  if (!role) return "Household";
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  if (role === "caregiver") return "Caregiver";
  if (role === "viewer") return "Viewer";
  return "Household";
}

export function AppShell({ children, householdName, role }: PropsWithChildren<{ householdName?: string; role?: string | null }>): JSX.Element {
  return (
    <div className="app" data-ui="layout-app-shell">
      {debugBadge("AppShell", "src/components/layout/AppShell.tsx")}
      <header className="header" data-ui="layout-app-shell-header">
        <div className="header-row">
          <div className="header-copy">
            <p className="kicker">{roleLabel(role)}</p>
            <h1 className="header-title">{householdName ?? "Cuvver"}</h1>
            <p className="header-subtitle">You&apos;re covered.</p>
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await signOut();
              } finally {
                window.location.hash = "#/auth";
              }
            }}
          >
            Logout
          </Button>
        </div>
      </header>
      <main className="page stack" data-ui="layout-app-shell-main">{children}</main>
      <BottomTabs />
    </div>
  );
}
