/**
 * The backend wraps every REST response in {success, status_code, message}.
 * `message` carries the payload on success and the error on failure.
 */
export type Envelope<T = unknown> = {
  success: boolean;
  status_code: number;
  message: T;
};

function isEnvelope(body: unknown): body is Envelope {
  return typeof body === "object" && body !== null && "success" in body && "message" in body;
}

/** Read a response body and return the payload inside the envelope. */
export async function unwrap<T = unknown>(res: Response): Promise<T | null> {
  const body = await res.json().catch(() => null);
  return (isEnvelope(body) ? body.message : body) as T | null;
}

/** Error text from a failed response, falling back to `fallback`. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const message = await unwrap(res);
  return typeof message === "string" ? message : fallback;
}
