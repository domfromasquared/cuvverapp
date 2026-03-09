import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { DocumentsList } from "../components/documents/DocumentsList";
import { UploadDocumentForm } from "../components/documents/UploadDocumentForm";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { listDocuments, uploadDocument, removeDocument, getDocumentSignedUrl } from "../services/documentsApi";
import { changeRole, getHouseholdMembers, inviteMember, updateHousehold } from "../services/householdApi";
import { signOut } from "../auth/authService";
import type { DocumentRecord, HouseholdMember, Role } from "../types/domain";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";
import { removeMyAvatar, uploadMyAvatar, validateAvatarFile } from "../services/profileApi";
import { useAvatarUrls } from "../hooks/useAvatarUrls";

export function SettingsPage(): JSX.Element {
  const { household, profile, role, setHousehold, setMembers, setProfile, members } = useAppStore();
  const { pushToast } = useUi();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [memberList, setMemberList] = useState<HouseholdMember[]>(members);
  const [latestInvite, setLatestInvite] = useState<{ email: string; role: Role; link: string } | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!household) return;
    void (async () => {
      if (PermissionHelper.canViewDocuments(role)) {
        setDocuments(await listDocuments(household.id));
      } else {
        setDocuments([]);
      }
      const rows = await getHouseholdMembers(household.id);
      setMemberList(rows);
      setMembers(rows);
    })();
  }, [household, role, setMembers]);

  if (!household || !profile) return <div />;

  const canAdmin = PermissionHelper.canAdminHousehold(role);
  const canManageDocuments = PermissionHelper.canManageDocuments(role);
  const canViewDocuments = PermissionHelper.canViewDocuments(role);
  const controls = household.admin_controls;
  const avatarIdentities = useMemo(
    () => [
      ...memberList.map((member) => ({
        user_id: member.user_id,
        avatar_path: member.avatar_path ?? null,
        avatar_url: member.avatar_url ?? null
      })),
      {
        user_id: profile.id,
        avatar_path: profile.avatar_path ?? null,
        avatar_url: profile.avatar_url ?? null
      }
    ],
    [memberList, profile]
  );
  const avatarByUserId = useAvatarUrls(avatarIdentities);

  async function refreshDocuments(): Promise<void> {
    if (!household) return;
    setDocuments(await listDocuments(household.id));
  }

  async function refreshMembers(): Promise<void> {
    if (!household) return;
    const rows = await getHouseholdMembers(household.id);
    setMemberList(rows);
    setMembers(rows);
  }

  return (
    <div className="stack" data-ui="page-settings">
      {debugBadge("SettingsPage", "src/pages/SettingsPage.tsx")}

      <Card data-ui="settings-household-card">
        <h2 className="section-title">Household</h2>
        {canAdmin ? (
          <form
            className="stack"
            data-ui="settings-household-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const householdName = (form.elements.namedItem("household_name") as HTMLInputElement).value.trim();
              const patch = {
                name: householdName || household.name,
                quiet_hours_start: (form.elements.namedItem("quiet_start") as HTMLInputElement).value || null,
                quiet_hours_end: (form.elements.namedItem("quiet_end") as HTMLInputElement).value || null,
                retention_policy_days: Number((form.elements.namedItem("retention") as HTMLSelectElement).value),
                notify_care_updates: (form.elements.namedItem("notify_care") as HTMLInputElement).checked,
                notify_schedule_changes: (form.elements.namedItem("notify_schedule") as HTMLInputElement).checked,
                notify_pto_changes: (form.elements.namedItem("notify_pto") as HTMLInputElement).checked,
                admin_controls: {
                  caregivers_can_post_care_updates: (form.elements.namedItem("caregivers_can_post") as HTMLInputElement).checked,
                  caregivers_can_upload_attachments: (form.elements.namedItem("caregivers_can_upload") as HTMLInputElement).checked,
                  caregivers_can_comment: (form.elements.namedItem("caregivers_can_comment") as HTMLInputElement).checked,
                  viewers_can_acknowledge: (form.elements.namedItem("viewers_can_ack") as HTMLInputElement).checked,
                  viewers_can_comment: (form.elements.namedItem("viewers_can_comment") as HTMLInputElement).checked,
                  require_ack_for_critical: (form.elements.namedItem("require_ack") as HTMLInputElement).checked,
                  dms_enabled: (form.elements.namedItem("dms_enabled") as HTMLInputElement).checked
                }
              };

              try {
                const updated = await updateHousehold(household.id, patch);
                setHousehold(updated);
                pushToast("Household settings saved.");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to save settings.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="household-name">Household name</label>
              <input id="household-name" className="input" name="household_name" defaultValue={household.name} required />
            </div>
            <div className="grid-2">
              <div className="form-row">
                <label htmlFor="quiet-start">Quiet hours start</label>
                <input id="quiet-start" className="input" name="quiet_start" type="time" defaultValue={household.quiet_hours_start ?? ""} />
              </div>
              <div className="form-row">
                <label htmlFor="quiet-end">Quiet hours end</label>
                <input id="quiet-end" className="input" name="quiet_end" type="time" defaultValue={household.quiet_hours_end ?? ""} />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="retention-days">Retention policy</label>
              <select id="retention-days" className="select" name="retention" defaultValue={String(household.retention_policy_days)}>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>

            <label className="check-row">
              <input type="checkbox" name="notify_care" defaultChecked={household.notify_care_updates} /> Care update notifications
            </label>
            <label className="check-row">
              <input type="checkbox" name="notify_schedule" defaultChecked={household.notify_schedule_changes} /> Schedule notifications
            </label>
            <label className="check-row">
              <input type="checkbox" name="notify_pto" defaultChecked={household.notify_pto_changes} /> PTO notifications
            </label>

            <hr className="hr" />
            <h3 className="title-reset">Admin controls</h3>
            <label className="check-row">
              <input type="checkbox" name="caregivers_can_post" defaultChecked={controls.caregivers_can_post_care_updates} /> Caregivers can post updates
            </label>
            <label className="check-row">
              <input type="checkbox" name="caregivers_can_upload" defaultChecked={controls.caregivers_can_upload_attachments} /> Caregivers can upload attachments
            </label>
            <label className="check-row">
              <input type="checkbox" name="caregivers_can_comment" defaultChecked={controls.caregivers_can_comment} /> Caregivers can comment
            </label>
            <label className="check-row">
              <input type="checkbox" name="viewers_can_ack" defaultChecked={controls.viewers_can_acknowledge} /> Viewers can acknowledge
            </label>
            <label className="check-row">
              <input type="checkbox" name="viewers_can_comment" defaultChecked={controls.viewers_can_comment} /> Viewers can comment
            </label>
            <label className="check-row">
              <input type="checkbox" name="require_ack" defaultChecked={controls.require_ack_for_critical} /> Require acknowledgement for critical posts
            </label>
            <label className="check-row">
              <input type="checkbox" name="dms_enabled" defaultChecked={controls.dms_enabled} /> Enable context chat
            </label>

            <Button type="submit">Save household settings</Button>
          </form>
        ) : (
          <div className="list">
            <div className="list-item">
              <p className="caption">Household name</p>
              <p className="text-reset">{household.name}</p>
            </div>
            <div className="list-item">
              <p className="caption">Timezone</p>
              <p className="text-reset">{household.timezone}</p>
            </div>
            <div className="list-item">
              <p className="caption">Retention policy</p>
              <p className="text-reset">{household.retention_policy_days} days</p>
            </div>
            <p className="caption">Only owners and editors can modify household settings.</p>
          </div>
        )}
      </Card>

      <Card data-ui="settings-members-card">
        <h2 className="section-title">Team members</h2>
        <div className="list" data-ui="settings-members-list">
          {memberList.map((member) => {
            const ownerGuard = role !== "owner" && member.role === "owner";
            return (
              <article className="list-item" key={member.user_id} data-ui="settings-member-item">
                <div className="identity-row">
                  <Avatar
                    name={member.display_name ?? member.email ?? member.user_id}
                    email={member.email}
                    src={avatarByUserId.get(member.user_id) ?? null}
                  />
                  <div className="identity-copy">
                    <p className="text-reset">{member.display_name ?? member.email ?? member.user_id}</p>
                    <p className="caption">{member.email ?? member.user_id}</p>
                  </div>
                </div>
                {canAdmin ? (
                  <select
                    className="select"
                    defaultValue={member.role}
                    disabled={ownerGuard}
                    onChange={async (event) => {
                      const newRole = event.target.value as Role;
                      if (member.role === "owner" && role !== "owner") {
                        pushToast("Only owner can change owner role.");
                        return;
                      }
                      try {
                        await changeRole({
                          household_id: household.id,
                          target_user_id: member.user_id,
                          new_role: newRole
                        });
                        await refreshMembers();
                        pushToast("Member role updated.");
                      } catch (error) {
                        pushToast(error instanceof Error ? error.message : "Unable to update role.");
                      }
                    }}
                  >
                    <option value="owner">owner</option>
                    <option value="editor">editor</option>
                    <option value="caregiver">caregiver</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <span className="status-chip status-approved">{member.role}</span>
                )}
              </article>
            );
          })}
        </div>

        {canAdmin ? (
          <form
            className="stack"
            data-ui="settings-invite-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const email = (form.elements.namedItem("invite_email") as HTMLInputElement).value.trim().toLowerCase();
              const roleValue = (form.elements.namedItem("invite_role") as HTMLSelectElement).value as Role;
              if (!email) return;

              try {
                const result = await inviteMember({ household_id: household.id, email, role: roleValue });
                setLatestInvite({ email, role: roleValue, link: result.invite_link });
                if (result.email_sent) {
                  pushToast(`Invite emailed to ${email}.`);
                } else if (result.email_error) {
                  pushToast(`Invite link created. Email not sent: ${result.email_error}`);
                } else {
                  pushToast("Invite link created.");
                }
                form.reset();
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to invite member.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="invite-email">Invite by email</label>
              <input id="invite-email" className="input" name="invite_email" type="email" />
            </div>
            <div className="form-row">
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" className="select" name="invite_role" defaultValue="caregiver">
                <option value="editor">editor</option>
                <option value="caregiver">caregiver</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Create invite link
            </Button>
          </form>
        ) : null}

        {canAdmin && latestInvite ? (
          <div className="list-item" data-ui="settings-invite-result">
            <p className="caption">
              Invite ready for {latestInvite.email} ({latestInvite.role}). Role is assigned when this link is accepted.
            </p>
            <div className="form-row">
              <label htmlFor="invite-link-output">Invite link</label>
              <input id="invite-link-output" className="input" value={latestInvite.link} readOnly />
            </div>
            <div className="actions actions-spaced">
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(latestInvite.link);
                    pushToast("Invite link copied.");
                  } catch {
                    pushToast("Copy failed. Copy the link manually.");
                  }
                }}
              >
                Copy link
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const subject = "Join my Cuvver household";
                  const body = `You were invited as ${latestInvite.role}. Open this link to join: ${latestInvite.link}`;
                  window.location.href = `mailto:${encodeURIComponent(latestInvite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
              >
                Send email
              </Button>
            </div>
            <p className="caption">Invite links always work. Automatic delivery uses the configured edge email provider; Send email opens your mail app as fallback.</p>
          </div>
        ) : null}
      </Card>

      <Card data-ui="settings-documents-card">
        <h2 className="section-title">Documents vault</h2>
        <p className="caption">Retention policy applies.</p>
        {!canViewDocuments ? <EmptyState title="No access" body="Documents are restricted for your role." /> : null}
        {canViewDocuments ? (
          <>
            {canManageDocuments ? (
              <UploadDocumentForm
                onSubmit={async (file, title, category) => {
                  try {
                    await uploadDocument(file, household.id, profile.id, title, category);
                    await refreshDocuments();
                    pushToast("Document uploaded.");
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : "Unable to upload document.");
                  }
                }}
              />
            ) : null}
            <DocumentsList
              documents={documents}
              canDelete={canManageDocuments}
              onDelete={async (doc) => {
                try {
                  await removeDocument(doc.id);
                  await refreshDocuments();
                  pushToast("Document deleted.");
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to delete document.");
                }
              }}
              onOpen={async (doc) => {
                try {
                  const url = await getDocumentSignedUrl(doc.storage_path);
                  window.open(url, "_blank", "noreferrer");
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to open document.");
                }
              }}
            />
          </>
        ) : null}
      </Card>

      <Card data-ui="settings-account-card">
        <h2 className="section-title">Account</h2>
        <div className="list-item">
          <p className="caption">Profile photo</p>
          <div className="actions actions-spaced">
            <Avatar
              name={profile.display_name || "Member"}
              email={profile.email}
              src={avatarByUserId.get(profile.id) ?? null}
            />
            <input
              ref={avatarInputRef}
              id="profile-avatar-file"
              className="input sr-only"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file || !household) return;

                setAvatarError(null);
                try {
                  validateAvatarFile(file);
                } catch (error) {
                  setAvatarError(error instanceof Error ? error.message : "Invalid profile photo.");
                  return;
                }

                setAvatarBusy(true);
                try {
                  const updated = await uploadMyAvatar(file, household.id, profile.id);
                  setProfile(updated);
                  await refreshMembers();
                  pushToast("Profile photo updated.");
                } catch (error) {
                  setAvatarError(error instanceof Error ? error.message : "Unable to upload profile photo.");
                } finally {
                  setAvatarBusy(false);
                }
              }}
            />
            <Button variant="secondary" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
              Upload photo
            </Button>
            <Button
              variant="ghost"
              disabled={avatarBusy || !profile.avatar_path}
              onClick={async () => {
                if (!household) return;
                setAvatarError(null);
                setAvatarBusy(true);
                try {
                  const updated = await removeMyAvatar(household.id, profile.id, profile.avatar_path);
                  setProfile(updated);
                  await refreshMembers();
                  pushToast("Profile photo removed.");
                } catch (error) {
                  setAvatarError(error instanceof Error ? error.message : "Unable to remove profile photo.");
                } finally {
                  setAvatarBusy(false);
                }
              }}
            >
              Remove photo
            </Button>
          </div>
          {avatarError ? <p className="caption error-text">{avatarError}</p> : null}
        </div>
        <div className="list">
          <div className="list-item">
            <p className="caption">Name</p>
            <p className="text-reset">{profile.display_name || "Member"}</p>
          </div>
          <div className="list-item">
            <p className="caption">Email</p>
            <p className="text-reset">{profile.email}</p>
          </div>
          <div className="list-item">
            <p className="caption">Role</p>
            <p className="text-reset">{role || "member"}</p>
          </div>
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
          Log out
        </Button>
      </Card>
    </div>
  );
}
