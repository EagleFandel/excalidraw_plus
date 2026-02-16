const CSRF_API_BASE =
  import.meta.env.VITE_APP_AUTH_API_URL ||
  import.meta.env.VITE_APP_FILES_API_URL ||
  "";

const DEFAULT_CSRF_HEADER_NAME = "x-csrf-token";

let csrfTokenCache: string | null = null;
let pendingCsrfFetch: Promise<string> | null = null;

export const getCsrfHeaderName = () => {
  return import.meta.env.VITE_APP_CSRF_HEADER_NAME || DEFAULT_CSRF_HEADER_NAME;
};

const isMutationMethod = (method?: string) => {
  const normalized = (method || "GET").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalized);
};

export const clearCsrfToken = () => {
  csrfTokenCache = null;
  pendingCsrfFetch = null;
};

export const ensureCsrfToken = async () => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (pendingCsrfFetch) {
    return pendingCsrfFetch;
  }

  pendingCsrfFetch = fetch(`${CSRF_API_BASE}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch CSRF token");
      }

      const payload = (await response.json()) as { csrfToken?: string };
      if (!payload?.csrfToken) {
        throw new Error("Invalid CSRF token response");
      }

      csrfTokenCache = payload.csrfToken;
      return payload.csrfToken;
    })
    .finally(() => {
      pendingCsrfFetch = null;
    });

  return pendingCsrfFetch;
};

export const fetchWithCsrf = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const method = init?.method || "GET";
  const headers = new Headers(init?.headers || undefined);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (isMutationMethod(method)) {
    const csrfToken = await ensureCsrfToken();
    headers.set(getCsrfHeaderName(), csrfToken);
  }

  return fetch(path, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
};
