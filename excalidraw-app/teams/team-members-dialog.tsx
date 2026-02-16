import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

import "./team-members-dialog.scss";

import type { TeamMemberRecord, TeamRole } from "./teams-api";

export const TeamMembersDialog = ({
  isOpen,
  teamName,
  members,
  isLoading,
  errorMessage,
  currentUserId,
  canManageMembers,
  onClose,
  onRefresh,
  onAddMember,
  onUpdateMemberRole,
  onRemoveMember,
}: {
  isOpen: boolean;
  teamName: string;
  members: TeamMemberRecord[];
  isLoading: boolean;
  errorMessage: string;
  currentUserId: string | null;
  canManageMembers: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onAddMember: (input: { email: string; role: TeamRole }) => Promise<void>;
  onUpdateMemberRole: (input: {
    userId: string;
    role: TeamRole;
  }) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}) => {
  const { t } = useI18n();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const ownerCount = members.filter((member) => member.role === "owner").length;

  return (
    <Dialog
      title={
        teamName
          ? t("excPlus.teams.membersDialog.title", { name: teamName })
          : t("excPlus.teams.membersDialog.titleFallback")
      }
      className="TeamMembersDialogDrawer"
      size="small"
      onCloseRequest={onClose}
    >
      <div
        className="TeamMembersDialog"
        role="region"
        aria-label={t("excPlus.teams.membersDialog.regionAria")}
      >
        <div className="TeamMembersDialog__headerActions">
          <FilledButton
            size="medium"
            label={
              isLoading
                ? t("excPlus.teams.membersDialog.loading")
                : t("excPlus.teams.membersDialog.refresh")
            }
            onClick={onRefresh}
            disabled={isLoading}
          />
        </div>

        {canManageMembers ? (
          <div className="TeamMembersDialog__invite">
            <TextField
              label={t("excPlus.teams.membersDialog.inviteEmail")}
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder={t(
                "excPlus.teams.membersDialog.inviteEmailPlaceholder",
              )}
              fullWidth
            />

            <label
              className="TeamMembersDialog__fieldLabel"
              htmlFor="invite-role"
            >
              {t("excPlus.teams.membersDialog.role")}
            </label>
            <select
              id="invite-role"
              className="TeamMembersDialog__roleSelect"
              value={inviteRole}
              aria-label={t("excPlus.teams.membersDialog.roleSelectAria")}
              onChange={(event) =>
                setInviteRole(event.target.value as TeamRole)
              }
            >
              <option value="owner">{t("excPlus.teams.roles.owner")}</option>
              <option value="admin">{t("excPlus.teams.roles.admin")}</option>
              <option value="member">{t("excPlus.teams.roles.member")}</option>
            </select>

            <FilledButton
              size="medium"
              fullWidth
              label={
                isSubmitting
                  ? t("excPlus.teams.membersDialog.inviting")
                  : t("excPlus.teams.membersDialog.addMember")
              }
              onClick={async () => {
                const email = inviteEmail.trim();
                if (!email) {
                  return;
                }

                setIsSubmitting(true);
                try {
                  await onAddMember({
                    email,
                    role: inviteRole,
                  });
                  setInviteEmail("");
                  setInviteRole("member");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <div className="TeamMembersDialog__hint">
            {t("excPlus.teams.membersDialog.readOnlyHint")}
          </div>
        )}

        {errorMessage && (
          <div className="TeamMembersDialog__error">{errorMessage}</div>
        )}

        <div className="TeamMembersDialog__list">
          {members.map((member) => {
            const isSelf = currentUserId === member.userId;
            const isSoleOwner = member.role === "owner" && ownerCount <= 1;
            const canRemove = !isSoleOwner && !isSelf;

            return (
              <div key={member.userId} className="TeamMembersDialog__row">
                <div className="TeamMembersDialog__identity">
                  <div className="TeamMembersDialog__name">
                    {member.user.displayName || member.user.email}
                    {isSelf ? ` (${t("excPlus.teams.membersDialog.you")})` : ""}
                  </div>
                  <div className="TeamMembersDialog__email">
                    {member.user.email}
                  </div>
                </div>

                <select
                  className="TeamMembersDialog__roleSelect"
                  value={member.role}
                  aria-label={t("excPlus.teams.membersDialog.memberRoleAria", {
                    email: member.user.email,
                  })}
                  disabled={!canManageMembers}
                  onChange={async (event) => {
                    if (!canManageMembers) {
                      return;
                    }

                    const role = event.target.value as TeamRole;

                    if (isSoleOwner && role !== "owner") {
                      return;
                    }

                    await onUpdateMemberRole({
                      userId: member.userId,
                      role,
                    });
                  }}
                >
                  <option value="owner">
                    {t("excPlus.teams.roles.owner")}
                  </option>
                  <option value="admin">
                    {t("excPlus.teams.roles.admin")}
                  </option>
                  <option value="member">
                    {t("excPlus.teams.roles.member")}
                  </option>
                </select>

                <button
                  type="button"
                  className="TeamMembersDialog__remove"
                  aria-label={t("excPlus.teams.membersDialog.removeAria", {
                    email: member.user.email,
                  })}
                  onClick={async () => {
                    if (!canRemove || !canManageMembers) {
                      return;
                    }

                    const confirmed = window.confirm(
                      t("excPlus.teams.membersDialog.removeConfirm", {
                        email: member.user.email,
                      }),
                    );
                    if (!confirmed) {
                      return;
                    }

                    await onRemoveMember(member.userId);
                  }}
                  disabled={!canRemove || !canManageMembers}
                >
                  {t("excPlus.teams.membersDialog.remove")}
                </button>
              </div>
            );
          })}

          {!members.length && !isLoading && (
            <div className="TeamMembersDialog__empty">
              {t("excPlus.teams.membersDialog.empty")}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
