import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import type { FileScenePayload } from "./files-api";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object";
};

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const normalizePersistedAppState = (
  appState: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized = { ...appState };
  const collaborators = normalized.collaborators;

  if (collaborators instanceof Map) {
    return normalized;
  }

  if (isArray(collaborators)) {
    try {
      normalized.collaborators = new Map(collaborators as [string, unknown][]);
      return normalized;
    } catch {
      delete normalized.collaborators;
      return normalized;
    }
  }

  delete normalized.collaborators;
  return normalized;
};

export const getEmptyFileScene = (): FileScenePayload => ({
  elements: [],
  appState: {},
  files: {},
});

export const serializeSceneFromExcalidraw = (
  excalidrawAPI: ExcalidrawImperativeAPI,
): FileScenePayload => {
  const { collaborators: _defaultCollaborators, ...defaultAppState } =
    getDefaultAppState();
  const { collaborators: _runtimeCollaborators, ...runtimeAppState } =
    excalidrawAPI.getAppState();

  return {
    elements: excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .map((element) => ({ ...element })),
    appState: {
      ...defaultAppState,
      ...runtimeAppState,
    },
    files: { ...excalidrawAPI.getFiles() },
  };
};

export const applyFileSceneToExcalidraw = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  scene: FileScenePayload,
) => {
  const elementsInput = isArray(scene.elements) ? scene.elements : [];
  const filesInput = isRecord(scene.files) ? scene.files : {};
  const appStateInput = isRecord(scene.appState) ? scene.appState : {};
  const normalizedAppStateInput = normalizePersistedAppState(appStateInput);

  const restoredElements = restoreElements(
    elementsInput as OrderedExcalidrawElement[],
    null,
    {
      repairBindings: true,
    },
  );

  const restoredAppState = restoreAppState(normalizedAppStateInput, null);

  excalidrawAPI.updateScene({
    elements: restoredElements,
    appState: restoredAppState,
  });

  excalidrawAPI.addFiles(Object.values(filesInput) as BinaryFileData[]);
};
