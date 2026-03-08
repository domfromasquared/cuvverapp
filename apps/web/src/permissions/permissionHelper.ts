import type { AdminControls, Role } from "../types/domain";

function isAdmin(role: Role | null): boolean {
  return role === "owner" || role === "editor";
}

function toggle(controls: AdminControls | null, key: keyof AdminControls, fallback: boolean): boolean {
  if (!controls) return fallback;
  return controls[key];
}

export const PermissionHelper = {
  isOwner(role: Role | null): boolean {
    return role === "owner";
  },
  canAdminHousehold(role: Role | null): boolean {
    return isAdmin(role);
  },
  canPostCareUpdate(role: Role | null, controls: AdminControls | null): boolean {
    if (isAdmin(role)) return true;
    if (role === "caregiver") return toggle(controls, "caregivers_can_post_care_updates", true);
    return false;
  },
  canUploadAttachment(role: Role | null, controls: AdminControls | null): boolean {
    if (isAdmin(role)) return true;
    if (role === "caregiver") return toggle(controls, "caregivers_can_upload_attachments", true);
    return false;
  },
  canComment(role: Role | null, controls: AdminControls | null): boolean {
    if (isAdmin(role)) return true;
    if (role === "caregiver") return toggle(controls, "caregivers_can_comment", true);
    if (role === "viewer") return toggle(controls, "viewers_can_comment", false);
    return false;
  },
  canAcknowledge(role: Role | null, controls: AdminControls | null): boolean {
    if (isAdmin(role)) return true;
    if (role === "caregiver") return true;
    if (role === "viewer") return toggle(controls, "viewers_can_acknowledge", true);
    return false;
  },
  canManageDocuments(role: Role | null): boolean {
    return isAdmin(role);
  },
  canViewDocuments(role: Role | null): boolean {
    return role === "owner" || role === "editor" || role === "caregiver";
  },
  canApprovePto(role: Role | null): boolean {
    return isAdmin(role);
  },
  canViewPto(role: Role | null): boolean {
    return role === "owner" || role === "editor" || role === "caregiver";
  },
  canRequestPto(role: Role | null): boolean {
    return role === "owner" || role === "editor" || role === "caregiver";
  },
  canManageSchedule(role: Role | null): boolean {
    return isAdmin(role);
  },
  canViewSchedule(role: Role | null): boolean {
    return role !== null;
  },
  canEditShift(role: Role | null): boolean {
    return isAdmin(role);
  },
  canTrackTime(role: Role | null): boolean {
    return role === "caregiver";
  },
  canApproveTimeEntries(role: Role | null): boolean {
    return isAdmin(role);
  },
  canViewSettings(role: Role | null): boolean {
    return isAdmin(role) || role === "viewer" || role === "caregiver";
  },
  shouldShowSettingsTab(role: Role | null): boolean {
    return isAdmin(role);
  },
  shouldShowFeedTab(role: Role | null): boolean {
    return role !== null;
  },
  shouldShowScheduleTab(role: Role | null): boolean {
    return role !== null;
  },
  shouldShowPtoTab(role: Role | null): boolean {
    return this.canViewPto(role);
  },
  canOpenDm(role: Role | null, controls: AdminControls | null): boolean {
    if (!toggle(controls, "dms_enabled", false)) return false;
    return role === "owner" || role === "editor" || role === "caregiver";
  }
};
