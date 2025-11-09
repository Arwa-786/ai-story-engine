import { generateTextViaCloudflareGoogleDirect } from "../ai/gatewayClient.js";

export interface TextAgentOptions {
  modelId?: string;
  providerSlug?: string;
  baseUrlOverride?: string;
}

/**
 * Generate strict JSON content from structured inputs using the same Gateway path,
 * but with a JSON-only instruction contract.
 */
export async function generateJsonFromInputs<T>(
  inputs: Record<string, unknown>,
  instructions: string,
  options?: TextAgentOptions,
): Promise<{ json: T; rawText: string; modelId: string }> {
  const resolvedModelId =
    options?.modelId?.trim() ||
    process.env.GEMINI_MODEL_ID?.trim() ||
    "gemini-2.5-flash";

  const prompt = buildStrictJsonPrompt(inputs, instructions);

  const request: {
    modelId: string;
    text: string;
    apiVersion?: string;
    providerSlug?: string;
    baseUrlOverride?: string;
  } = {
    modelId: resolvedModelId,
    text: prompt,
    apiVersion: process.env.TEXT_AGENT_DEFAULT_API_VERSION?.trim() || "v1",
    providerSlug: options?.providerSlug?.trim() || "google-ai-studio",
  };
  const baseOverride =
    options?.baseUrlOverride?.trim() ||
    process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim();
  if (baseOverride) {
    request.baseUrlOverride = baseOverride;
  }

  const { text } = await generateTextViaCloudflareGoogleDirect(
    request as {
      modelId: string;
      text: string;
      apiVersion?: string;
      providerSlug?: string;
      baseUrlOverride?: string;
    },
  );

  const raw = text.trim();
  const cleaned = stripNonJsonWrappers(raw);
  const parsed = JSON.parse(cleaned) as T;
  return { json: parsed, rawText: raw, modelId: resolvedModelId };
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
  const request: {
    modelId: string;
    text: string;
    apiVersion?: string;
    providerSlug?: string;
    baseUrlOverride?: string;
  } = {
    modelId: resolvedModelId,
    text: prompt,
    apiVersion: process.env.TEXT_AGENT_DEFAULT_API_VERSION?.trim() || "v1",
    providerSlug: options?.providerSlug?.trim() || "google-ai-studio",
  };
  const baseOverride =
    options?.baseUrlOverride?.trim() ||
    process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim();
  if (baseOverride) {
    request.baseUrlOverride = baseOverride;
  }
  const { text } = await generateTextViaCloudflareGoogleDirect(
    request as {
      modelId: string;
      text: string;
      apiVersion?: string;
      providerSlug?: string;
      baseUrlOverride?: string;
    },
  );
  return { text, modelId: resolvedModelId };
}

function buildStrictJsonPrompt(
  inputs: Record<string, unknown>,
  instructions: string,
): string {
  const payload = JSON.stringify(inputs, null, 2);
  const lines: string[] = [];
  lines.push(instructions.trim());
  lines.push("");
  lines.push("Input:");
  lines.push(payload);
  lines.push("");
  lines.push("Respond with a single JSON object ONLY.");
  lines.push("- No markdown, no code fences, no commentary, no prose.");
  lines.push("- Output must be valid UTF-8 JSON, parseable by JSON.parse.");
  return lines.join("\n");
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

function stripNonJsonWrappers(text: string): string {
  // Commonly models may wrap JSON in code fences; remove if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  // Trim any leading/trailing non-JSON chars heuristically
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }
  return text.trim();
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
