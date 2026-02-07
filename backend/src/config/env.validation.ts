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
  };
};

