import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

import type { TeamRecord } from "../../teams/teams-api";

type FileOwnership = "personal" | "team";

export const CreateFileModal = ({
  isOpen,
  teams,
  defaultScope,
  defaultTeamId,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  teams: TeamRecord[];
  defaultScope: FileOwnership;
  defaultTeamId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    scope: FileOwnership;
    teamId: string | null;
  }) => Promise<void>;
}) => {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<FileOwnership>(defaultScope);
  const [teamId, setTeamId] = useState<string | null>(defaultTeamId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) {
    return null;
  }

  const hasTeams = teams.length > 0;

  return (
    <Dialog
      title={t("excPlus.files.create.title")}
      size="small"
      onCloseRequest={onClose}
    >
      <div className="CreateFileModal">
        <TextField
          label={t("excPlus.files.create.fileName")}
          value={title}
          onChange={setTitle}
          placeholder={t("excPlus.files.create.fileNamePlaceholder")}
          fullWidth
        />

        <div className="CreateFileModal__scope">
          <label
            className="CreateFileModal__fieldLabel"
            htmlFor="create-file-scope"
          >
            {t("excPlus.files.create.scope")}
          </label>
          <select
            id="create-file-scope"
            className="CreateFileModal__select"
            value={scope}
            onChange={(event) => {
              const nextScope = event.target.value as FileOwnership;
              setScope(nextScope);
              if (nextScope === "team" && !teamId) {
                setTeamId(teams[0]?.id || null);
              }
            }}
          >
            <option value="personal">{t("excPlus.files.personal")}</option>
            <option value="team" disabled={!hasTeams}>
              {t("excPlus.files.team")}
            </option>
          </select>
        </div>

        {scope === "team" && (
          <div className="CreateFileModal__scope">
            <label
              className="CreateFileModal__fieldLabel"
              htmlFor="create-file-team"
            >
              {t("excPlus.teams.currentTeam")}
            </label>
            <select
              id="create-file-team"
              className="CreateFileModal__select"
              value={teamId || ""}
              onChange={(event) => setTeamId(event.target.value || null)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!!errorMessage && (
          <div className="CreateFileModal__error">{errorMessage}</div>
        )}

        <FilledButton
          size="large"
          fullWidth
          label={
            isSubmitting
              ? t("excPlus.files.create.creating")
              : t("excPlus.files.create.confirm")
          }
          onClick={async () => {
            const nextTitle = title.trim() || t("labels.untitled");

            if (scope === "team" && !teamId) {
              setErrorMessage(t("excPlus.files.create.teamRequired"));
              return;
            }

            setIsSubmitting(true);
            setErrorMessage("");
            try {
              await onSubmit({
                title: nextTitle,
                scope,
                teamId: scope === "team" ? teamId : null,
              });
              setTitle("");
              setScope(defaultScope);
              setTeamId(defaultTeamId);
            } catch {
              setErrorMessage(t("excPlus.files.create.failed"));
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={isSubmitting}
        />
      </div>
    </Dialog>
  );
};
