import type { ResolvedOptions } from "../config.js";
import { httpErrors } from "../http/http-error.js";
import { json } from "../http/responses.js";

export const VIDEO_WEBHOOK_PATH = "/v1/webhooks/video";

/**
 * POST /v1/webhooks/video: the provider reports an asset's processing state
 * (spec 06, "Upload", step 4). Authenticated by the provider's signature, not
 * by a learner session. Any verified event is acknowledged with 200 so the
 * provider stops retrying, including events for assets the module ignores.
 */
export async function handleVideoWebhook(
  request: Request,
  options: ResolvedOptions,
  requestId: string,
): Promise<Response> {
  const provider = options.video;
  if (provider === null) throw httpErrors.notFound();
  if (request.method !== "POST") throw httpErrors.methodNotAllowed();
  const event = await provider.verifyWebhook(request);
  if (event === null) {
    // A forged or replayed webhook is a security event, not routine noise (core/security.mdc).
    options.logger.error("video webhook signature rejected", { requestId });
    throw httpErrors.invalidSignature();
  }
  const asset = await options.storage.transaction((tx) =>
    tx.applyVideoWebhook(provider.name, event),
  );
  if (asset === null) {
    options.logger.warn("video webhook ignored", { requestId, assetId: event.assetId });
  }
  return json({ received: true }, requestId);
}
