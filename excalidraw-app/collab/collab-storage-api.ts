import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  encryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { getSyncableElements } from "../data";

import type { SyncableExcalidrawElement } from "../data";
import type Portal from "./Portal";
import type { Socket } from "socket.io-client";

const COLLAB_API_BASE = (
  import.meta.env.VITE_APP_FILES_API_URL ||
  import.meta.env.VITE_APP_AUTH_API_URL ||
  ""
).replace(/\/$/, "");

type CollabScenePayload = {
  roomId: string;
  sceneVersion: number;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

const toApiUrl = (path: string) => {
  return `${COLLAB_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

const toBase64 = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let cursor = 0; cursor < bytes.length; cursor += chunkSize) {
    const chunk = bytes.subarray(cursor, cursor + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array) => {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();

  static get(socket: Socket) {
    return SceneVersionCache.cache.get(socket);
  }

  static set(socket: Socket, elements: readonly SyncableExcalidrawElement[]) {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  }
}

const decryptSceneElements = async (
  scene: CollabScenePayload,
  roomKey: string,
) => {
  const iv = fromBase64(scene.iv);
  const ciphertext = fromBase64(scene.ciphertext);
  const decrypted = await decryptData(
    iv as Uint8Array<ArrayBuffer>,
    toArrayBuffer(ciphertext),
    roomKey,
  );
  const decoded = new TextDecoder("utf-8").decode(new Uint8Array(decrypted));
  const parsed = JSON.parse(decoded) as readonly ExcalidrawElement[];

  return getSyncableElements(
    restoreElements(parsed, null, {
      deleteInvisibleElements: true,
    }),
  );
};

export const isSavedToCollabStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return SceneVersionCache.get(portal.socket) === sceneVersion;
  }

  return true;
};

export const saveSceneToCollabStorage = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  _appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToCollabStorage(portal, elements)
  ) {
    return null;
  }

  const sceneVersion = getSceneVersion(elements);
  const encoded = new TextEncoder().encode(JSON.stringify(elements));
  const { encryptedBuffer, iv } = await encryptData(roomKey, encoded);

  const response = await fetch(toApiUrl(`/collab/rooms/${roomId}/scene`), {
    method: "PUT",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sceneVersion,
      iv: toBase64(iv),
      ciphertext: toBase64(encryptedBuffer),
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(raw || "Failed to save collaboration scene");
  }

  const result = (await response.json()) as {
    scene?: CollabScenePayload | null;
  };
  const scene = result.scene;
  if (!scene) {
    return null;
  }

  const storedElements = await decryptSceneElements(scene, roomKey);
  SceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadSceneFromCollabStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const response = await fetch(toApiUrl(`/collab/rooms/${roomId}/scene`), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(raw || "Failed to load collaboration scene");
  }

  const result = (await response.json()) as {
    scene?: CollabScenePayload | null;
  };
  if (!result.scene) {
    return null;
  }

  const elements = await decryptSceneElements(result.scene, roomKey);
  if (socket) {
    SceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const saveFilesToCollabStorage = async ({
  roomId,
  files,
}: {
  roomId: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const savedFiles: FileId[] = [];
  const erroredFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const response = await fetch(
          toApiUrl(`/collab/rooms/${roomId}/files/${id}`),
          {
            method: "PUT",
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              blob: toBase64(buffer),
            }),
          },
        );

        if (!response.ok) {
          erroredFiles.push(id);
          return;
        }

        savedFiles.push(id);
      } catch {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromCollabStorage = async (
  roomId: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const response = await fetch(
          toApiUrl(`/collab/rooms/${roomId}/files/${id}`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (response.status >= 400) {
          erroredFiles.set(id, true);
          return;
        }

        const payload = (await response.json()) as {
          file?: {
            blob: string;
          };
        };
        if (!payload.file?.blob) {
          erroredFiles.set(id, true);
          return;
        }

        const rawBytes = fromBase64(payload.file.blob);
        const { data, metadata } = await decompressData<BinaryFileMetadata>(
          rawBytes,
          {
            decryptionKey,
          },
        );

        const dataURL = new TextDecoder().decode(data) as DataURL;
        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id,
          dataURL,
          created: metadata?.created || Date.now(),
          lastRetrieved: metadata?.created || Date.now(),
        });
      } catch {
        erroredFiles.set(id, true);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
