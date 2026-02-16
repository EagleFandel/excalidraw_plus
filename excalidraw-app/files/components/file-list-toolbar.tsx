import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { FileListSort } from "../files-jotai";

export const FileListToolbar = ({
  query,
  onQueryChange,
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesOnlyChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: FileListSort;
  onSortChange: (value: FileListSort) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
}) => {
  const { t } = useI18n();

  return (
    <div
      className="app-sidebar-toolbar"
      aria-label={t("excPlus.files.toolbar")}
    >
      <TextField
        label={t("excPlus.files.search")}
        value={query}
        onChange={onQueryChange}
        placeholder={t("excPlus.files.searchPlaceholder")}
        fullWidth
      />

      <div className="app-sidebar-toolbar-row">
        <label htmlFor="file-sort-select" className="app-sidebar-toolbar-label">
          {t("excPlus.files.sortBy")}
        </label>
        <select
          id="file-sort-select"
          className="app-sidebar-toolbar-select"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as FileListSort)}
        >
          <option value="recent">{t("excPlus.files.sortRecent")}</option>
          <option value="updated">{t("excPlus.files.sortUpdated")}</option>
          <option value="name">{t("excPlus.files.sortName")}</option>
        </select>
      </div>

      <label
        className="app-sidebar-toolbar-checkbox"
        htmlFor="favorites-only-checkbox"
      >
        <input
          id="favorites-only-checkbox"
          type="checkbox"
          checked={favoritesOnly}
          onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
        />
        <span>{t("excPlus.files.favoritesOnly")}</span>
      </label>
    </div>
  );
};
