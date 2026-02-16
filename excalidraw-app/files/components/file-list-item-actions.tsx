import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { PersonalFileMeta } from "../files-api";

export const FileListItemActions = ({
  item,
  onRename,
  onToggleFavorite,
  onDelete,
}: {
  item: PersonalFileMeta;
  onRename: (fileId: string, title: string) => void;
  onToggleFavorite: (fileId: string, isFavorite: boolean) => void;
  onDelete: (fileId: string) => void;
}) => {
  const { t } = useI18n();

  return (
    <div
      className="app-sidebar-file-actions"
      role="group"
      aria-label={t("excPlus.files.itemActions")}
    >
      <button
        type="button"
        className="app-sidebar-file-action"
        aria-label={t("excPlus.files.renameAria", { title: item.title })}
        onClick={() => {
          const nextTitle = window
            .prompt(t("excPlus.files.renamePrompt"), item.title)
            ?.trim();

          if (!nextTitle || nextTitle === item.title) {
            return;
          }

          onRename(item.id, nextTitle);
        }}
      >
        {t("excPlus.files.rename")}
      </button>
      <button
        type="button"
        className="app-sidebar-file-action"
        aria-label={
          item.isFavorite
            ? t("excPlus.files.unfavoriteAria", { title: item.title })
            : t("excPlus.files.favoriteAria", { title: item.title })
        }
        onClick={() => onToggleFavorite(item.id, !item.isFavorite)}
      >
        {item.isFavorite
          ? t("excPlus.files.unfavorite")
          : t("excPlus.files.favorite")}
      </button>
      <button
        type="button"
        className="app-sidebar-file-action app-sidebar-file-action-danger"
        aria-label={t("excPlus.files.deleteAria", { title: item.title })}
        onClick={() => onDelete(item.id)}
      >
        {t("excPlus.files.delete")}
      </button>
    </div>
  );
};
