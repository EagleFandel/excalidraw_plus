import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  usersIcon,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import { authApi } from "./auth/auth-api";
import { AuthDialog, type AuthDialogMode } from "./auth/auth-dialog";
import { UserMenu } from "./auth/user-menu";
import {
  authStatusAtom,
  currentUserAtom,
  isAuthenticatedAtom,
} from "./auth/auth-jotai";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { FilesApiError, filesApi } from "./files/files-api";
import {
  applyFileSceneToExcalidraw,
  getEmptyFileScene,
  serializeSceneFromExcalidraw,
} from "./files/files-scene";
import {
  conflictContextAtom,
  currentFileIdAtom,
  fileListFavoritesOnlyAtom,
  fileListQueryAtom,
  fileListSortAtom,
  fileMetaMapAtom,
  filesListAtom,
  filesPanelErrorAtom,
  fileSyncStateAtom,
  pendingOpsAtom,
  type FileListSort,
} from "./files/files-jotai";
import { MyFilesLocalStore } from "./files/localStore";
import {
  dequeueReadyPendingOp,
  enqueuePendingOp,
  markPendingOpForRetry,
} from "./files/sync-queue";
import { ConflictDialog } from "./files/components/conflict-dialog";
import { CreateFileModal } from "./files/components/create-file-modal";
import { teamsApi } from "./teams/teams-api";
import {
  currentScopeAtom,
  currentTeamIdAtom,
  teamMembersAtom,
  teamsAtom,
  teamsPanelErrorAtom,
  type FilesScope,
} from "./teams/teams-jotai";
import { CreateTeamModal } from "./teams/create-team-modal";
import { TeamMembersDialog } from "./teams/team-members-dialog";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";

import "./index.scss";

import { ExcalidrawPlusPromoBanner } from "./components/ExcalidrawPlusPromoBanner";
import { AppSidebar } from "./components/AppSidebar";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const getFilesPanelErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof FilesApiError)) {
    return fallback;
  }

  switch (error.code) {
    case "FORBIDDEN":
      return t("excPlus.errors.forbidden");
    case "FILE_NOT_FOUND":
      return t("excPlus.errors.fileNotFound");
    case "UNAUTHORIZED":
      return t("excPlus.errors.unauthorized");
    case "VERSION_CONFLICT":
      return t("excPlus.errors.versionConflict");
    default:
      return error.message || fallback;
  }
};

const getTeamsPanelErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();
  if (message.includes("unauthorized") || message.includes("sign in")) {
    return t("excPlus.errors.unauthorized");
  }
  if (
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("no access")
  ) {
    return t("excPlus.errors.forbidden");
  }
  if (message.includes("not found")) {
    return t("excPlus.errors.notFound");
  }

  return fallback;
};

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [authStatus, setAuthStatus] = useAtom(authStatusAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [filesList, setFilesList] = useAtom(filesListAtom);
  const [currentFileId, setCurrentFileId] = useAtom(currentFileIdAtom);
  const [, setFileMetaMap] = useAtom(fileMetaMapAtom);
  const [filesPanelError, setFilesPanelError] = useAtom(filesPanelErrorAtom);
  const [fileSyncState, setFileSyncState] = useAtom(fileSyncStateAtom);
  const [pendingOps, setPendingOps] = useAtom(pendingOpsAtom);
  const [conflictContext, setConflictContext] = useAtom(conflictContextAtom);
  const [fileListQuery, setFileListQuery] = useAtom(fileListQueryAtom);
  const [fileListSort, setFileListSort] = useAtom(fileListSortAtom);
  const [fileListFavoritesOnly, setFileListFavoritesOnly] = useAtom(
    fileListFavoritesOnlyAtom,
  );
  const [teams, setTeams] = useAtom(teamsAtom);
  const [currentTeamId, setCurrentTeamId] = useAtom(currentTeamIdAtom);
  const [currentScope, setCurrentScope] = useAtom(currentScopeAtom);
  const [teamsPanelError, setTeamsPanelError] = useAtom(teamsPanelErrorAtom);
  const [teamMembersMap, setTeamMembersMap] = useAtom(teamMembersAtom);
  const [trashedFiles, setTrashedFiles] = useState<typeof filesList>([]);
  const [trashSourceScope, setTrashSourceScope] =
    useState<Exclude<FilesScope, "trash">>("personal");
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] =
    useState<AuthDialogMode>("signin");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [isTeamMembersDialogOpen, setIsTeamMembersDialogOpen] = useState(false);
  const [isTeamMembersLoading, setIsTeamMembersLoading] = useState(false);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  const currentFileIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentFileIdRef.current = currentFileId;
  }, [currentFileId]);

  const saveVersionRef = useRef<Record<string, number>>({});
  const replayingPendingOpsRef = useRef(false);
  const pendingOpsTimerRef = useRef<number | null>(null);
  const filesListRef = useRef(filesList);
  const fileMetaMapRef = useRef<Record<string, (typeof filesList)[number]>>({});
  const conflictContextRef = useRef(conflictContext);
  const fileSyncStateRef = useRef(fileSyncState);

  useEffect(() => {
    filesListRef.current = filesList;
  }, [filesList]);

  useEffect(() => {
    conflictContextRef.current = conflictContext;
  }, [conflictContext]);

  useEffect(() => {
    fileSyncStateRef.current = fileSyncState;
  }, [fileSyncState]);

  useEffect(() => {
    fileMetaMapRef.current = filesList.reduce<Record<string, (typeof filesList)[number]>>(
      (acc, file) => {
        acc[file.id] = file;
        return acc;
      },
      {},
    );
  }, [filesList]);

  const isApplyingPersonalSceneRef = useRef(false);

  const applyPersonalFileScene = useCallback(
    (scene: ReturnType<typeof getEmptyFileScene>) => {
      if (!excalidrawAPI) {
        return;
      }

      isApplyingPersonalSceneRef.current = true;
      applyFileSceneToExcalidraw(excalidrawAPI, scene);
      window.setTimeout(() => {
        isApplyingPersonalSceneRef.current = false;
      }, 0);
    },
    [excalidrawAPI],
  );

  const loadTeams = useCallback(async () => {
    if (!isAuthenticated) {
      setTeams([]);
      setCurrentTeamId(null);
      setTeamsPanelError("");
      return;
    }

    try {
      setTeamsPanelError("");
      const remoteTeams = await teamsApi.listTeams();
      setTeams(remoteTeams);
      if (!currentTeamId && remoteTeams[0]) {
        setCurrentTeamId(remoteTeams[0].id);
      }
    } catch (error) {
      setTeamsPanelError(
        getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.loadTeams")),
      );
    }
  }, [
    currentTeamId,
    isAuthenticated,
    setCurrentTeamId,
    setTeams,
    setTeamsPanelError,
  ]);

  const loadScopedFiles = useCallback(async () => {
    if (!isAuthenticated) {
      setFilesList([]);
      setTrashedFiles([]);
      setFileMetaMap({});
      setCurrentFileId(null);
      setPendingOps([]);
      setConflictContext(null);
      setFilesPanelError("");
      setFileSyncState("idle");
      saveVersionRef.current = {};
      return;
    }

    try {
      setFilesPanelError("");
      const activeDataScope =
        currentScope === "trash" ? trashSourceScope : currentScope;

      const scopeFiles =
        activeDataScope === "team" && currentTeamId
          ? await filesApi.listTeamFiles({
              teamId: currentTeamId,
              includeTrashed: true,
            })
          : await filesApi.listPersonalFiles({ includeTrashed: true });

      // Prefer the explicit isTrashed flag to avoid surfacing legacy
      // records whose trashedAt is missing but file is already trashed.
      const files = scopeFiles.filter(
        (item) => !(item.isTrashed ?? Boolean(item.trashedAt)),
      );
      const trash = scopeFiles.filter(
        (item) => item.isTrashed ?? Boolean(item.trashedAt),
      );

      setFilesList(files);
      setTrashedFiles(trash);
      setFileMetaMap(
        files.reduce<Record<string, typeof files[number]>>((acc, file) => {
          acc[file.id] = file;
          return acc;
        }, {}),
      );
      saveVersionRef.current = files.reduce<Record<string, number>>(
        (acc, file) => {
          acc[file.id] = file.version;
          return acc;
        },
        {},
      );
    } catch (error) {
      setFilesPanelError(
        getFilesPanelErrorMessage(error, t("excPlus.files.errors.loadFiles")),
      );
    }
  }, [
    currentScope,
    currentTeamId,
    isAuthenticated,
    setCurrentFileId,
    setPendingOps,
    setConflictContext,
    setFileMetaMap,
    setFileSyncState,
    setFilesList,
    setFilesPanelError,
    setTrashedFiles,
    trashSourceScope,
  ]);

  const openFile = useCallback(
    async (fileId: string) => {
      if (!excalidrawAPI) {
        return;
      }

      setFilesPanelError("");
      setCurrentFileId(fileId);

      const local = await MyFilesLocalStore.getLocalFile(fileId);
      if (local) {
        applyPersonalFileScene(local.scene);
        saveVersionRef.current[fileId] = local.version;
        setFileSyncState(local.dirty ? "dirty" : "synced");
      } else {
        setFileSyncState("idle");
      }

      try {
        const remote = await filesApi.getFile(fileId);
        saveVersionRef.current[fileId] = remote.version;

        await MyFilesLocalStore.setLocalFile({
          fileId,
          version: remote.version,
          scene: remote.scene,
          dirty: false,
          updatedAt: Date.now(),
        });

        if (!local || remote.version > local.version) {
          applyPersonalFileScene(remote.scene);
        }

        setFilesList((prev) =>
          prev
            .map((file) => (file.id === remote.id ? remote : file))
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            ),
        );
        setFileMetaMap((prev) => ({
          ...prev,
          [remote.id]: remote,
        }));
        setFileSyncState("synced");
      } catch (error) {
        if (error instanceof FilesApiError && error.code === "FILE_NOT_FOUND") {
          await MyFilesLocalStore.deleteLocalFile(fileId);
          delete saveVersionRef.current[fileId];

          setPendingOps((prev) =>
            prev.filter((op) => !(op.type === "save" && op.fileId === fileId)),
          );
          setConflictContext((prev) => (prev?.fileId === fileId ? null : prev));
          setFilesList((prev) => prev.filter((file) => file.id !== fileId));
          setFileMetaMap((prev) => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });

          if (currentFileIdRef.current === fileId) {
            setCurrentFileId(null);
            applyPersonalFileScene(getEmptyFileScene());
            setFileSyncState("idle");
          }

          setFilesPanelError(t("excPlus.errors.fileNotFound"));
          return;
        }

        if (!local) {
          setFilesPanelError(
            getFilesPanelErrorMessage(error, t("excPlus.files.errors.openFile")),
          );
        }
      }
    },
    [
      applyPersonalFileScene,
      excalidrawAPI,
      setCurrentFileId,
      setPendingOps,
      setConflictContext,
      setFileMetaMap,
      setFileSyncState,
      setFilesList,
      setFilesPanelError,
    ],
  );

  const createFile = useCallback(
    async (input?: {
      title?: string;
      scope?: "personal" | "team";
      teamId?: string | null;
      scene?: ReturnType<typeof serializeSceneFromExcalidraw>;
    }) => {
      if (!isAuthenticated || !excalidrawAPI) {
        return;
      }

      setFilesPanelError("");
      try {
        const scene = input?.scene || getEmptyFileScene();
        const scope = input?.scope || (currentScope === "team" ? "team" : "personal");
        const teamId =
          scope === "team" ? (input?.teamId || currentTeamId || null) : null;

        const created = await filesApi.createPersonalFile({
          title: input?.title,
          scope,
          teamId,
          scene,
        });

        await MyFilesLocalStore.setLocalFile({
          fileId: created.id,
          version: created.version,
          scene: created.scene,
          dirty: false,
          updatedAt: Date.now(),
        });

        saveVersionRef.current[created.id] = created.version;
        setFilesList((prev) => [
          created,
          ...prev.filter((file) => file.id !== created.id),
        ]);
        setFileMetaMap((prev) => ({
          ...prev,
          [created.id]: created,
        }));
        setCurrentFileId(created.id);
        applyPersonalFileScene(created.scene);
        setFileSyncState("synced");
        setIsCreateFileModalOpen(false);
        await loadScopedFiles();
      } catch (error) {
        setFilesPanelError(
          getFilesPanelErrorMessage(error, t("excPlus.files.errors.createFile")),
        );
        throw new Error("CREATE_FILE_FAILED");
      }
    },
    [
      applyPersonalFileScene,
      currentScope,
      currentTeamId,
      excalidrawAPI,
      isAuthenticated,
      loadScopedFiles,
      setCurrentFileId,
      setFileMetaMap,
      setFileSyncState,
      setFilesList,
      setFilesPanelError,
    ],
  );

  const saveCurrentFileDebounced = useRef(
    debounce(
      async (opts: {
        fileId: string;
        scene: ReturnType<typeof serializeSceneFromExcalidraw>;
        title?: string;
        source?: "local" | "queue";
        forceVersion?: number;
      }) => {
        const activeConflict = conflictContextRef.current;
        const isConflictLockedForFile = activeConflict?.fileId === opts.fileId;
        if (isConflictLockedForFile) {
          setFileSyncState("conflict");
          return;
        }

        const currentVersion = opts.forceVersion || saveVersionRef.current[opts.fileId];
        if (!currentVersion) {
          return;
        }

        setFileSyncState("syncing");

        try {
          const saved = await filesApi.saveFile({
            fileId: opts.fileId,
            version: currentVersion,
            title: opts.title,
            scene: opts.scene,
          });

          saveVersionRef.current[opts.fileId] = saved.version;

          await MyFilesLocalStore.setLocalFile({
            fileId: opts.fileId,
            version: saved.version,
            scene: saved.scene,
            dirty: false,
            updatedAt: Date.now(),
          });

          setFilesList((prev) =>
            prev
              .map((file) => (file.id === saved.id ? saved : file))
              .sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              ),
          );
          setFileMetaMap((prev) => ({
            ...prev,
            [saved.id]: saved,
          }));

          setPendingOps((prev) => {
            if (!prev.length) {
              return prev;
            }
            return prev.filter(
              (op) => !(op.type === "save" && op.fileId === opts.fileId),
            );
          });
          setConflictContext((prev) =>
            prev?.fileId === opts.fileId ? null : prev,
          );

          setFileSyncState("synced");
        } catch (error) {
          if (
            error instanceof FilesApiError &&
            error.code === "VERSION_CONFLICT"
          ) {
            setFileSyncState("conflict");
            const fileMeta = fileMetaMapRef.current[opts.fileId];
            setConflictContext({
              fileId: opts.fileId,
              title: fileMeta?.title || t("labels.untitled"),
              localSceneVersion: currentVersion,
              serverVersion: error.currentVersion || currentVersion,
            });
            return;
          }

          if (error instanceof FilesApiError && error.code === "FILE_NOT_FOUND") {
            await MyFilesLocalStore.deleteLocalFile(opts.fileId);
            delete saveVersionRef.current[opts.fileId];

            setPendingOps((prev) =>
              prev.filter(
                (op) => !(op.type === "save" && op.fileId === opts.fileId),
              ),
            );
            setConflictContext((prev) =>
              prev?.fileId === opts.fileId ? null : prev,
            );
            setFilesList((prev) => prev.filter((file) => file.id !== opts.fileId));
            setFileMetaMap((prev) => {
              const next = { ...prev };
              delete next[opts.fileId];
              return next;
            });

            if (currentFileIdRef.current === opts.fileId) {
              setCurrentFileId(null);
              applyPersonalFileScene(getEmptyFileScene());
              setFileSyncState("idle");
            }

            setFilesPanelError(t("excPlus.errors.fileNotFound"));
            return;
          }

          if (!navigator.onLine) {
            setPendingOps((prev) =>
              enqueuePendingOp(prev, {
                type: "save",
                fileId: opts.fileId,
                version: currentVersion,
                title: opts.title,
                scene: opts.scene,
                attempt: 0,
                nextRetryAt: Date.now(),
              }),
            );
            setFileSyncState("offline");
            return;
          }

          if (opts.source !== "queue") {
            setPendingOps((prev) =>
              enqueuePendingOp(prev, {
                type: "save",
                fileId: opts.fileId,
                version: currentVersion,
                title: opts.title,
                scene: opts.scene,
                attempt: 0,
                nextRetryAt: Date.now(),
              }),
            );
          }

          setFileSyncState("dirty");
        }
      },
      1200,
    ),
  ).current;

  const replayPendingOperations = useCallback(async () => {
    if (replayingPendingOpsRef.current || !pendingOps.length || !navigator.onLine) {
      return;
    }

    if (conflictContextRef.current) {
      setFileSyncState("conflict");
      return;
    }

    replayingPendingOpsRef.current = true;
    setFileSyncState("syncing");

    try {
      let queueSnapshot = [...pendingOps];

      while (queueSnapshot.length) {
        if (!navigator.onLine) {
          setPendingOps(queueSnapshot);
          setFileSyncState("offline");
          return;
        }

        const { op, queue, nextRetryAt } = dequeueReadyPendingOp(queueSnapshot);
        if (!op) {
          if (typeof nextRetryAt === "number") {
            setPendingOps(queueSnapshot);
          }
          break;
        }

        if (op.type === "save") {
          try {
            const saved = await filesApi.saveFile({
              fileId: op.fileId,
              version: op.version,
              title: op.title,
              scene: op.scene,
            });

            saveVersionRef.current[op.fileId] = saved.version;

            await MyFilesLocalStore.setLocalFile({
              fileId: op.fileId,
              version: saved.version,
              scene: saved.scene,
              dirty: false,
              updatedAt: Date.now(),
            });

            setFilesList((prev) =>
              prev
                .map((file) => (file.id === saved.id ? saved : file))
                .sort(
                  (a, b) =>
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime(),
                ),
            );
            setFileMetaMap((prev) => ({
              ...prev,
              [saved.id]: saved,
            }));
          } catch (error) {
            if (
              error instanceof FilesApiError &&
              error.code === "VERSION_CONFLICT"
            ) {
              const fileMeta = fileMetaMapRef.current[op.fileId];
              setConflictContext({
                fileId: op.fileId,
                title: fileMeta?.title || t("labels.untitled"),
                localSceneVersion: op.version,
                serverVersion: error.currentVersion || op.version,
              });
              setFileSyncState("conflict");
              setPendingOps(queueSnapshot);
              return;
            } else if (
              error instanceof FilesApiError &&
              error.code === "FILE_NOT_FOUND"
            ) {
              await MyFilesLocalStore.deleteLocalFile(op.fileId);
              delete saveVersionRef.current[op.fileId];

              setConflictContext((prev) =>
                prev?.fileId === op.fileId ? null : prev,
              );
              setFilesList((prev) =>
                prev.filter((file) => file.id !== op.fileId),
              );
              setFileMetaMap((prev) => {
                const next = { ...prev };
                delete next[op.fileId];
                return next;
              });

              if (currentFileIdRef.current === op.fileId) {
                setCurrentFileId(null);
                applyPersonalFileScene(getEmptyFileScene());
                setFileSyncState("idle");
              }

              queueSnapshot = queue;
              setPendingOps(queueSnapshot);
              setFilesPanelError(t("excPlus.errors.fileNotFound"));
              continue;
            } else {
              const retried = markPendingOpForRetry(op, {
                errorCode:
                  error instanceof FilesApiError
                    ? error.code
                    : error instanceof Error
                    ? error.name
                    : "UNKNOWN",
              });
              queueSnapshot = enqueuePendingOp(queue, retried);
              setFileSyncState("offline");
            }

            setPendingOps(queueSnapshot);
            return;
          }
        }

        queueSnapshot = queue;
      }

      if (!queueSnapshot.length) {
        setPendingOps([]);
        setFileSyncState("synced");
      } else {
        setPendingOps(queueSnapshot);
        setFileSyncState("offline");
      }
    } finally {
      replayingPendingOpsRef.current = false;
    }
  }, [
    applyPersonalFileScene,
    setCurrentFileId,
    pendingOps,
    setFileMetaMap,
    setFileSyncState,
    setFilesList,
    setFilesPanelError,
    setConflictContext,
    setPendingOps,
  ]);

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!isAuthenticated) {
        return;
      }

      setFilesPanelError("");

      try {
        saveCurrentFileDebounced.flush();
        await filesApi.deleteFile(fileId);
        await MyFilesLocalStore.deleteLocalFile(fileId);

        delete saveVersionRef.current[fileId];

        const nextFiles = filesList.filter((file) => file.id !== fileId);
        setFilesList(nextFiles);
        setPendingOps((prev) =>
          prev.filter((op) => !(op.type === "save" && op.fileId === fileId)),
        );
        setConflictContext((prev) =>
          prev?.fileId === fileId ? null : prev,
        );
        setFileMetaMap((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });

        if (currentFileIdRef.current === fileId) {
          setCurrentFileId(null);

          if (nextFiles[0]) {
            await openFile(nextFiles[0].id);
          } else {
            applyPersonalFileScene(getEmptyFileScene());
            setFileSyncState("idle");
          }
        }

        await loadScopedFiles();
      } catch (error) {
        if (error instanceof FilesApiError && error.code === "FILE_NOT_FOUND") {
          await MyFilesLocalStore.deleteLocalFile(fileId);
          delete saveVersionRef.current[fileId];

          const nextFiles = filesList.filter((file) => file.id !== fileId);
          setFilesList(nextFiles);
          setPendingOps((prev) =>
            prev.filter((op) => !(op.type === "save" && op.fileId === fileId)),
          );
          setConflictContext((prev) =>
            prev?.fileId === fileId ? null : prev,
          );
          setFileMetaMap((prev) => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });

          if (currentFileIdRef.current === fileId) {
            setCurrentFileId(null);

            if (nextFiles[0]) {
              await openFile(nextFiles[0].id);
            } else {
              applyPersonalFileScene(getEmptyFileScene());
              setFileSyncState("idle");
            }
          }

          await loadScopedFiles();
          return;
        }

        setFilesPanelError(
          getFilesPanelErrorMessage(error, t("excPlus.files.errors.deleteFile")),
        );
      }
    },
    [
      applyPersonalFileScene,
      filesList,
      isAuthenticated,
      loadScopedFiles,
      openFile,
      saveCurrentFileDebounced,
      setCurrentFileId,
      setPendingOps,
      setConflictContext,
      setFileMetaMap,
      setFileSyncState,
      setFilesList,
      setFilesPanelError,
    ],
  );

  const restoreFileFromTrash = useCallback(
    async (fileId: string) => {
      try {
        await filesApi.restoreFile(fileId);
        await loadScopedFiles();
      } catch (error) {
        setFilesPanelError(
          getFilesPanelErrorMessage(error, t("excPlus.files.errors.restoreFile")),
        );
      }
    },
    [loadScopedFiles, setFilesPanelError],
  );

  const permanentlyDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await filesApi.permanentlyDeleteFile(fileId);
        await MyFilesLocalStore.deleteLocalFile(fileId);
        delete saveVersionRef.current[fileId];
        await loadScopedFiles();
      } catch (error) {
        setFilesPanelError(
          getFilesPanelErrorMessage(
            error,
            t("excPlus.files.errors.permanentDeleteFile"),
          ),
        );
      }
    },
    [loadScopedFiles, setFilesPanelError],
  );

  const toggleFavorite = useCallback(
    async (fileId: string, isFavorite: boolean) => {
      try {
        const file = await filesApi.setFavorite(fileId, isFavorite);
        setFilesList((prev) =>
          prev.map((item) => (item.id === file.id ? { ...item, ...file } : item)),
        );
        setFileMetaMap((prev) => ({
          ...prev,
          [file.id]: {
            ...(prev[file.id] || {}),
            ...file,
          },
        }));
      } catch (error) {
        setFilesPanelError(
          getFilesPanelErrorMessage(error, t("excPlus.files.errors.favoriteFile")),
        );
      }
    },
    [setFileMetaMap, setFilesList, setFilesPanelError],
  );

  const renameFile = useCallback(
    async (fileId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return;
      }

      const currentVersion = saveVersionRef.current[fileId];
      if (!currentVersion) {
        return;
      }

      try {
        const currentLocal = await MyFilesLocalStore.getLocalFile(fileId);
        let scene = currentLocal?.scene;
        if (!scene) {
          const remoteFile = await filesApi.getFile(fileId);
          saveVersionRef.current[fileId] = remoteFile.version;
          scene = remoteFile.scene;
        }

        const saved = await filesApi.saveFile({
          fileId,
          version: saveVersionRef.current[fileId] || currentVersion,
          title: trimmedTitle,
          scene: scene,
        });

        saveVersionRef.current[fileId] = saved.version;

        await MyFilesLocalStore.setLocalFile({
          fileId,
          version: saved.version,
          scene: saved.scene,
          dirty: false,
          updatedAt: Date.now(),
        });

        setFilesList((prev) =>
          prev
            .map((file) => (file.id === saved.id ? saved : file))
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            ),
        );
        setFileMetaMap((prev) => ({
          ...prev,
          [saved.id]: saved,
        }));
      } catch (error) {
        setFilesPanelError(
          getFilesPanelErrorMessage(error, t("excPlus.files.errors.renameFile")),
        );
      }
    },
    [setFileMetaMap, setFilesList, setFilesPanelError],
  );

  const createTeamWithName = useCallback(
    async (teamName: string) => {
      const trimmedName = teamName.trim();
      if (!trimmedName) {
        throw new Error("TEAM_NAME_REQUIRED");
      }

      try {
        const created = await teamsApi.createTeam(trimmedName);
        setTeams((prev) => [created, ...prev]);
        setCurrentScope("team");
        setCurrentTeamId(created.id);
        setTrashSourceScope("team");
        setIsCreateTeamModalOpen(false);
      } catch (error) {
        setTeamsPanelError(
          getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.createTeam")),
        );
        throw new Error("CREATE_TEAM_FAILED");
      }
    },
    [
      setCurrentScope,
      setCurrentTeamId,
      setTeams,
      setTeamsPanelError,
      setTrashSourceScope,
    ],
  );

  const loadTeamMembers = useCallback(async () => {
    if (!currentTeamId) {
      return;
    }

    setIsTeamMembersLoading(true);
    try {
      const members = await teamsApi.listMembers(currentTeamId);
      setTeamMembersMap((prev) => ({
        ...prev,
        [currentTeamId]: members,
      }));
      setTeamsPanelError("");
    } catch (error) {
      setTeamsPanelError(
        getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.loadMembers")),
      );
    } finally {
      setIsTeamMembersLoading(false);
    }
  }, [currentTeamId, setTeamMembersMap, setTeamsPanelError]);

  const manageTeamMembers = useCallback(async () => {
    if (!currentTeamId) {
      return;
    }

    setIsTeamMembersDialogOpen(true);
    await loadTeamMembers();
  }, [currentTeamId, loadTeamMembers]);

  const addTeamMember = useCallback(
    async (input: { email: string; role: "owner" | "admin" | "member" }) => {
      if (!currentTeamId) {
        return;
      }

      try {
        await teamsApi.addMember({
          teamId: currentTeamId,
          email: input.email,
          role: input.role,
        });
        await loadTeamMembers();
      } catch (error) {
        setTeamsPanelError(
          getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.addMember")),
        );
      }
    },
    [currentTeamId, loadTeamMembers, setTeamsPanelError],
  );

  const updateTeamMemberRole = useCallback(
    async (input: { userId: string; role: "owner" | "admin" | "member" }) => {
      if (!currentTeamId) {
        return;
      }

      try {
        await teamsApi.updateMemberRole({
          teamId: currentTeamId,
          userId: input.userId,
          role: input.role,
        });
        await loadTeamMembers();
      } catch (error) {
        setTeamsPanelError(
          getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.updateMemberRole")),
        );
      }
    },
    [currentTeamId, loadTeamMembers, setTeamsPanelError],
  );

  const removeTeamMember = useCallback(
    async (userId: string) => {
      if (!currentTeamId) {
        return;
      }

      try {
        await teamsApi.removeMember({
          teamId: currentTeamId,
          userId,
        });
        await loadTeamMembers();
      } catch (error) {
        setTeamsPanelError(
          getTeamsPanelErrorMessage(error, t("excPlus.teams.errors.removeMember")),
        );
      }
    },
    [currentTeamId, loadTeamMembers, setTeamsPanelError],
  );

  const onScopeChange = useCallback(
    (scope: FilesScope) => {
      setCurrentScope(scope);
      setCurrentFileId(null);
      if (scope === "trash") {
        setFileSyncState("idle");
      } else {
        setTrashSourceScope(scope);
      }
    },
    [setCurrentFileId, setCurrentScope, setFileSyncState, setTrashSourceScope],
  );

  const onSelectTeam = useCallback(
    (teamId: string) => {
      setCurrentScope("team");
      setCurrentTeamId(teamId);
      setCurrentFileId(null);
      setTrashSourceScope("team");
    },
    [setCurrentFileId, setCurrentScope, setCurrentTeamId, setTrashSourceScope],
  );

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (authStatus !== "unknown") {
      return;
    }

    authApi
      .getCurrentUser()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          setAuthStatus("authenticated");
        } else {
          setCurrentUser(null);
          setAuthStatus("guest");
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setAuthStatus("guest");
      });
  }, [authStatus, setAuthStatus, setCurrentUser]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadScopedFiles();
  }, [loadScopedFiles]);

  useEffect(() => {
    if (pendingOpsTimerRef.current) {
      window.clearTimeout(pendingOpsTimerRef.current);
      pendingOpsTimerRef.current = null;
    }

    if (!isAuthenticated || !pendingOps.length) {
      return;
    }

    if (conflictContext) {
      setFileSyncState("conflict");
      return;
    }

    const nextRetryAt = pendingOps.reduce<number | null>((current, op) => {
      if (current === null) {
        return op.nextRetryAt;
      }
      return Math.min(current, op.nextRetryAt);
    }, null);

    if (nextRetryAt === null) {
      return;
    }

    const delay = Math.max(0, nextRetryAt - Date.now());
    pendingOpsTimerRef.current = window.setTimeout(() => {
      replayPendingOperations();
    }, delay);

    return () => {
      if (pendingOpsTimerRef.current) {
        window.clearTimeout(pendingOpsTimerRef.current);
        pendingOpsTimerRef.current = null;
      }
    };
  }, [
    conflictContext,
    isAuthenticated,
    pendingOps,
    replayPendingOperations,
    setFileSyncState,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (conflictContextRef.current) {
        setFileSyncState("conflict");
        return;
      }
      replayPendingOperations();
    };

    const handleOffline = () => {
      setFileSyncState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [replayPendingOperations, setFileSyncState]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (conflictContext) {
      setFileSyncState("conflict");
      return;
    }

    if (!navigator.onLine) {
      setFileSyncState("offline");
      return;
    }

    if (pendingOps.length) {
      setFileSyncState("offline");
    }
  }, [conflictContext, isAuthenticated, pendingOps.length, setFileSyncState]);

  useEffect(() => {
    if (
      !excalidrawAPI ||
      !isAuthenticated ||
      currentScope === "trash" ||
      currentFileId ||
      !filesList.length
    ) {
      return;
    }

    openFile(filesList[0].id);
  }, [
    currentFileId,
    currentScope,
    excalidrawAPI,
    filesList,
    isAuthenticated,
    openFile,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !excalidrawAPI ||
      filesList.length ||
      currentScope !== "personal"
    ) {
      return;
    }

    setIsCreateFileModalOpen(true);
  }, [currentScope, excalidrawAPI, filesList.length, isAuthenticated]);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, setLangCode]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    const activeFileId = currentFileIdRef.current;
    if (
      excalidrawAPI &&
      activeFileId &&
      isAuthenticated &&
      !isApplyingPersonalSceneRef.current
    ) {
      const serializedScene = serializeSceneFromExcalidraw(excalidrawAPI);
      const activeConflict = conflictContextRef.current;
      const isConflictLockedForFile = activeConflict?.fileId === activeFileId;

      if (isConflictLockedForFile || fileSyncStateRef.current === "conflict") {
        setFileSyncState("conflict");
      } else {
        setFileSyncState("dirty");
      }

      MyFilesLocalStore.setLocalFile({
        fileId: activeFileId,
        version: saveVersionRef.current[activeFileId] || 1,
        scene: serializedScene,
        dirty: true,
        updatedAt: Date.now(),
      }).catch(() => {
        // ignore local caching errors
      });

      if (!(isConflictLockedForFile || fileSyncStateRef.current === "conflict")) {
        saveCurrentFileDebounced({
          fileId: activeFileId,
          scene: serializedScene,
        });
      }
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);
  const isOffline = useAtomValue(isOfflineAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const openAuthFlow = useCallback(
    (mode: AuthDialogMode) => {
      if (mode === "signin" && isAuthenticated) {
        setIsUserMenuOpen(true);
        return;
      }

      setAuthDialogMode(mode);
      setIsAuthDialogOpen(true);
    },
    [isAuthenticated],
  );

  const createFileDefaultScope =
    currentScope === "team" && currentTeamId ? "team" : "personal";

  const visibleFiles = useMemo(() => {
    const query = fileListQuery.trim().toLowerCase();

    const filtered = filesList.filter((file) => {
      if (fileListFavoritesOnly && !file.isFavorite) {
        return false;
      }

      if (!query) {
        return true;
      }

      return file.title.toLowerCase().includes(query);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (fileListSort === "name") {
        return a.title.localeCompare(b.title);
      }

      if (fileListSort === "updated") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }

      const aValue = new Date(a.lastOpenedAt || a.updatedAt).getTime();
      const bValue = new Date(b.lastOpenedAt || b.updatedAt).getTime();
      return bValue - aValue;
    });

    return sorted;
  }, [fileListFavoritesOnly, fileListQuery, fileListSort, filesList]);

  const canManageCurrentTeamMembers = useMemo(() => {
    if (!currentTeamId) {
      return false;
    }

    const team = teams.find((item) => item.id === currentTeamId);
    if (!team) {
      return false;
    }

    return team.role === "owner" || team.role === "admin";
  }, [currentTeamId, teams]);

  const currentTeamName =
    teams.find((team) => team.id === currentTeamId)?.name || "Team";

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <Excalidraw
        excalidrawAPI={excalidrawRefCallback}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile || !collabAPI || isCollabDisabled) {
            return null;
          }

          return (
            <div className="excalidraw-ui-top-right">
              {excalidrawAPI?.getEditorInterface().formFactor === "desktop" && (
                <ExcalidrawPlusPromoBanner
                  onAuthClick={() => openAuthFlow(isAuthenticated ? "signin" : "signup")}
                />
              )}

              {collabError.message && <CollabError collabError={collabError} />}
              <LiveCollaborationTrigger
                isCollaborating={isCollaborating}
                onSelect={() =>
                  setShareDialogState({ isOpen: true, type: "share" })
                }
                editorInterface={editorInterface}
              />
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
          isSignedIn={isAuthenticated}
          onAuthClick={openAuthFlow}
        />
        <AppWelcomeScreen
          onCollabDialogOpen={onCollabDialogOpen}
          isCollabEnabled={!isCollabDisabled}
          isSignedIn={isAuthenticated}
          onAuthClick={openAuthFlow}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
        </OverwriteConfirmDialog>
        <AppFooter
          onChange={() => excalidrawAPI?.refresh()}
          isSignedIn={isAuthenticated}
        />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        <AppSidebar
          files={visibleFiles}
          trashedFiles={trashedFiles}
          teams={teams}
          currentFileId={currentFileId}
          currentScope={currentScope}
          currentTeamId={currentTeamId}
          isLoading={authStatus === "unknown"}
          isAuthenticated={isAuthenticated}
          syncState={fileSyncState}
          listQuery={fileListQuery}
          listSort={fileListSort}
          favoritesOnly={fileListFavoritesOnly}
          errorMessage={filesPanelError || teamsPanelError}
          onCreateFile={() => setIsCreateFileModalOpen(true)}
          onOpenFile={openFile}
          onRenameFile={renameFile}
          onDeleteFile={deleteFile}
          onRestoreFile={restoreFileFromTrash}
          onPermanentDeleteFile={permanentlyDeleteFile}
          onToggleFavorite={toggleFavorite}
          onListQueryChange={setFileListQuery}
          onListSortChange={(sort) => setFileListSort(sort as FileListSort)}
          onFavoritesOnlyChange={setFileListFavoritesOnly}
          onScopeChange={onScopeChange}
          onSelectTeam={onSelectTeam}
          onCreateTeam={() => setIsCreateTeamModalOpen(true)}
          onManageTeamMembers={manageTeamMembers}
        />

        <AuthDialog
          isOpen={isAuthDialogOpen}
          mode={authDialogMode}
          onClose={() => setIsAuthDialogOpen(false)}
          onModeChange={setAuthDialogMode}
          onSuccess={(user) => {
            setCurrentUser(user);
            setAuthStatus("authenticated");
            loadTeams();
            loadScopedFiles();
          }}
        />

        <UserMenu
          isOpen={isUserMenuOpen}
          user={currentUser}
          onClose={() => setIsUserMenuOpen(false)}
          onLogout={async () => {
            await authApi.logout();
            setCurrentUser(null);
            setAuthStatus("guest");
            setIsUserMenuOpen(false);
            setCurrentFileId(null);
            setFilesList([]);
            setTrashedFiles([]);
            setFileMetaMap({});
            setPendingOps([]);
            setConflictContext(null);
            setTeams([]);
            setCurrentTeamId(null);
            setCurrentScope("personal");
            setFileSyncState("idle");
          }}
        />

        <CreateFileModal
          isOpen={isCreateFileModalOpen}
          teams={teams}
          defaultScope={createFileDefaultScope}
          defaultTeamId={currentTeamId}
          onClose={() => setIsCreateFileModalOpen(false)}
          onSubmit={createFile}
        />

        <CreateTeamModal
          isOpen={isCreateTeamModalOpen}
          onClose={() => setIsCreateTeamModalOpen(false)}
          onCreate={createTeamWithName}
        />

        <TeamMembersDialog
          isOpen={isTeamMembersDialogOpen}
          teamName={currentTeamName}
          members={currentTeamId ? teamMembersMap[currentTeamId] || [] : []}
          isLoading={isTeamMembersLoading}
          errorMessage={teamsPanelError}
          currentUserId={currentUser?.id || null}
          onClose={() => setIsTeamMembersDialogOpen(false)}
          onRefresh={loadTeamMembers}
          onAddMember={addTeamMember}
          onUpdateMemberRole={updateTeamMemberRole}
          onRemoveMember={removeTeamMember}
          canManageMembers={canManageCurrentTeamMembers}
        />

        <ConflictDialog
          context={conflictContext}
          onClose={() => {
            setFileSyncState("conflict");
          }}
          onOverwrite={async () => {
            if (!conflictContext || !excalidrawAPI) {
              return;
            }

            try {
              const localScene = serializeSceneFromExcalidraw(excalidrawAPI);
              let attempts = 0;
              let saved: Awaited<ReturnType<typeof filesApi.saveFile>> | null = null;

              while (!saved && attempts < 3) {
                const latest = await filesApi.getFile(conflictContext.fileId);

                try {
                  saved = await filesApi.saveFile({
                    fileId: conflictContext.fileId,
                    version: latest.version,
                    title: latest.title,
                    scene: localScene,
                  });
                } catch (error) {
                  if (
                    error instanceof FilesApiError &&
                    error.code === "VERSION_CONFLICT" &&
                    attempts < 2
                  ) {
                    attempts += 1;
                    continue;
                  }

                  throw error;
                }

                attempts += 1;
              }

              if (!saved) {
                throw new Error("OVERWRITE_CONFLICT_RETRY_EXHAUSTED");
              }

              saveVersionRef.current[saved.id] = saved.version;
              await MyFilesLocalStore.setLocalFile({
                fileId: saved.id,
                version: saved.version,
                scene: saved.scene,
                dirty: false,
                updatedAt: Date.now(),
              });
              setFilesList((prev) =>
                prev
                  .map((file) => (file.id === saved.id ? saved : file))
                  .sort(
                    (a, b) =>
                      new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime(),
                  ),
              );
              setFileMetaMap((prev) => ({
                ...prev,
                [saved.id]: saved,
              }));
              setPendingOps((prev) =>
                prev.filter(
                  (op) =>
                    !(op.type === "save" && op.fileId === conflictContext.fileId),
                ),
              );
              setConflictContext(null);
              setFileSyncState("synced");
            } catch (error) {
              setFilesPanelError(
                getFilesPanelErrorMessage(
                  error,
                  t("excPlus.files.errors.overwriteConflict"),
                ),
              );
            }
          }}
          onSaveAsCopy={async () => {
            if (!conflictContext || !excalidrawAPI) {
              return;
            }

            try {
              const fileMeta = fileMetaMapRef.current[conflictContext.fileId];
              const localScene = serializeSceneFromExcalidraw(excalidrawAPI);
              await createFile({
                title: `${fileMeta?.title || t("labels.untitled")} (${t("labels.copy")})`,
                scope: fileMeta?.teamId ? "team" : "personal",
                teamId: fileMeta?.teamId || null,
                scene: localScene,
              });
              setConflictContext(null);
              setFileSyncState("synced");
            } catch (error) {
              setFilesPanelError(
                getFilesPanelErrorMessage(
                  error,
                  t("excPlus.files.errors.saveConflictCopy"),
                ),
              );
            }
          }}
        />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/EagleFandel/excalidraw_plus",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: isAuthenticated
                ? t("excPlus.auth.account")
                : t("excPlus.auth.signIn"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              keywords: ["auth", "login", "register", "account"],
              perform: () => {
                openAuthFlow(isAuthenticated ? "signin" : "signup");
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawWrapper />
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
