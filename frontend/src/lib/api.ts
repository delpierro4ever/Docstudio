// The Express gateway (backend/, port 4000) is the single entry point for
// the frontend; it proxies formatting work to the Python formatter-service
// on :8082. By default the browser reaches it through this app's own
// /backend rewrite (see next.config.ts), so it works from any host name.
// Set NEXT_PUBLIC_API_BASE to call a gateway directly instead.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/backend";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * The session expired or was never there: drop the local sign-in hint and
 * send the user to the login page.
 */
export function handleUnauthorized() {
  localStorage.removeItem("userId");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/** fetch() against the API with the session cookie; redirects on 401. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    handleUnauthorized();
  }
  return res;
}

/** Link target that downloads a formatted document (session cookie auth). */
export function downloadUrl(jobId: string): string {
  return `${API_BASE}/documents/${encodeURIComponent(jobId)}/download`;
}

/** The `error` message from a JSON error response, if any. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error || fallback;
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiOptions = {}
): Promise<TResponse> {
  const { method = "GET", body, headers = {} } = options;

  const finalHeaders: Record<string, string> = {
    ...headers,
  };

  const fetchOptions: RequestInit = {
    method,
    headers: finalHeaders,
  };

  if (body instanceof FormData) {
    // Let the browser set Content-Type for FormData
    delete finalHeaders["Content-Type"];
    fetchOptions.body = body;
  } else if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await apiFetch(path, fetchOptions);

  if (!res.ok) {
    throw new Error(await errorMessage(res, "Something went wrong. Please try again."));
  }

  // If there is no body (204, etc.), avoid JSON parse error
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    // @ts-expect-error allow void when caller doesn't care about response
    return undefined;
  }

  return (await res.json()) as TResponse;
}
