import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdminControls, Household, HouseholdMember, NotificationItem, Role, UserProfile } from "../types/domain";

export interface AppState {
  profile: UserProfile | null;
  household: Household | null;
  role: Role | null;
  members: HouseholdMember[];
  notifications: NotificationItem[];
  setProfile: (profile: UserProfile | null) => void;
  setHousehold: (household: Household | null) => void;
  setRole: (role: Role | null) => void;
  setMembers: (members: HouseholdMember[]) => void;
  setNotifications: (notifications: NotificationItem[]) => void;
  patchAdminControls: (next: Partial<AdminControls>) => void;
}

const AppStoreContext = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const value = useMemo<AppState>(
    () => ({
      profile,
      household,
      role,
      members,
      notifications,
      setProfile,
      setHousehold,
      setRole,
      setMembers,
      setNotifications,
      patchAdminControls(next) {
        setHousehold((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            admin_controls: {
              ...prev.admin_controls,
              ...next
            }
          };
        });
      }
    }),
    [profile, household, role, members, notifications]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppState {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  return context;
}
