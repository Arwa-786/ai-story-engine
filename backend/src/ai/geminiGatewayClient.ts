import { fetch, Response } from "undici";
import { loadEnv } from "../config/env.js";

loadEnv();

export interface GeminiGatewayRequest {
  modelId: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  apiVersion?: string;
  providerSlug?: string;
  baseUrlOverride?: string;
}

const DEFAULT_PROVIDER_SLUG =
  normaliseSegment(process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER) ?? "google";

const DEFAULT_API_VERSION =
  normaliseSegment(process.env.TEXT_AGENT_DEFAULT_API_VERSION) ?? "v1beta";

export async function generateGeminiContentViaGateway(
  request: GeminiGatewayRequest,
): Promise<string> {
  const {
    modelId,
    prompt,
    temperature,
    maxOutputTokens,
    responseMimeType = "application/json",
    apiVersion = DEFAULT_API_VERSION,
    providerSlug = DEFAULT_PROVIDER_SLUG,
    baseUrlOverride,
  } = request;

  const apiKey = normaliseSecret(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    console.error(
      [
        "❌ Cloudflare AI Gateway request aborted: GEMINI_API_KEY is not configured.",
        "   • Set GEMINI_API_KEY in your project .env (Google AI Studio key).",
        "   • If you store secrets elsewhere, ensure they are exported before the backend starts.",
      ].join("\n"),
    );
    throw new Error(
      "Gemini API key missing. Set GEMINI_API_KEY before using the Cloudflare AI Gateway.",
    );
  }

  const baseUrl = resolveGatewayBaseUrl(baseUrlOverride);
  const providerSegment = normaliseSegment(providerSlug) ?? "google";
  const versionSegment = normaliseSegment(apiVersion) ?? "v1beta";
  const modelSegment = `models/${modelId}:generateContent`;

  const url = `${baseUrl}/${providerSegment}/${versionSegment}/${modelSegment}?key=${encodeURIComponent(apiKey)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-goog-api-key": apiKey,
  };

  const gatewayKey = normaliseSecret(process.env.CLOUDFLARE_AI_GATEWAY_KEY);
  if (gatewayKey) {
    headers["CF-AI-GATEWAY-KEY"] = gatewayKey;
  }

  const generationConfig: Record<string, unknown> = {
    responseMimeType,
  };

  if (typeof temperature === "number" && !Number.isNaN(temperature)) {
    generationConfig.temperature = temperature;
  }

  if (
    typeof maxOutputTokens === "number" &&
    Number.isFinite(maxOutputTokens) &&
    maxOutputTokens > 0
  ) {
    generationConfig.maxOutputTokens = maxOutputTokens;
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const diagnostic = await readResponseTextSafely(response);
    logGatewayFailure(response.status, diagnostic);
    throw new Error(
      `Gemini via Cloudflare Gateway failed with status ${response.status}: ${diagnostic}`,
    );
  }

  const payload = (await response.json()) as GeminiGatewayResponse;
  const text = extractCandidateText(payload);

  if (!text) {
    throw new Error(
      "Gemini via Cloudflare Gateway did not return textual content in the first candidate.",
    );
  }

  return text.trim();
}

interface GeminiGatewayResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<
        | { text?: string }
        | {
            [key: string]: unknown;
          }
      >;
    };
  }>;
}

function extractCandidateText(
  payload: GeminiGatewayResponse,
): string | undefined {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }

  let buffer = "";
  for (const part of parts) {
    if (part && typeof part === "object" && "text" in part) {
      const textValue = (part as { text?: string }).text;
      if (typeof textValue === "string") {
        buffer += textValue;
      }
    }
  }

  const trimmed = buffer.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveGatewayBaseUrl(override?: string): string {
  const explicit = normaliseUrl(override);
  if (explicit) {
    return explicit;
  }

  const envBase = normaliseUrl(process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL);
  if (envBase) {
    return envBase;
  }

  const accountId = normaliseSegment(process.env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayId = normaliseSegment(process.env.CLOUDFLARE_AI_GATEWAY_ID);

  if (accountId && gatewayId) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }

  throw new Error(
    "Cloudflare AI Gateway base URL not configured. Set CLOUDFLARE_AI_GATEWAY_BASE_URL or both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_GATEWAY_ID.",
  );
}

function logGatewayFailure(status: number, diagnostic: string): void {
  const header = `❌ Cloudflare AI Gateway request failed → ${status}`;
  console.error(header);
  if (diagnostic && diagnostic !== "<unreadable response body>") {
    console.error(`   ↳ Response: ${diagnostic}`);
  }

  if (status === 401 || status === 403) {
    console.error(
      [
        "   Troubleshooting:",
        "   • Confirm GEMINI_API_KEY is valid and enabled for the requested Gemini model.",
        "   • If your gateway enforces keys, set CLOUDFLARE_AI_GATEWAY_KEY.",
        "   • Verify the gateway policy allows access to the requested model.",
      ].join("\n"),
    );
  } else if (status === 404) {
    console.error(
      [
        "   Troubleshooting:",
        "   • Ensure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_GATEWAY_ID (or BASE_URL) point to an existing gateway.",
        "   • Check the provider slug/model path for typos.",
      ].join("\n"),
    );
  } else if (status === 429) {
    console.error(
      [
        "   Troubleshooting:",
        "   • Gateway or Gemini quota exhausted. Review usage in Cloudflare dashboard.",
        "   • Increase limits or reduce request rate.",
      ].join("\n"),
    );
  }
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

async function readResponseTextSafely(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}


