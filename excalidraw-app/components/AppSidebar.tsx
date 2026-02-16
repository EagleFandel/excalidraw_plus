import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import {
  TrashIcon,
  file,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import clsx from "clsx";
import { t } from "@excalidraw/excalidraw/i18n";

import { FileListItemActions } from "../files/components/file-list-item-actions";
import { FileListToolbar } from "../files/components/file-list-toolbar";

import "../files/components/files-ui.scss";

import "./AppSidebar.scss";

import type { PersonalFileMeta } from "../files/files-api";
import type { TeamRecord } from "../teams/teams-api";
import type { FilesScope } from "../teams/teams-jotai";
import type { FileListSort } from "../files/files-jotai";

export const AppSidebar = ({
  files,
  trashedFiles,
  teams,
  currentFileId,
  currentScope,
  currentTeamId,
  isLoading,
  isAuthenticated,
  syncState,
  listQuery,
  listSort,
  favoritesOnly,
  errorMessage,
  onCreateFile,
  onOpenFile,
  onRenameFile,
  onDeleteFile,
  onRestoreFile,
  onPermanentDeleteFile,
  onToggleFavorite,
  onListQueryChange,
  onListSortChange,
  onFavoritesOnlyChange,
  onScopeChange,
  onSelectTeam,
  onCreateTeam,
  onManageTeamMembers,
}: {
  files: PersonalFileMeta[];
  trashedFiles: PersonalFileMeta[];
  teams: TeamRecord[];
  currentFileId: string | null;
  currentScope: FilesScope;
  currentTeamId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  syncState: "idle" | "dirty" | "syncing" | "synced" | "conflict" | "offline";
  listQuery: string;
  listSort: FileListSort;
  favoritesOnly: boolean;
  errorMessage: string;
  onCreateFile: () => void;
  onOpenFile: (fileId: string) => void;
  onRenameFile: (fileId: string, title: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRestoreFile: (fileId: string) => void;
  onPermanentDeleteFile: (fileId: string) => void;
  onToggleFavorite: (fileId: string, isFavorite: boolean) => void;
  onListQueryChange: (query: string) => void;
  onListSortChange: (sort: FileListSort) => void;
  onFavoritesOnlyChange: (enabled: boolean) => void;
  onScopeChange: (scope: FilesScope) => void;
  onSelectTeam: (teamId: string) => void;
  onCreateTeam: () => void;
  onManageTeamMembers: () => void;
}) => {
  const { openSidebar } = useUIAppState();

  const syncLabel =
    syncState === "syncing"
      ? t("excPlus.files.syncing")
      : syncState === "synced"
      ? t("excPlus.files.synced")
      : syncState === "dirty"
      ? t("excPlus.files.dirty")
      : syncState === "conflict"
      ? t("excPlus.files.conflict")
      : syncState === "offline"
      ? t("excPlus.files.offline")
      : t("excPlus.files.idle");

  const activeTeam = teams.find((team) => team.id === currentTeamId) || null;
  const canManageMembers =
    !!activeTeam &&
    (activeTeam.role === "owner" || activeTeam.role === "admin");

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="myFiles"
          style={{ opacity: openSidebar?.tab === "myFiles" ? 1 : 0.4 }}
        >
          {file}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="myFiles">
        <div className="app-sidebar-files-container">
          <div className="app-sidebar-files-header">
            <div className="app-sidebar-files-title">
              {t("excPlus.files.myFiles")}
            </div>
            <div
              className={clsx("app-sidebar-sync-status", {
                "is-syncing": syncState === "syncing",
                "is-dirty": syncState === "dirty",
                "is-conflict": syncState === "conflict",
                "is-offline": syncState === "offline",
                "is-synced": syncState === "synced",
              })}
            >
              {syncLabel}
            </div>
          </div>

          {!isAuthenticated && (
            <div className="app-sidebar-files-empty">
              {t("excPlus.files.signInHint")}
            </div>
          )}

          {isAuthenticated && (
            <>
              <div className="app-sidebar-scope-tabs" role="tablist">
                <button
                  type="button"
                  className={clsx("app-sidebar-scope-tab", {
                    "is-active": currentScope === "personal",
                  })}
                  onClick={() => onScopeChange("personal")}
                >
                  {t("excPlus.files.personal")}
                </button>
                <button
                  type="button"
                  className={clsx("app-sidebar-scope-tab", {
                    "is-active": currentScope === "team",
                  })}
                  onClick={() => onScopeChange("team")}
                >
                  {t("excPlus.files.team")}
                </button>
                <button
                  type="button"
                  className={clsx("app-sidebar-scope-tab", {
                    "is-active": currentScope === "trash",
                  })}
                  onClick={() => onScopeChange("trash")}
                >
                  {t("excPlus.files.trash")}
                </button>
              </div>

              {currentScope !== "trash" && (
                <FileListToolbar
                  query={listQuery}
                  onQueryChange={onListQueryChange}
                  sort={listSort}
                  onSortChange={onListSortChange}
                  favoritesOnly={favoritesOnly}
                  onFavoritesOnlyChange={onFavoritesOnlyChange}
                />
              )}

              {currentScope === "team" && (
                <div className="app-sidebar-team-panel">
                  <div className="app-sidebar-team-list">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className={clsx("app-sidebar-team-item", {
                          "is-active": currentTeamId === team.id,
                        })}
                        onClick={() => onSelectTeam(team.id)}
                      >
                        <span>{usersIcon}</span>
                        <span>{team.name}</span>
                      </button>
                    ))}
                  </div>
                  <FilledButton
                    size="medium"
                    fullWidth
                    label={t("excPlus.teams.createTeam")}
                    onClick={onCreateTeam}
                  />
                  {currentTeamId && (
                    <FilledButton
                      size="medium"
                      fullWidth
                      label={t("excPlus.teams.members")}
                      disabled={!canManageMembers}
                      onClick={onManageTeamMembers}
                    />
                  )}
                </div>
              )}

              {currentScope !== "trash" && (
                <FilledButton
                  size="large"
                  fullWidth
                  label={t("excPlus.files.newFile")}
                  onClick={onCreateFile}
                />
              )}

              {isLoading && (
                <div className="app-sidebar-files-empty">
                  {t("excPlus.files.loadingFiles")}
                </div>
              )}

              {errorMessage && (
                <div className="app-sidebar-files-error">{errorMessage}</div>
              )}

              {!isLoading &&
                currentScope !== "trash" &&
                !files.length &&
                !errorMessage && (
                  <div className="app-sidebar-files-empty">
                    {t("excPlus.files.empty")}
                  </div>
                )}

              {!isLoading &&
                currentScope === "trash" &&
                !trashedFiles.length &&
                !errorMessage && (
                  <div className="app-sidebar-files-empty">
                    {t("excPlus.files.emptyTrash")}
                  </div>
                )}

              {!!files.length && currentScope !== "trash" && (
                <div className="app-sidebar-file-list">
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className={clsx("app-sidebar-file-item", {
                        "is-active": item.id === currentFileId,
                      })}
                    >
                      <button
                        type="button"
                        className="app-sidebar-file-open"
                        aria-label={t("excPlus.files.openAria", {
                          title: item.title,
                        })}
                        onClick={() => onOpenFile(item.id)}
                      >
                        <div className="app-sidebar-file-item-title">
                          {item.isFavorite
                            ? `${t("excPlus.files.favoriteTag")} `
                            : ""}
                          {item.title}
                        </div>
                        <div className="app-sidebar-file-item-meta">
                          v{item.version}
                          {" | "}
                          {new Date(item.updatedAt).toLocaleString()}
                        </div>
                      </button>
                      <FileListItemActions
                        item={item}
                        onRename={onRenameFile}
                        onToggleFavorite={onToggleFavorite}
                        onDelete={onDeleteFile}
                      />
                    </div>
                  ))}
                </div>
              )}

              {!!trashedFiles.length && currentScope === "trash" && (
                <div className="app-sidebar-file-list">
                  {trashedFiles.map((item) => (
                    <div key={item.id} className="app-sidebar-file-item">
                      <div className="app-sidebar-file-open">
                        <div className="app-sidebar-file-item-title">
                          {item.title}
                        </div>
                        <div className="app-sidebar-file-item-meta">
                          {t("excPlus.files.trashedAt", {
                            value: new Date(item.updatedAt).toLocaleString(),
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="app-sidebar-file-restore"
                        aria-label={t("excPlus.files.restoreAria", {
                          title: item.title,
                        })}
                        onClick={() => onRestoreFile(item.id)}
                      >
                        {t("excPlus.files.restore")}
                      </button>
                      <button
                        type="button"
                        className="app-sidebar-file-delete"
                        aria-label={t("excPlus.files.permanentDeleteAria", {
                          title: item.title,
                        })}
                        onClick={() => onPermanentDeleteFile(item.id)}
                      >
                        {TrashIcon}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
