import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GoogleLibRequest {
  modelId: string;
  prompt: string;
  baseUrlRoot?: string | undefined; // e.g. https://gateway.ai.cloudflare.com/v1/<ACCOUNT>/<GATEWAY>
  providerSlug?: string; // defaults to "google-ai-studio"
  googleApiKey?: string; // GEMINI_API_KEY
  cfGatewayToken?: string; // CLOUDFLARE_API_KEY
}

export interface GoogleLibResponse {
  text: string;
}

export async function generateTextViaGoogleLib(
  request: GoogleLibRequest,
): Promise<GoogleLibResponse> {
  const {
    modelId,
    prompt,
    baseUrlRoot = process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim() || resolveBaseRootFromIds(),
    providerSlug = "google-ai-studio",
    googleApiKey = process.env.GEMINI_API_KEY?.trim(),
    cfGatewayToken = process.env.CLOUDFLARE_API_KEY?.trim(),
  } = request;

  if (!googleApiKey) {
    throw new Error("GEMINI_API_KEY is required to use @google/generative-ai via Cloudflare Gateway.");
  }
  if (!cfGatewayToken) {
    throw new Error("CLOUDFLARE_API_KEY (Gateway token) is required to use Cloudflare Gateway.");
  }

  const provider = (providerSlug || "google-ai-studio").replace(/^\/+|\/+$/g, "");
  const baseUrl = `${baseUrlRoot.replace(/\/+$/g, "")}/${provider}`;

  const genAI = new GoogleGenerativeAI(googleApiKey);

  // The library accepts per-model options where we can set baseUrl and extra headers.
  // Cast to any to avoid tight coupling to library's evolving types.
  const model = genAI.getGenerativeModel(
    { model: modelId },
    {
      baseUrl,
      headers: {
        "cf-aig-authorization": `Bearer ${cfGatewayToken}`,
      },
    } as any,
  );

  const result = await model.generateContent([prompt]);
  const text = result?.response?.text?.() ?? result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || String(text).trim().length === 0) {
    throw new Error("GoogleGenerativeAI returned no text content.");
  }
  return { text: String(text).trim() };
}

function resolveBaseRootFromIds(): string {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim();
  if (accountId && gatewayId) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }
  throw new Error(
    "Cloudflare base URL not configured. Set CLOUDFLARE_AI_GATEWAY_BASE_URL or both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_GATEWAY_ID.",
  );
}


