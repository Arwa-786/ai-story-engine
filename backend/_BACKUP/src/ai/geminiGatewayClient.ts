import { fetch, Response } from "undici";
import { loadEnv } from "../config/env.js";

loadEnv();

export interface GeminiGatewayRequest {
  modelId: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  apiVersion?: string; // unused in compat
  providerSlug?: string; // compat provider namespace, e.g. "google-ai-studio"
  baseUrlOverride?: string;
}

const DEFAULT_COMPAT_PROVIDER_SLUG =
  normaliseSegment(process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER) ?? "google-ai-studio";

export async function generateGeminiContentViaGateway(
  request: GeminiGatewayRequest,
): Promise<string> {
  const { modelId, prompt, temperature, maxOutputTokens, providerSlug = DEFAULT_COMPAT_PROVIDER_SLUG, baseUrlOverride } = request;

  // COMPAT MODE (OpenAI-style) using Cloudflare Gateway token only
  const cfToken = normaliseSecret(process.env.CLOUDFLARE_API_KEY);
  if (!cfToken) {
    throw new Error("CLOUDFLARE_API_KEY is required to call Cloudflare AI Gateway compat endpoint.");
  }

  const baseRoot = resolveGatewayBaseUrl(baseUrlOverride);
  const compatBase = `${baseRoot}/compat`;
  const modelSlug = `${normaliseSegment(providerSlug) ?? "google-ai-studio"}/${modelId}`;
  const url = `${compatBase}/v1/chat/completions`;

  console.log(`\n🔄 Cloudflare Gateway Request:`);
  console.log(`   URL: ${url}`);
  console.log(`   Model: ${modelSlug}`);
  console.log(`   Provider (compat): ${providerSlug}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${cfToken}`,
  };

  // OpenAI compat schema
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
  if (typeof maxOutputTokens === "number" && Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
    body.max_tokens = maxOutputTokens;
  }

  console.log(`   Request Body Size: ${JSON.stringify(body).length} bytes`);
  console.log(`   Prompt Preview: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

  const startTime = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const duration = Date.now() - startTime;

  console.log(`\n📊 Cloudflare Gateway Response:`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Duration: ${duration}ms`);

  if (!response.ok) {
    const diagnostic = await readResponseTextSafely(response);
    console.log(`\n❌ CLOUDFLARE GATEWAY ERROR DETAILS:`);
    console.log(`   Full URL: ${url}`);
    console.log(`   Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`   Response Body: ${diagnostic}`);
    
    logGatewayFailure(response.status, diagnostic);
    throw new Error(
      `Cloudflare Gateway (compat) failed with status ${response.status}: ${diagnostic}`,
    );
  }

  const responseText = await response.text();
  console.log(`   Response Size: ${responseText.length} bytes`);
  console.log(`   Response Preview: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
  
  let payload: OpenAICompatResponse;
  try {
    payload = JSON.parse(responseText) as OpenAICompatResponse;
  } catch (parseError) {
    console.error(`\n❌ JSON Parse Error:`, parseError);
    console.error(`   Raw Response: ${responseText}`);
    throw new Error(`Failed to parse Cloudflare Gateway (compat) response as JSON: ${parseError}`);
  }
  
  const text = extractCompatText(payload);

  if (!text) {
    console.error(`\n❌ No text content found in response`);
    console.error(`   Full Payload:`, JSON.stringify(payload, null, 2));
    throw new Error(
      "Cloudflare Gateway (compat) did not return textual content in the first choice.",
    );
  }

  console.log(`   ✅ Successfully extracted text: ${text.length} characters`);
  return text.trim();
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

function extractCompatText(
  payload: OpenAICompatResponse,
): string | undefined {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  return undefined;
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
  const header = `\n❌ CLOUDFLARE AI GATEWAY REQUEST FAILED`;
  console.error("━".repeat(80));
  console.error(header);
  console.error("━".repeat(80));
  
  console.error(`\nSTATUS: ${status}`);
  console.error(`TIME: ${new Date().toISOString()}`);
  
  if (diagnostic && diagnostic !== "<unreadable response body>") {
    console.error(`\nRESPONSE BODY:`);
    console.error("─".repeat(40));
    console.error(diagnostic);
    console.error("─".repeat(40));
  }

  console.error(`\nERROR ANALYSIS:`);
  
  if (status === 401 || status === 403) {
    console.error("🔐 AUTHENTICATION/AUTHORIZATION ERROR");
    console.error("   • Check CLOUDFLARE_API_KEY is valid for your Gateway");
    console.error("   • If using CF-AI-GATEWAY-KEY, ensure it's correctly configured");
    console.error("   • Check Cloudflare Gateway access policies");
  } else if (status === 404) {
    console.error("🔗 ENDPOINT NOT FOUND");
    console.error("   • Verify CLOUDFLARE_ACCOUNT_ID is correct");
    console.error("   • Verify CLOUDFLARE_AI_GATEWAY_ID matches your gateway");
    console.error("   • Check if the model path is correct");
    console.error("   • Ensure the gateway endpoint exists in Cloudflare dashboard");
  } else if (status === 429) {
    console.error("⏱️  RATE LIMIT / QUOTA EXCEEDED");
    console.error("   • Check Cloudflare Gateway usage limits");
    console.error("   • Consider implementing request throttling");
    console.error("   • Upgrade your plan if needed");
  } else if (status === 400) {
    console.error("📝 BAD REQUEST");
    console.error("   • Check request format matches OpenAI compat requirements");
    console.error("   • Verify model slug is valid (e.g., google-ai-studio/gemini-1.5-pro-latest)");
    console.error("   • Check if request body is properly formatted");
  } else if (status === 500 || status === 502 || status === 503) {
    console.error("🔥 GATEWAY/SERVER ERROR");
    console.error("   • Cloudflare Gateway or upstream service error");
    console.error("   • Try again in a few moments");
    console.error("   • Check Cloudflare status page");
  } else {
    console.error("❓ UNEXPECTED ERROR");
    console.error(`   • HTTP ${status} is not a typical AI Gateway response`);
    console.error("   • Check Cloudflare Gateway logs for more details");
  }
  
  console.error("\nCURRENT CONFIGURATION:");
  console.error(`   CLOUDFLARE_ACCOUNT_ID: ${process.env.CLOUDFLARE_ACCOUNT_ID || 'NOT SET'}`);
  console.error(`   CLOUDFLARE_AI_GATEWAY_ID: ${process.env.CLOUDFLARE_AI_GATEWAY_ID || 'NOT SET'}`);
  console.error(`   CLOUDFLARE_API_KEY: ${process.env.CLOUDFLARE_API_KEY ? '***' + process.env.CLOUDFLARE_API_KEY.slice(-4) : 'NOT SET'}`);
  console.error(`   CLOUDFLARE_AI_GATEWAY_KEY: ${process.env.CLOUDFLARE_AI_GATEWAY_KEY ? 'SET' : 'NOT SET'}`);
  
  console.error("━".repeat(80));
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


