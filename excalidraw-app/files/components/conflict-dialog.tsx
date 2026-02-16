import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { ConflictContext } from "../files-jotai";

export const ConflictDialog = ({
  context,
  onClose,
  onOverwrite,
  onSaveAsCopy,
}: {
  context: ConflictContext | null;
  onClose: () => void;
  onOverwrite: () => Promise<void>;
  onSaveAsCopy: () => Promise<void>;
}) => {
  const { t } = useI18n();

  if (!context) {
    return null;
  }

  return (
    <Dialog
      title={t("excPlus.files.conflict.title")}
      size="small"
      onCloseRequest={onClose}
    >
      <div className="ConflictDialog">
        <div className="ConflictDialog__text">
          {t("excPlus.files.conflict.description", {
            title: context.title,
          })}
        </div>
        <div className="ConflictDialog__meta">
          {t("excPlus.files.conflict.localVersion", {
            version: context.localSceneVersion,
          })}
          <br />
          {t("excPlus.files.conflict.serverVersion", {
            version: context.serverVersion,
          })}
        </div>
        <div className="ConflictDialog__actions">
          <FilledButton
            size="medium"
            fullWidth
            label={t("excPlus.files.conflict.saveAsCopy")}
            onClick={onSaveAsCopy}
          />
          <FilledButton
            size="medium"
            fullWidth
            label={t("excPlus.files.conflict.overwrite")}
            onClick={onOverwrite}
          />
          <button
            type="button"
            className="ConflictDialog__cancel"
            onClick={onClose}
          >
            {t("buttons.cancel")}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
