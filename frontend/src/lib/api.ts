// The Express gateway (backend/, port 4000) is the single entry point for
// the frontend; it proxies formatting work to the Python formatter-service
// on :8082. (:8000 was the dead python_backend prototype nothing serves.)
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
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

  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API error");
  }

  // If there is no body (204, etc.), avoid JSON parse error
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    // @ts-expect-error allow void when caller doesn't care about response
    return undefined;
  }

  return (await res.json()) as TResponse;
}
