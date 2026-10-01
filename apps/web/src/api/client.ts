import { tr } from "@/i18n";

/** Minimal JSON client for the app's own API (same origin, session cookie). */

export class ApiError extends Error {
  /** `message` is shown to the user: the server's English text, translated when the dictionary knows it. */
  constructor(public status: number, public serverMessage: string) { super(tr().serverErrors[serverMessage] ?? serverMessage); }
}
/** No connection (offline, server unreachable). */
export class NetworkError extends Error {
  constructor() { super("No connection"); }
}

export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return data as T;
}
