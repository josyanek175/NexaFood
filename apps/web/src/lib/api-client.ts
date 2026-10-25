export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export type ApiClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  /** Reserved for future cookie/session auth. */
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
};

function resolveBaseUrl(explicit?: string): string {
  const fromEnv = explicit ?? import.meta.env["VITE_API_BASE_URL"];
  if (!fromEnv || String(fromEnv).trim() === "") {
    throw new ApiClientError(
      "VITE_API_BASE_URL não está configurada. Defina a URL da API (ex.: http://localhost:3333).",
      0,
      "API_BASE_URL_MISSING",
    );
  }
  return String(fromEnv).replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalized}`;
}

async function parseError(response: Response): Promise<ApiClientError> {
  let message = `Falha na API (${response.status})`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    if (body.error?.message) message = body.error.message;
    else if (body.message) message = body.message;
    if (body.error?.code) code = body.error.code;
  } catch {
    /* ignore non-JSON error bodies */
  }
  return new ApiClientError(message, response.status, code);
}

export function createApiClient(options: ApiClientOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(joinUrl(baseUrl, path), {
        ...init,
        credentials,
        signal: init.signal ?? controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });

      if (!response.ok) throw await parseError(response);

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiClientError("Tempo esgotado ao falar com a API.", 0, "API_TIMEOUT");
      }
      throw new ApiClientError(
        "Não foi possível conectar à API. Verifique se ela está em execução.",
        0,
        "API_NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "POST",
        body: body === undefined ? null : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "PATCH",
        body: body === undefined ? null : JSON.stringify(body),
      }),
  };
}

export const apiClient = createApiClient();
