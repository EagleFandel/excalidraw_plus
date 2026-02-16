import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3005/api";
const SHOULD_START_BACKEND = process.env.E2E_START_BACKEND === "1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(SCRIPT_DIR, "..");
const RUN_ID = new Date().toISOString().replace(/[\-:TZ.]/g, "").slice(0, 14);
const RUN_STARTED_AT = new Date();
const CSRF_HEADER_NAME =
  (process.env.CSRF_HEADER_NAME || "x-csrf-token").toLowerCase();
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AI_ENABLED = String(process.env.AI_ENABLED || "").toLowerCase() === "true";
let lastProcInfo = null;
const prisma = new PrismaClient();
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/excalidraw_plus_dev?schema=public";

const TEST_USERS = {
  alice: `alice.${RUN_ID}@example.com`,
  bob: `bob.${RUN_ID}@example.com`,
  charlie: `charlie.${RUN_ID}@example.com`,
  dave: `dave.${RUN_ID}@example.com`,
};

const TEST_PASSWORD = "P@ssw0rd-1234";

class Session {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  cookieHeader() {
    if (!this.cookies.size) {
      return "";
    }
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeSetCookies(response) {
    const setCookieHeaders =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")]
          : [];

    for (const setCookie of setCookieHeaders) {
      if (!setCookie) {
        continue;
      }

      const firstPair = setCookie.split(";")[0] || "";
      const eqIndex = firstPair.indexOf("=");
      if (eqIndex < 1) {
        continue;
      }

      const name = firstPair.slice(0, eqIndex).trim();
      const value = firstPair.slice(eqIndex + 1).trim();

      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  async fetchCsrfToken(headers = {}) {
    const requestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    const cookieHeader = this.cookieHeader();
    if (cookieHeader) {
      requestHeaders.Cookie = cookieHeader;
    }

    const response = await fetch(`${BASE_URL}/auth/csrf`, {
      method: "GET",
      headers: requestHeaders,
      redirect: "manual",
    });

    this.storeSetCookies(response);

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      throw new Error(
        `[${this.name}] GET /auth/csrf expected 200, got ${response.status}. body=${raw}`,
      );
    }

    const data = await response.json().catch(() => null);
    const csrfToken = data?.csrfToken;

    if (!csrfToken) {
      throw new Error(`[${this.name}] csrfToken missing in /auth/csrf response`);
    }

    return csrfToken;
  }

  async request(method, path, options = {}) {
    const {
      body,
      expectedStatus,
      headers: customHeaders,
      useCsrf = true,
    } = options;

    const normalizedMethod = String(method || "GET").toUpperCase();

    const headers = {
      Accept: "application/json",
      ...(customHeaders || {}),
    };

    if (useCsrf && MUTATING_METHODS.has(normalizedMethod)) {
      const csrfToken = await this.fetchCsrfToken(customHeaders || {});
      headers[CSRF_HEADER_NAME] = csrfToken;
    }

    const cookieHeader = this.cookieHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method: normalizedMethod,
      headers,
      body: payload,
      redirect: "manual",
    });

    this.storeSetCookies(response);

    const rawText = await response.text();
    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    if (
      expectedStatus !== undefined &&
      Number(response.status) !== Number(expectedStatus)
    ) {
      throw new Error(
        `[${this.name}] ${method} ${path} expected ${expectedStatus}, got ${response.status}. body=${JSON.stringify(data)}`,
      );
    }

    return {
      status: response.status,
      data,
      headers: response.headers,
    };
  }
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeCode = (data) => data?.error?.code;

const runCommand = async (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const spawnCommand = process.platform === "win32" ? "cmd.exe" : command;
    const spawnArgs =
      process.platform === "win32" ? ["/c", command, ...args] : args;

    const child = spawn(spawnCommand, spawnArgs, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk || "");
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed (${command} ${args.join(" ")}) with code ${String(code)}. stderr=${stderr.trim()}`,
        ),
      );
    });
  });
};

const runStep = async (title, fn, state) => {
  try {
    await fn();
    state.passed += 1;
    console.log(`✅ ${title}`);
  } catch (error) {
    state.failed += 1;
    console.error(`❌ ${title}`);
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

const findFile = (files, fileId) => (files || []).find((file) => file.id === fileId);

const waitForHealthy = async (timeoutMs = 30000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.status === 200) {
        const body = await res.json();
        if (body?.ok && body?.db) {
          return;
        }
      }
    } catch {
      // keep waiting
    }

    await sleep(500);
  }

  throw new Error("Backend health check timed out");
};

const startBackendProcess = async () => {
  const env = {
    ...process.env,
    PORT: process.env.PORT || "3005",
    DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || "change-me",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME || "excplus-auth",
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE || "false",
    AUTH_COOKIE_SAME_SITE: process.env.AUTH_COOKIE_SAME_SITE || "lax",
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN || "",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3001",
    CSRF_COOKIE_NAME: process.env.CSRF_COOKIE_NAME || "excplus-csrf",
    CSRF_HEADER_NAME: process.env.CSRF_HEADER_NAME || "x-csrf-token",
    THROTTLE_TTL: process.env.THROTTLE_TTL || "60",
    THROTTLE_LIMIT: process.env.THROTTLE_LIMIT || "120",
    AUTH_THROTTLE_TTL: process.env.AUTH_THROTTLE_TTL || "60",
    AUTH_THROTTLE_LIMIT: process.env.AUTH_THROTTLE_LIMIT || "10",
    METRICS_ENABLED: process.env.METRICS_ENABLED || "false",
    COLLAB_MAX_SCENE_BYTES: process.env.COLLAB_MAX_SCENE_BYTES || "2097152",
    COLLAB_MAX_FILE_BYTES: process.env.COLLAB_MAX_FILE_BYTES || "4194304",
    AI_ENABLED: process.env.AI_ENABLED || "false",
    AI_PROVIDER: process.env.AI_PROVIDER || "openai-compatible",
    AI_BASE_URL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
    AI_API_KEY: process.env.AI_API_KEY || "",
    AI_TEXT_TO_DIAGRAM_MODEL:
      process.env.AI_TEXT_TO_DIAGRAM_MODEL || "gpt-4.1-mini",
    AI_DIAGRAM_TO_CODE_MODEL:
      process.env.AI_DIAGRAM_TO_CODE_MODEL || "gpt-4.1-mini",
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || "45000",
    AI_THROTTLE_TTL: process.env.AI_THROTTLE_TTL || "60",
    AI_THROTTLE_LIMIT_PER_IP: process.env.AI_THROTTLE_LIMIT_PER_IP || "30",
    AI_THROTTLE_LIMIT_PER_USER:
      process.env.AI_THROTTLE_LIMIT_PER_USER || "20",
  };

  await runCommand("yarn", ["prisma:deploy"], {
    cwd: BACKEND_DIR,
    env,
  });

  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: BACKEND_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const output = [];
  const pushLog = (chunk) => {
    const text = String(chunk || "").trim();
    if (!text) {
      return;
    }
    output.push(text);
    if (output.length > 120) {
      output.shift();
    }
  };

  child.stdout?.on("data", pushLog);
  child.stderr?.on("data", pushLog);

  const procInfo = { child, output };
  lastProcInfo = procInfo;

  const waitForExit = new Promise((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `Backend exited before healthy (code=${String(code)} signal=${String(signal)})`,
        ),
      );
    });
  });

  await Promise.race([waitForHealthy(), waitForExit]);

  return procInfo;
};

const stopBackendProcess = async (procInfo) => {
  if (!procInfo?.child || procInfo.child.exitCode !== null) {
    return;
  }

  procInfo.child.kill();

  await Promise.race([
    new Promise((resolve) => procInfo.child.once("exit", resolve)),
    sleep(3000),
  ]);

  if (procInfo.child.exitCode === null) {
    procInfo.child.kill("SIGKILL");
  }
};

const main = async () => {
  const state = {
    passed: 0,
    failed: 0,
  };

  const anon = new Session("anon");
  const alice = new Session("alice");
  const bob = new Session("bob");
  const charlie = new Session("charlie");
  const dave = new Session("dave");
  const verifier = new Session("verifier");

  const refs = {
    aliceId: "",
    bobId: "",
    charlieId: "",
    teamId: "",
    personalFileId: "",
    teamFileId: "",
    personalVersion: 1,
    teamVersion: 1,
    collabRoomId: `room_${RUN_ID}`,
    collabFileId: `file_${RUN_ID}`,
  };

  let procInfo = null;

  try {
    if (SHOULD_START_BACKEND) {
      console.log("Starting backend process from E2E script...");
      procInfo = await startBackendProcess();
      lastProcInfo = procInfo;
    }

    console.log("--- Excalidraw+ API E2E Checklist ---");
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Run ID: ${RUN_ID}`);
    console.log(
      `Users: ${TEST_USERS.alice}, ${TEST_USERS.bob}, ${TEST_USERS.charlie}, ${TEST_USERS.dave}`,
    );

  await runStep("Health check", async () => {
    const res = await anon.request("GET", "/health", { expectedStatus: 200 });
    assert(res.data?.ok === true, "health.ok should be true");
    assert(res.data?.db === true, "health.db should be true");
  }, state);

  await runStep("/docs-json includes core API routes", async () => {
    const res = await anon.request("GET", "/docs-json", { expectedStatus: 200 });
    assert(String(res.data?.openapi || "").startsWith("3."), "openapi version missing");
    assert(!!res.data?.paths?.["/api/auth/register"], "docs missing /api/auth/register");
    assert(!!res.data?.paths?.["/api/files"], "docs missing /api/files");
    assert(!!res.data?.paths?.["/api/teams"], "docs missing /api/teams");
  }, state);

  await runStep("Unauthenticated /auth/me returns 401", async () => {
    const res = await anon.request("GET", "/auth/me", { expectedStatus: 401 });
    assert(res.data?.user === null, "unauth /auth/me should return user: null");
  }, state);

  await runStep("Mutating request without CSRF returns 403", async () => {
    const res = await anon.request("POST", "/auth/register", {
      expectedStatus: 403,
      useCsrf: false,
      body: {
        email: `blocked.${RUN_ID}@example.com`,
        password: TEST_PASSWORD,
        displayName: "Blocked",
      },
    });
    assert(safeCode(res.data) === "FORBIDDEN", "missing CSRF should return FORBIDDEN");
  }, state);

  await runStep("Collab scene write/read without auth and CSRF", async () => {
    const scenePayload = {
      sceneVersion: 1,
      iv: Buffer.from("iv-seed").toString("base64"),
      ciphertext: Buffer.from(`ciphertext-${RUN_ID}`).toString("base64"),
    };

    const putRes = await anon.request(
      "PUT",
      `/collab/rooms/${refs.collabRoomId}/scene`,
      {
        expectedStatus: 200,
        useCsrf: false,
        body: scenePayload,
      },
    );
    assert(putRes.data?.scene?.roomId === refs.collabRoomId, "scene roomId mismatch");
    assert(
      Number(putRes.data?.scene?.sceneVersion) === 1,
      "scene version should be 1",
    );

    const getRes = await anon.request(
      "GET",
      `/collab/rooms/${refs.collabRoomId}/scene`,
      {
        expectedStatus: 200,
      },
    );
    assert(getRes.data?.scene?.ciphertext, "scene ciphertext missing");
  }, state);

  await runStep("Collab asset write/read without auth and CSRF", async () => {
    const blob = Buffer.from(`asset-${RUN_ID}`).toString("base64");

    const putRes = await anon.request(
      "PUT",
      `/collab/rooms/${refs.collabRoomId}/files/${refs.collabFileId}`,
      {
        expectedStatus: 200,
        useCsrf: false,
        body: { blob },
      },
    );
    assert(putRes.data?.file?.roomId === refs.collabRoomId, "asset roomId mismatch");

    const getRes = await anon.request(
      "GET",
      `/collab/rooms/${refs.collabRoomId}/files/${refs.collabFileId}`,
      {
        expectedStatus: 200,
      },
    );
    assert(getRes.data?.file?.blob === blob, "asset blob mismatch");
  }, state);

  await runStep("Register alice", async () => {
    const res = await alice.request("POST", "/auth/register", {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.alice,
        password: TEST_PASSWORD,
        displayName: "Alice E2E",
      },
    });
    refs.aliceId = res.data?.user?.id;
    assert(!!refs.aliceId, "alice id missing");
  }, state);

  await runStep("Register bob", async () => {
    const res = await bob.request("POST", "/auth/register", {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.bob,
        password: TEST_PASSWORD,
        displayName: "Bob E2E",
      },
    });
    refs.bobId = res.data?.user?.id;
    assert(!!refs.bobId, "bob id missing");
  }, state);

  await runStep("Register charlie", async () => {
    const res = await charlie.request("POST", "/auth/register", {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.charlie,
        password: TEST_PASSWORD,
        displayName: "Charlie E2E",
      },
    });
    refs.charlieId = res.data?.user?.id;
    assert(!!refs.charlieId, "charlie id missing");
  }, state);

  await runStep("Register dave", async () => {
    const res = await dave.request("POST", "/auth/register", {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.dave,
        password: TEST_PASSWORD,
        displayName: "Dave E2E",
      },
    });
    assert(!!res.data?.user?.id, "dave id missing");
  }, state);

  await runStep("Duplicate register returns 409", async () => {
    const res = await anon.request("POST", "/auth/register", {
      expectedStatus: 409,
      body: {
        email: TEST_USERS.alice,
        password: TEST_PASSWORD,
      },
    });
    assert(
      safeCode(res.data) === "EMAIL_ALREADY_EXISTS",
      "duplicate register should return EMAIL_ALREADY_EXISTS",
    );
  }, state);

  await runStep("Login with wrong password returns 401", async () => {
    const res = await anon.request("POST", "/auth/login", {
      expectedStatus: 401,
      body: {
        email: TEST_USERS.alice,
        password: "wrong-password",
      },
    });
    assert(
      safeCode(res.data) === "INVALID_CREDENTIALS",
      "wrong password should return INVALID_CREDENTIALS",
    );
  }, state);

  await runStep("Login with valid password returns 200", async () => {
    const res = await verifier.request("POST", "/auth/login", {
      expectedStatus: 200,
      body: {
        email: TEST_USERS.alice,
        password: TEST_PASSWORD,
      },
    });
    assert(res.data?.user?.id === refs.aliceId, "valid login user mismatch");
  }, state);

  await runStep("/teams unauthenticated returns 401", async () => {
    const res = await anon.request("GET", "/teams", { expectedStatus: 401 });
    assert(
      safeCode(res.data) === "UNAUTHORIZED",
      "unauth /teams should return UNAUTHORIZED",
    );
  }, state);

  await runStep("Alice /auth/me returns authenticated user", async () => {
    const res = await alice.request("GET", "/auth/me", { expectedStatus: 200 });
    assert(res.data?.user?.id === refs.aliceId, "alice /auth/me id mismatch");
  }, state);

  await runStep("AI diagram endpoint requires authentication", async () => {
    const res = await anon.request("POST", "/ai/diagram-to-code/generate", {
      expectedStatus: 401,
      body: {
        texts: ["unauthorized"],
        image: "data:image/png;base64,AA==",
      },
    });
    assert(safeCode(res.data) === "UNAUTHORIZED", "AI should require auth");
  }, state);

  await runStep("AI endpoints honor enabled/disabled mode", async () => {
    const expectedStatus = AI_ENABLED ? 200 : 503;

    const diagram = await alice.request("POST", "/ai/diagram-to-code/generate", {
      expectedStatus,
      body: {
        texts: ["architecture", "gateway", "worker"],
        image: "data:image/png;base64,AA==",
        theme: "light",
      },
    });

    if (AI_ENABLED) {
      assert(typeof diagram.data?.html === "string", "diagram html missing");
      assert(diagram.data.html.length > 0, "diagram html empty");
    } else {
      assert(safeCode(diagram.data) === "AI_DISABLED", "AI disabled code mismatch");
    }

    const stream = await alice.request(
      "POST",
      "/ai/text-to-diagram/chat-streaming",
      {
        expectedStatus,
        body: {
          messages: [
            {
              role: "user",
              content: "Create a simple microservice architecture diagram",
            },
          ],
        },
      },
    );

    if (AI_ENABLED) {
      assert(
        typeof stream.data === "string" && stream.data.includes('"type":"done"'),
        "stream should include done chunk",
      );
    } else {
      assert(safeCode(stream.data) === "AI_DISABLED", "AI disabled code mismatch");
    }
  }, state);

  await runStep("Alice creates personal file", async () => {
    const res = await alice.request("POST", "/files", {
      expectedStatus: 201,
      body: {
        title: "Alice Personal E2E",
        scope: "personal",
        scene: {
          elements: [{ id: "e-1", type: "rectangle", x: 0, y: 0 }],
          appState: { viewBackgroundColor: "#ffffff" },
          files: {},
        },
      },
    });

    refs.personalFileId = res.data?.file?.id;
    refs.personalVersion = res.data?.file?.version;

    assert(!!refs.personalFileId, "personal file id missing");
    assert(refs.personalVersion === 1, "personal file version should start at 1");
    assert(res.data?.file?.teamId === null, "personal file teamId should be null");
  }, state);

  await runStep("Alice reads personal file and updates lastOpenedAt", async () => {
    const beforeList = await alice.request("GET", "/files?scope=personal", {
      expectedStatus: 200,
    });
    const before = findFile(beforeList.data?.files, refs.personalFileId);
    assert(!!before, "personal file missing in list before read");

    await alice.request("GET", `/files/${refs.personalFileId}`, {
      expectedStatus: 200,
    });
    await sleep(100);

    const afterList = await alice.request("GET", "/files?scope=personal", {
      expectedStatus: 200,
    });
    const after = findFile(afterList.data?.files, refs.personalFileId);
    assert(!!after, "personal file missing in list after read");
    assert(!!after.lastOpenedAt, "lastOpenedAt should be populated after read");
  }, state);

  await runStep("Alice saves personal file with optimistic lock", async () => {
    const saveRes = await alice.request("PUT", `/files/${refs.personalFileId}`, {
      expectedStatus: 200,
      body: {
        version: refs.personalVersion,
        title: "Alice Personal E2E v2",
        scene: {
          elements: [{ id: "e-2", type: "ellipse", x: 10, y: 20 }],
          appState: { viewBackgroundColor: "#f8f9fa" },
          files: {},
        },
      },
    });

    refs.personalVersion = saveRes.data?.file?.version;
    assert(refs.personalVersion === 2, "personal file version should bump to 2");

    const conflictRes = await alice.request("PUT", `/files/${refs.personalFileId}`, {
      expectedStatus: 409,
      body: {
        version: 1,
        scene: {
          elements: [],
          appState: {},
          files: {},
        },
      },
    });

    assert(
      safeCode(conflictRes.data) === "VERSION_CONFLICT",
      "stale save should return VERSION_CONFLICT",
    );
    assert(
      Number(conflictRes.data?.currentVersion) === 2,
      "conflict currentVersion should be 2",
    );
  }, state);

  await runStep("Alice favorites personal file and filters favorites", async () => {
    const favRes = await alice.request(
      "PATCH",
      `/files/${refs.personalFileId}/favorite`,
      {
        expectedStatus: 200,
        body: { isFavorite: true },
      },
    );
    assert(favRes.data?.file?.isFavorite === true, "favorite should be true");

    const listRes = await alice.request(
      "GET",
      "/files?scope=personal&favoritesOnly=true",
      {
        expectedStatus: 200,
      },
    );
    const target = findFile(listRes.data?.files, refs.personalFileId);
    assert(!!target, "favorite file should appear in favoritesOnly list");
  }, state);

  await runStep("Alice soft-delete and restore personal file", async () => {
    await alice.request("DELETE", `/files/${refs.personalFileId}`, {
      expectedStatus: 204,
    });

    const defaultList = await alice.request("GET", "/files?scope=personal", {
      expectedStatus: 200,
    });
    assert(
      !findFile(defaultList.data?.files, refs.personalFileId),
      "trashed file should not appear in default list",
    );

    const includeTrashedList = await alice.request(
      "GET",
      "/files?scope=personal&includeTrashed=true",
      {
        expectedStatus: 200,
      },
    );
    assert(
      !!findFile(includeTrashedList.data?.files, refs.personalFileId),
      "trashed file should appear in includeTrashed list",
    );

    await alice.request("POST", `/files/${refs.personalFileId}/restore`, {
      expectedStatus: 200,
    });

    const restoredList = await alice.request("GET", "/files?scope=personal", {
      expectedStatus: 200,
    });
    assert(
      !!findFile(restoredList.data?.files, refs.personalFileId),
      "restored file should appear in default list",
    );
  }, state);

  await runStep("Alice permanently deletes personal file", async () => {
    await alice.request("DELETE", `/files/${refs.personalFileId}`, {
      expectedStatus: 204,
    });
    await alice.request("DELETE", `/files/${refs.personalFileId}/permanent`, {
      expectedStatus: 204,
    });

    const res = await alice.request("GET", `/files/${refs.personalFileId}`, {
      expectedStatus: 404,
    });
    assert(safeCode(res.data) === "FILE_NOT_FOUND", "deleted file should be 404");
  }, state);

  await runStep("Alice creates team and lists members", async () => {
    const createTeam = await alice.request("POST", "/teams", {
      expectedStatus: 201,
      body: { name: `E2E Team ${RUN_ID}` },
    });
    refs.teamId = createTeam.data?.team?.id;
    assert(!!refs.teamId, "team id missing");

    const teamsList = await alice.request("GET", "/teams", { expectedStatus: 200 });
    assert(
      (teamsList.data?.teams || []).some((team) => team.id === refs.teamId),
      "team should appear in list",
    );

    const members = await alice.request("GET", `/teams/${refs.teamId}/members`, {
      expectedStatus: 200,
    });
    assert(
      (members.data?.members || []).some((member) => member.userId === refs.aliceId),
      "owner should appear in member list",
    );
  }, state);

  await runStep("Alice adds bob as member", async () => {
    const res = await alice.request("POST", `/teams/${refs.teamId}/members`, {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.bob,
        role: "member",
      },
    });

    assert(res.data?.member?.userId === refs.bobId, "bob should be added");
    assert(res.data?.member?.role === "member", "bob role should be member");
  }, state);

  await runStep("Bob cannot manage members before promotion", async () => {
    const res = await bob.request("POST", `/teams/${refs.teamId}/members`, {
      expectedStatus: 403,
      body: {
        email: TEST_USERS.charlie,
        role: "member",
      },
    });
    assert(safeCode(res.data) === "FORBIDDEN", "bob should receive FORBIDDEN");
  }, state);

  await runStep("Alice promotes bob to admin", async () => {
    const res = await alice.request(
      "PATCH",
      `/teams/${refs.teamId}/members/${refs.bobId}`,
      {
        expectedStatus: 200,
        body: { role: "admin" },
      },
    );
    assert(res.data?.member?.role === "admin", "bob role should be admin");
  }, state);

  await runStep("Admin bob adds charlie", async () => {
    const res = await bob.request("POST", `/teams/${refs.teamId}/members`, {
      expectedStatus: 201,
      body: {
        email: TEST_USERS.charlie,
        role: "member",
      },
    });
    assert(
      res.data?.member?.userId === refs.charlieId,
      "charlie should be added by admin bob",
    );
  }, state);

  await runStep("Alice creates team file", async () => {
    const res = await alice.request("POST", "/files", {
      expectedStatus: 201,
      body: {
        title: "Team File E2E",
        scope: "team",
        teamId: refs.teamId,
        scene: {
          elements: [{ id: "team-e-1", type: "diamond", x: 1, y: 2 }],
          appState: {},
          files: {},
        },
      },
    });

    refs.teamFileId = res.data?.file?.id;
    refs.teamVersion = res.data?.file?.version;
    assert(!!refs.teamFileId, "team file id missing");
    assert(res.data?.file?.teamId === refs.teamId, "teamId mismatch");
  }, state);

  await runStep("Team file permissions (member allowed / outsider denied)", async () => {
    const bobRead = await bob.request("GET", `/files/${refs.teamFileId}`, {
      expectedStatus: 200,
    });
    assert(bobRead.data?.file?.id === refs.teamFileId, "bob should read team file");

    const daveRead = await dave.request("GET", `/files/${refs.teamFileId}`, {
      expectedStatus: 403,
    });
    assert(safeCode(daveRead.data) === "FORBIDDEN", "dave should be forbidden");
  }, state);

  await runStep("Team file save + version conflict", async () => {
    const saveRes = await bob.request("PUT", `/files/${refs.teamFileId}`, {
      expectedStatus: 200,
      body: {
        version: refs.teamVersion,
        title: "Team File E2E v2",
        scene: {
          elements: [{ id: "team-e-2", type: "line", x: 3, y: 4 }],
          appState: {},
          files: {},
        },
      },
    });

    refs.teamVersion = saveRes.data?.file?.version;
    assert(refs.teamVersion === 2, "team file version should bump to 2");

    const conflictRes = await alice.request("PUT", `/files/${refs.teamFileId}`, {
      expectedStatus: 409,
      body: {
        version: 1,
        scene: {
          elements: [],
          appState: {},
          files: {},
        },
      },
    });

    assert(
      safeCode(conflictRes.data) === "VERSION_CONFLICT",
      "team stale save should return VERSION_CONFLICT",
    );
  }, state);

  await runStep("Team scope trash/restore/favorite/permanent flows", async () => {
    await bob.request("DELETE", `/files/${refs.teamFileId}`, {
      expectedStatus: 204,
    });

    const teamActive = await alice.request(
      "GET",
      `/files?scope=team&teamId=${refs.teamId}`,
      {
        expectedStatus: 200,
      },
    );
    assert(
      !findFile(teamActive.data?.files, refs.teamFileId),
      "trashed team file should not be in active list",
    );

    const teamAll = await alice.request(
      "GET",
      `/files?scope=team&teamId=${refs.teamId}&includeTrashed=true`,
      {
        expectedStatus: 200,
      },
    );
    assert(
      !!findFile(teamAll.data?.files, refs.teamFileId),
      "trashed team file should be in includeTrashed list",
    );

    await alice.request("POST", `/files/${refs.teamFileId}/restore`, {
      expectedStatus: 200,
    });

    await alice.request("PATCH", `/files/${refs.teamFileId}/favorite`, {
      expectedStatus: 200,
      body: { isFavorite: true },
    });

    const teamFavorites = await alice.request(
      "GET",
      `/files?scope=team&teamId=${refs.teamId}&favoritesOnly=true`,
      {
        expectedStatus: 200,
      },
    );
    assert(
      !!findFile(teamFavorites.data?.files, refs.teamFileId),
      "favorite team file should be in favoritesOnly list",
    );

    await alice.request("DELETE", `/files/${refs.teamFileId}`, {
      expectedStatus: 204,
    });
    await alice.request("DELETE", `/files/${refs.teamFileId}/permanent`, {
      expectedStatus: 204,
    });
  }, state);

  await runStep("Remove member and verify access revoked", async () => {
    await alice.request("DELETE", `/teams/${refs.teamId}/members/${refs.charlieId}`, {
      expectedStatus: 204,
    });

    const denied = await charlie.request("GET", `/teams/${refs.teamId}/members`, {
      expectedStatus: 403,
    });
    assert(
      safeCode(denied.data) === "FORBIDDEN",
      "removed member should get FORBIDDEN",
    );
  }, state);

  await runStep("Auth endpoints return 429 when rate limit exceeded", async () => {
    const limited = new Session("limited");
    const forwardedFor = `203.0.113.${Math.floor(Math.random() * 100) + 100}`;
    const headers = {
      "x-forwarded-for": forwardedFor,
    };

    for (let index = 0; index < 10; index += 1) {
      await limited.request("GET", "/auth/me", {
        expectedStatus: 401,
        headers,
      });
    }

    const blocked = await limited.request("GET", "/auth/me", {
      expectedStatus: 429,
      headers,
    });
    assert(safeCode(blocked.data) === "RATE_LIMITED", "rate limit should return RATE_LIMITED");
  }, state);

  await runStep("Logout and verify /auth/me returns 401", async () => {
    await alice.request("POST", "/auth/logout", { expectedStatus: 204 });

    const res = await alice.request("GET", "/auth/me", { expectedStatus: 401 });
    assert(res.data?.user === null, "after logout /auth/me should return user null");
  }, state);

  await runStep("Audit logs are written for key actions", async () => {
    const trackedActions = [
      "AUTH_REGISTER",
      "AUTH_LOGIN",
      "AUTH_LOGOUT",
      "TEAM_MEMBER_ADD",
      "TEAM_MEMBER_ROLE_UPDATE",
      "TEAM_MEMBER_REMOVE",
      "FILE_DELETE_SOFT",
      "FILE_DELETE_PERMANENT",
    ];

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: RUN_STARTED_AT,
        },
        action: {
          in: trackedActions,
        },
        OR: [
          {
            actorUserId: {
              in: [refs.aliceId, refs.bobId, refs.charlieId],
            },
          },
          {
            targetUserId: {
              in: [refs.aliceId, refs.bobId, refs.charlieId],
            },
          },
        ],
      },
      select: {
        action: true,
      },
    });

    const observed = new Set(logs.map((log) => log.action));
    for (const action of trackedActions) {
      assert(observed.has(action), `missing audit action: ${action}`);
    }
  }, state);

    console.log("--- E2E Summary ---");
    console.log(`Passed: ${state.passed}`);
    console.log(`Failed: ${state.failed}`);

    if (state.failed > 0) {
      throw new Error("E2E checklist has failures");
    }
  } finally {
    await stopBackendProcess(procInfo);
    await prisma.$disconnect().catch(() => undefined);
  }
};

main().catch((error) => {
  console.error("E2E execution stopped due to failure.");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  if (lastProcInfo?.output?.length) {
    console.error("--- Backend logs (tail) ---");
    console.error(lastProcInfo.output.join("\n"));
  }
  process.exit(1);
});
