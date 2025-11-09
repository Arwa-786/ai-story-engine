import { generateTextViaCloudflareGoogleDirect } from "../ai/gatewayClient.js";

export interface TextAgentOptions {
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  providerSlug?: string;
  baseUrlOverride?: string;
}

export async function generateTextFromHashes(
  inputs: Record<string, unknown>,
  instructions?: string,
  options?: TextAgentOptions,
): Promise<{ text: string; modelId: string }> {
  const resolvedModelId =
    options?.modelId?.trim() ||
    process.env.GEMINI_MODEL_ID?.trim() ||
    "gemini-2.5-flash";

  const prompt = buildPromptFromHashes(inputs, instructions);

  // Use Cloudflare Gateway → Google AI Studio direct endpoint (matches working curl)
  const { text } = await generateTextViaCloudflareGoogleDirect({
    modelId: resolvedModelId,
    text: prompt,
    apiVersion: process.env.TEXT_AGENT_DEFAULT_API_VERSION?.trim() || "v1",
    providerSlug: "google-ai-studio",
    baseUrlOverride: process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim(),
  });
  return { text, modelId: resolvedModelId };
}

function buildPromptFromHashes(
  inputs: Record<string, unknown>,
  instructions?: string,
): string {
  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  const lines: string[] = [];
  if (instructions && instructions.trim().length > 0) {
    lines.push(`Instructions: ${instructions.trim()}`);
    lines.push("");
  }
  lines.push("Input Hashes (JSON):");
  lines.push(JSON.stringify(pickKeys(inputs, keys), null, 2));
  lines.push("");
  lines.push(
    "Return a single coherent text response synthesizing the hashes. Do not include JSON in the answer.",
  );
  return lines.join("\n");
}

function pickKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}
