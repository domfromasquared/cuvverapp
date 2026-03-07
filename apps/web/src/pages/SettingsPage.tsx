import { useEffect, useState } from "react";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { DocumentsList } from "../components/documents/DocumentsList";
import { UploadDocumentForm } from "../components/documents/UploadDocumentForm";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { listDocuments, uploadDocument, removeDocument, getDocumentSignedUrl } from "../services/documentsApi";
import { changeRole, getHouseholdMembers, inviteMember, updateHousehold } from "../services/householdApi";
import type { DocumentRecord, HouseholdMember, Role } from "../types/domain";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function SettingsPage(): JSX.Element {
  const { household, profile, role, setHousehold, setMembers, members } = useAppStore();
  const { pushToast } = useUi();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [memberList, setMemberList] = useState<HouseholdMember[]>(members);

  useEffect(() => {
    if (!household) return;
    void (async () => {
      setDocuments(await listDocuments(household.id));
      const rows = await getHouseholdMembers(household.id);
      setMemberList(rows);
      setMembers(rows);
    })();
  }, [household, setMembers]);

  if (!household || !profile) return <div />;

  const canAdmin = PermissionHelper.canAdminHousehold(role);
  const canManageDocuments = PermissionHelper.canManageDocuments(role);
  const canViewDocuments = PermissionHelper.canViewDocuments(role);
  const controls = household.admin_controls;

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
        <h2 className="section-title">Household settings</h2>
        <form
          className="stack"
          data-ui="settings-household-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const householdName = (form.elements.namedItem("household_name") as HTMLInputElement).value.trim();
            const patch = {
              ...(canAdmin ? { name: householdName || household.name } : {}),
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
              pushToast("Settings saved.");
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Unable to save settings.");
            }
          }}
        >
          <div className="form-row">
            <label htmlFor="household-name">Household name</label>
            <input
              id="household-name"
              className="input"
              name="household_name"
              defaultValue={household.name}
              disabled={!canAdmin}
              required
            />
            {!canAdmin ? <p className="caption">Only owners/editors can rename the household.</p> : null}
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

          <label className="check-row"><input type="checkbox" name="notify_care" defaultChecked={household.notify_care_updates} /> Care Update notifications</label>
          <label className="check-row"><input type="checkbox" name="notify_schedule" defaultChecked={household.notify_schedule_changes} /> Schedule notifications</label>
          <label className="check-row"><input type="checkbox" name="notify_pto" defaultChecked={household.notify_pto_changes} /> PTO notifications</label>

          {canAdmin ? (
            <>
              <hr className="hr" />
              <h3 className="title-reset">Admin Controls</h3>
              <label className="check-row"><input type="checkbox" name="caregivers_can_post" defaultChecked={controls.caregivers_can_post_care_updates} /> Caregivers can post care updates</label>
              <label className="check-row"><input type="checkbox" name="caregivers_can_upload" defaultChecked={controls.caregivers_can_upload_attachments} /> Caregivers can upload attachments</label>
              <label className="check-row"><input type="checkbox" name="caregivers_can_comment" defaultChecked={controls.caregivers_can_comment} /> Caregivers can comment</label>
              <label className="check-row"><input type="checkbox" name="viewers_can_ack" defaultChecked={controls.viewers_can_acknowledge} /> Viewers can acknowledge</label>
              <label className="check-row"><input type="checkbox" name="viewers_can_comment" defaultChecked={controls.viewers_can_comment} /> Viewers can comment</label>
              <label className="check-row"><input type="checkbox" name="require_ack" defaultChecked={controls.require_ack_for_critical} /> Require acknowledgement for critical items</label>
              <label className="check-row"><input type="checkbox" name="dms_enabled" defaultChecked={controls.dms_enabled} /> Enable contextual DMs (scaffold)</label>
            </>
          ) : null}

          <Button type="submit">Save settings</Button>
        </form>
      </Card>

      <Card data-ui="settings-members-card">
        <h2 className="section-title">Members</h2>
        <div className="list" data-ui="settings-members-list">
          {memberList.map((member) => {
            const ownerGuard = role !== "owner" && member.role === "owner";
            return (
              <article className="list-item" key={member.user_id} data-ui="settings-member-item">
                <p className="text-reset">{member.display_name ?? member.email ?? member.user_id}</p>
                <p className="caption">{member.email ?? member.user_id}</p>
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
                  <p className="caption">Role: {member.role}</p>
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
                pushToast(`Invite created: ${result.invite_link}`);
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
            <Button type="submit" variant="secondary">Create invite</Button>
          </form>
        ) : null}
      </Card>

      <Card data-ui="settings-documents-card">
        <h2 className="section-title">Documents Vault</h2>
        <p className="caption">Retention policy applies (cleanup job TODO).</p>
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

    </div>
  );
}
