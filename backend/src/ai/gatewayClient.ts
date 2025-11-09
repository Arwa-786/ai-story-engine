import { setTimeout as delay } from "timers/promises";

export interface GatewayTextRequest {
  modelId: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  providerSlug?: string; // e.g., "google-ai-studio"
  baseUrlOverride?: string; // fully-qualified base URL; if omitted, resolved from env
}

export interface GatewayTextResponse {
  text: string;
}

export interface GoogleDirectTextRequest {
  modelId: string;
  text: string;
  apiVersion?: string; // e.g. "v1" or "v1beta"
  providerSlug?: string; // defaults to "google-ai-studio"
  baseUrlOverride?: string;
  xGoogApiKey?: string; // if omitted, taken from process.env.GEMINI_API_KEY
  cfGatewayToken?: string; // if omitted, taken from process.env.CLOUDFLARE_API_KEY
}

/**
 * Calls Cloudflare AI Gateway using the OpenAI-compatible chat completions endpoint.
 * Assumes the gateway is configured to route to the provider specified by providerSlug.
 */
export async function generateTextViaCloudflareGateway(
  request: GatewayTextRequest,
): Promise<GatewayTextResponse> {
  const {
    modelId,
    prompt,
    temperature,
    maxOutputTokens,
    providerSlug = normaliseSegment(process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER) ?? "google",
    baseUrlOverride,
  } = request;

  const cfToken = normaliseSecret(process.env.CLOUDFLARE_API_KEY);
  if (!cfToken) {
    throw new Error("CLOUDFLARE_API_KEY is required to call Cloudflare AI Gateway compat endpoint.");
  }

  const baseRoot = resolveGatewayBaseUrl(baseUrlOverride);
  const compatBase = `${baseRoot}/compat`;
  const modelSlug = `${normaliseSegment(providerSlug) ?? "google"}/${modelId}`;
  const url = `${compatBase}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${cfToken}`,
  };

  const body: Record<string, unknown> = {
    model: modelSlug,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  if (typeof temperature === "number" && !Number.isNaN(temperature)) {
    body.temperature = temperature;
  }
  if (
    typeof maxOutputTokens === "number" &&
    Number.isFinite(maxOutputTokens) &&
    maxOutputTokens > 0
  ) {
    body.max_tokens = maxOutputTokens;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Retry briefly on transient gateway errors
  if (!response.ok && isTransient(response.status)) {
    await delay(150);
    const retry = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!retry.ok) {
      const errText = await safeReadText(retry);
      throw new Error(`Cloudflare Gateway error ${retry.status}: ${errText}`);
    }
    return { text: extractCompatText(await retry.json()) ?? "" };
  }

  if (!response.ok) {
    const errText = await safeReadText(response);
    throw new Error(`Cloudflare Gateway error ${response.status}: ${errText}`);
  }

  const payload = (await response.json()) as OpenAICompatResponse;
  const text = extractCompatText(payload);
  if (!text) {
    throw new Error("Cloudflare Gateway did not return text content.");
  }
  return { text: text.trim() };
}

/**
 * Calls Cloudflare AI Gateway "provider direct" endpoint for Google AI Studio.
 * Mirrors the working curl:
 * curl "https://gateway.ai.cloudflare.com/v1/<ACCOUNT>/<GATEWAY>/google-ai-studio/v1/models/<MODEL>:generateContent"
 *   -H "Content-Type: application/json"
 *   -H "x-goog-api-key: <GEMINI_API_KEY>"
 *   -H "cf-aig-authorization: Bearer <CLOUDFLARE_API_KEY>"
 *   -d '{"contents":[{"role":"user","parts":[{"text":"..."}]}]}'
 */
export async function generateTextViaCloudflareGoogleDirect(
  request: GoogleDirectTextRequest,
): Promise<GatewayTextResponse> {
  const {
    modelId,
    text,
    apiVersion,
    providerSlug = "google-ai-studio",
    baseUrlOverride,
    xGoogApiKey = process.env.GEMINI_API_KEY?.trim(),
    cfGatewayToken = process.env.CLOUDFLARE_API_KEY?.trim(),
  } = request;

  if (!xGoogApiKey) {
    throw new Error("GEMINI_API_KEY is required for Google direct endpoint via Cloudflare Gateway.");
  }
  if (!cfGatewayToken) {
    throw new Error("CLOUDFLARE_API_KEY (Gateway token) is required for Cloudflare Gateway.");
  }

  const version = apiVersion?.trim() || "v1";
  const baseRoot = resolveGatewayBaseUrl(baseUrlOverride);
  const provider = normaliseSegment(providerSlug) ?? "google-ai-studio";
  const url = `${baseRoot}/${provider}/${version}/models/${modelId}:generateContent`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-goog-api-key": xGoogApiKey,
    "cf-aig-authorization": `Bearer ${cfGatewayToken}`,
  };

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text }],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await safeReadText(response);
    throw new Error(`Cloudflare Gateway (google direct) error ${response.status}: ${errText}`);
  }

  const payload = (await response.json()) as GoogleDirectResponse;
  const extracted = extractGoogleText(payload);
  if (!extracted) {
    throw new Error("Cloudflare Gateway (google direct) returned no text content.");
  }
  return { text: extracted.trim() };
}

interface GoogleDirectResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
      role?: string;
    };
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: unknown;
  modelVersion?: string;
  responseId?: string;
}

function extractGoogleText(payload: GoogleDirectResponse): string | undefined {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return undefined;
  const texts = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter((t) => t && t.trim().length > 0);
  if (texts.length === 0) return undefined;
  return texts.join("\n").trim();
}

interface OpenAICompatResponse {
  id?: string;
  choices?: Array<{
    index?: number;
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  usage?: unknown;
}

function extractCompatText(payload: OpenAICompatResponse): string | undefined {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  return undefined;
}

function resolveGatewayBaseUrl(override?: string): string {
  const explicit = normaliseUrl(override);
  if (explicit) return explicit;

  const envBase = normaliseUrl(process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL);
  if (envBase) return envBase;

  const accountId = normaliseSegment(process.env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayId = normaliseSegment(process.env.CLOUDFLARE_AI_GATEWAY_ID);
  if (accountId && gatewayId) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }

  throw new Error(
    "Cloudflare AI Gateway base URL not configured. Set CLOUDFLARE_AI_GATEWAY_BASE_URL or both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_GATEWAY_ID.",
  );
}

function normaliseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.replace(/\/+$/, "");
}

function normaliseSegment(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseSecret(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isTransient(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}


