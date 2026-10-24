import { AppError } from "@bebranded/elearning-core";

import type { CloudflareStreamConfig } from "./config.js";
import { envelopeSchema } from "./video.schemas.js";

const API_BASE = "https://api.cloudflare.com/client/v4/accounts";

export type StreamRequest = {
  readonly method: "GET" | "POST" | "DELETE";
  /** Path below `/accounts/{account_id}/stream`, starting with `/` or `?`, or empty. */
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
};

export function upstream(code: string, message: string, cause?: unknown): AppError {
  return new AppError("upstream", code, message, { cause });
}

export async function send(
  config: CloudflareStreamConfig,
  request: StreamRequest,
): Promise<Response> {
  const url = `${API_BASE}/${config.accountId}/stream${request.path}`;
  try {
    return await (config.fetch ?? fetch)(url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        ...request.headers,
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw upstream("video_provider_timeout", "Cloudflare Stream did not answer in time.", error);
    throw upstream("video_provider_unavailable", "Cloudflare Stream could not be reached.", error);
  }
}

/**
 * One typed call to the Stream API (modules/integrations): bearer token,
 * timeout, envelope validation. Failures become `upstream` errors whose
 * messages never include the token or the response body.
 */
export async function streamApi(
  config: CloudflareStreamConfig,
  request: StreamRequest,
): Promise<unknown> {
  const response = await send(config, request);
  const json: unknown = await response.json().catch(() => null);
  const envelope = envelopeSchema.safeParse(json);
  if (!response.ok || !envelope.success || !envelope.data.success) {
    throw upstream(
      response.status === 404 ? "video_asset_not_found" : "video_provider_error",
      `Cloudflare Stream answered ${response.status} to ${request.method} ${request.path || "/"}.`,
    );
  }
  return envelope.data.result;
}
