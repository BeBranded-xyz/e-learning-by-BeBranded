/** An error answered by the module's API, with its stable code (spec 04, "Errors"). */
export class ElearningApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = "ElearningApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function isErrorBody(value: unknown): value is { error: { code: string; message: string } } {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/** Builds the error from any failed response, even one that is not our envelope (a proxy page). */
export async function toApiError(response: Response): Promise<ElearningApiError> {
  const requestId = response.headers.get("x-request-id");
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body))
    return new ElearningApiError(response.status, body.error.code, body.error.message, requestId);
  return new ElearningApiError(
    response.status,
    "unexpected_response",
    `Unexpected response (${response.status})`,
    requestId,
  );
}
