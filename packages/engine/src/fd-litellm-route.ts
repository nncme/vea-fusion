/**
 * E1 — FD-local LiteLLM route (flag-gated).
 *
 * When the env flag `VEA_LLM_ROUTE_FD=1` is set, all autonomous agent
 * sessions created via `createFnAgent` are pinned to the FD-local LiteLLM
 * gateway (Tier-0, $0 local inference) instead of api.anthropic.com /
 * openrouter.ai. Invariant INV-1: NEVER Claude Max — default to FD-local.
 *
 * Default OFF: when the flag is unset/not "1", every export here is inert
 * and live behavior is byte-identical to upstream.
 *
 * Mechanism: registers a dynamic OpenAI-compatible provider ("fd-litellm")
 * on the pi ModelRegistry pointing at the LiteLLM baseUrl, with the API key
 * resolved at request time from the macOS Keychain via pi's "!command"
 * config-value resolution (no key value ever written to disk or env).
 */
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
import { piLog } from "./logger.js";

/** Provider name registered on the pi ModelRegistry for the FD route. */
export const FD_PROVIDER = "fd-litellm";

/** LiteLLM gateway base URL (OpenAI-compatible). Override via env if needed. */
export const FD_BASE_URL =
  process.env.VEA_LLM_FD_BASE_URL?.trim() ||
  "http://cnnseq12-litellm.barb-opah.ts.net:4000/v1";

/**
 * Tier-0 local default model id (LiteLLM alias). Verified live to route to
 * FD ollama (qwen2.5-coder:32b). NEVER a Claude Max / cloud id.
 */
export const FD_DEFAULT_MODEL_ID =
  process.env.VEA_LLM_FD_MODEL?.trim() || "fw-coding-32k";

/** Tier-0 local fallback model id (also FD ollama). */
export const FD_FALLBACK_MODEL_ID =
  process.env.VEA_LLM_FD_FALLBACK_MODEL?.trim() || "fw-moe-nothink";

/**
 * Keychain item that holds the LiteLLM master key. Resolved lazily by pi via
 * the leading "!" → shell-command config-value resolution; the value is never
 * materialized in this process's env or on disk.
 */
const FD_API_KEY_COMMAND =
  process.env.VEA_LLM_FD_API_KEY_CMD?.trim() ||
  "!security find-generic-password -s beelink-litellm-master-key -w";

/** True when the FD route flag is enabled. Default OFF. */
export function isFdRouteEnabled(): boolean {
  return process.env.VEA_LLM_ROUTE_FD === "1";
}

/** Model ids we expose on the FD provider (default + fallback, deduped). */
function fdModelIds(): string[] {
  return Array.from(new Set([FD_DEFAULT_MODEL_ID, FD_FALLBACK_MODEL_ID]));
}

/**
 * Register the FD-local LiteLLM provider on the given ModelRegistry.
 * No-op when the flag is OFF. Safe to call repeatedly (idempotent re-register).
 */
export function registerFdProvider(modelRegistry: ModelRegistry): void {
  if (!isFdRouteEnabled()) {
    return;
  }
  try {
    modelRegistry.registerProvider(FD_PROVIDER, {
      baseUrl: FD_BASE_URL,
      apiKey: FD_API_KEY_COMMAND,
      api: "openai-completions",
      models: fdModelIds().map((id) => ({
        id,
        name: id,
        reasoning: false,
        input: ["text"] as ("text" | "image")[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32768,
        maxTokens: 8192,
      })),
    });
    modelRegistry.refresh();
    piLog.log(
      `[fd-route] VEA_LLM_ROUTE_FD=1 — registered provider "${FD_PROVIDER}" ` +
        `(baseUrl=${FD_BASE_URL}, default=${FD_DEFAULT_MODEL_ID})`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    piLog.error(`[fd-route] failed to register FD provider: ${msg}`);
  }
}

/**
 * Given the caller's requested provider/model, return the FD-pinned override
 * when the flag is ON; otherwise return the inputs unchanged.
 *
 * INV-1: when ON we force the FD provider + a Tier-0 local model id and NEVER
 * pass through an anthropic/openrouter selection.
 */
export function applyFdModelOverride(
  provider: string | undefined,
  modelId: string | undefined,
): { provider: string | undefined; modelId: string | undefined } {
  if (!isFdRouteEnabled()) {
    return { provider, modelId };
  }
  // If caller already asked for an FD-provider model id we know about, keep it.
  if (provider === FD_PROVIDER && modelId && fdModelIds().includes(modelId)) {
    return { provider, modelId };
  }
  return { provider: FD_PROVIDER, modelId: FD_DEFAULT_MODEL_ID };
}
