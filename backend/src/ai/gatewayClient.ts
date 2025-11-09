import { setTimeout as delay } from "timers/promises";

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
  const provider = mapProviderSegment(providerSlug);
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

async function safeReadText(response: any): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}

function mapProviderSegment(slug?: string): string {
  const s = normaliseSegment(slug);
  if (!s) return "google-ai-studio";
  if (s === "google") return "google-ai-studio";
  if (s === "google-ai-studio") return "google-ai-studio";
  return s;
}


