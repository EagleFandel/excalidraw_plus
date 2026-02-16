type RawEnv = Record<string, unknown>;

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  throw new Error(`Invalid boolean value: ${String(value)}`);
};

const parseNumber = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    throw new Error(`Invalid number value: ${String(value)}`);
  }

  return numberValue;
};

export const validateEnv = (raw: RawEnv) => {
  if (!raw.DATABASE_URL || typeof raw.DATABASE_URL !== "string") {
    throw new Error("DATABASE_URL is required");
  }

  if (!raw.JWT_SECRET || typeof raw.JWT_SECRET !== "string") {
    throw new Error("JWT_SECRET is required");
  }

  const authCookieSameSite =
    typeof raw.AUTH_COOKIE_SAME_SITE === "string" && raw.AUTH_COOKIE_SAME_SITE
      ? raw.AUTH_COOKIE_SAME_SITE
      : "lax";

  if (!["lax", "strict", "none"].includes(authCookieSameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be one of lax|strict|none");
  }

  const aiProvider =
    typeof raw.AI_PROVIDER === "string" && raw.AI_PROVIDER
      ? raw.AI_PROVIDER
      : "openai-compatible";

  if (!["openai-compatible"].includes(aiProvider)) {
    throw new Error("AI_PROVIDER must be one of openai-compatible");
  }

  return {
    ...raw,
    PORT: parseNumber(raw.PORT, 3005),
    BACKEND_PORT: parseNumber(raw.BACKEND_PORT, parseNumber(raw.PORT, 3005)),
    BACKEND_HOST:
      typeof raw.BACKEND_HOST === "string" && raw.BACKEND_HOST
        ? raw.BACKEND_HOST
        : "0.0.0.0",
    JWT_EXPIRES_IN:
      typeof raw.JWT_EXPIRES_IN === "string" && raw.JWT_EXPIRES_IN
        ? raw.JWT_EXPIRES_IN
        : "7d",
    AUTH_COOKIE_NAME:
      typeof raw.AUTH_COOKIE_NAME === "string" && raw.AUTH_COOKIE_NAME
        ? raw.AUTH_COOKIE_NAME
        : "excplus-auth",
    AUTH_COOKIE_SECURE: parseBoolean(raw.AUTH_COOKIE_SECURE, false),
    AUTH_COOKIE_SAME_SITE: authCookieSameSite,
    AUTH_COOKIE_DOMAIN:
      typeof raw.AUTH_COOKIE_DOMAIN === "string" ? raw.AUTH_COOKIE_DOMAIN : "",
    CORS_ORIGIN:
      typeof raw.CORS_ORIGIN === "string" && raw.CORS_ORIGIN
        ? raw.CORS_ORIGIN
        : "http://localhost:3001",
    CSRF_COOKIE_NAME:
      typeof raw.CSRF_COOKIE_NAME === "string" && raw.CSRF_COOKIE_NAME
        ? raw.CSRF_COOKIE_NAME
        : "excplus-csrf",
    CSRF_HEADER_NAME:
      typeof raw.CSRF_HEADER_NAME === "string" && raw.CSRF_HEADER_NAME
        ? raw.CSRF_HEADER_NAME.toLowerCase()
        : "x-csrf-token",
    THROTTLE_TTL: parseNumber(raw.THROTTLE_TTL, 60),
    THROTTLE_LIMIT: parseNumber(raw.THROTTLE_LIMIT, 120),
    AUTH_THROTTLE_TTL: parseNumber(raw.AUTH_THROTTLE_TTL, 60),
    AUTH_THROTTLE_LIMIT: parseNumber(raw.AUTH_THROTTLE_LIMIT, 10),
    METRICS_ENABLED: parseBoolean(raw.METRICS_ENABLED, false),
    COLLAB_MAX_SCENE_BYTES: parseNumber(
      raw.COLLAB_MAX_SCENE_BYTES,
      2 * 1024 * 1024,
    ),
    COLLAB_MAX_FILE_BYTES: parseNumber(
      raw.COLLAB_MAX_FILE_BYTES,
      4 * 1024 * 1024,
    ),
    AI_ENABLED: parseBoolean(raw.AI_ENABLED, false),
    AI_PROVIDER: aiProvider,
    AI_BASE_URL:
      typeof raw.AI_BASE_URL === "string" && raw.AI_BASE_URL
        ? raw.AI_BASE_URL
        : "",
    AI_API_KEY:
      typeof raw.AI_API_KEY === "string" && raw.AI_API_KEY
        ? raw.AI_API_KEY
        : "",
    AI_TEXT_TO_DIAGRAM_MODEL:
      typeof raw.AI_TEXT_TO_DIAGRAM_MODEL === "string" &&
      raw.AI_TEXT_TO_DIAGRAM_MODEL
        ? raw.AI_TEXT_TO_DIAGRAM_MODEL
        : "gpt-4.1-mini",
    AI_DIAGRAM_TO_CODE_MODEL:
      typeof raw.AI_DIAGRAM_TO_CODE_MODEL === "string" &&
      raw.AI_DIAGRAM_TO_CODE_MODEL
        ? raw.AI_DIAGRAM_TO_CODE_MODEL
        : "gpt-4.1-mini",
    AI_TIMEOUT_MS: parseNumber(raw.AI_TIMEOUT_MS, 45_000),
    AI_THROTTLE_TTL: parseNumber(raw.AI_THROTTLE_TTL, 60),
    AI_THROTTLE_LIMIT_PER_IP: parseNumber(raw.AI_THROTTLE_LIMIT_PER_IP, 30),
    AI_THROTTLE_LIMIT_PER_USER: parseNumber(raw.AI_THROTTLE_LIMIT_PER_USER, 20),
  };
};
