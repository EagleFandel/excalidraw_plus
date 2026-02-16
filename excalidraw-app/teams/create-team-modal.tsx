import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

export const CreateTeamModal = ({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      title={t("excPlus.teams.create.title")}
      size="small"
      onCloseRequest={onClose}
    >
      <div className="CreateTeamModal">
        <TextField
          label={t("excPlus.teams.create.name")}
          value={name}
          onChange={setName}
          placeholder={t("excPlus.teams.create.namePlaceholder")}
          fullWidth
        />
        {!!errorMessage && (
          <div className="CreateTeamModal__error">{errorMessage}</div>
        )}
        <FilledButton
          size="large"
          fullWidth
          label={
            isSubmitting
              ? t("excPlus.teams.create.creating")
              : t("excPlus.teams.create.confirm")
          }
          onClick={async () => {
            const nextName = name.trim();
            if (!nextName) {
              setErrorMessage(t("excPlus.teams.create.nameRequired"));
              return;
            }

            setIsSubmitting(true);
            setErrorMessage("");
            try {
              await onCreate(nextName);
              setName("");
            } catch {
              setErrorMessage(t("excPlus.teams.create.failed"));
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      </div>
    </Dialog>
  );
};
