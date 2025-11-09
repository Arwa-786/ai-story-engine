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
  console.debug("[textAgent] generateJsonFromInputs called", {
    instructionLength: instructions?.length ?? 0,
    inputKeys: Object.keys(inputs || {}),
    modelIdOption: options?.modelId,
  });
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
  console.debug("[textAgent] outgoing provider request (JSON mode)", {
    modelId: request.modelId,
    providerSlug: request.providerSlug,
    apiVersion: request.apiVersion,
    baseUrlOverride: request.baseUrlOverride,
    text: request.text,
  });
  try {
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
    console.info("[textAgent] generateJsonFromInputs succeeded", {
      modelId: resolvedModelId,
      rawLength: raw.length,
    });
    console.debug("[textAgent] returning payload to caller (JSON mode)", {
      rawText: raw,
      json: parsed,
    });
    return { json: parsed, rawText: raw, modelId: resolvedModelId };
  } catch (err) {
    console.error("[textAgent] generateJsonFromInputs failed", {
      modelId: resolvedModelId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateTextFromHashes(
  inputs: Record<string, unknown>,
  instructions?: string,
  options?: TextAgentOptions,
): Promise<{ text: string; modelId: string }> {
  console.debug("[textAgent] generateTextFromHashes called", {
    instructionLength: instructions?.length ?? 0,
    inputKeys: Object.keys(inputs || {}),
    modelIdOption: options?.modelId,
  });
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
  console.debug("[textAgent] outgoing provider request (TEXT mode)", {
    modelId: request.modelId,
    providerSlug: request.providerSlug,
    apiVersion: request.apiVersion,
    baseUrlOverride: request.baseUrlOverride,
    text: request.text,
  });
  try {
    const { text } = await generateTextViaCloudflareGoogleDirect(
      request as {
        modelId: string;
        text: string;
        apiVersion?: string;
        providerSlug?: string;
        baseUrlOverride?: string;
      },
    );
    console.info("[textAgent] generateTextFromHashes succeeded", {
      modelId: resolvedModelId,
      textLength: text?.length ?? 0,
    });
    console.debug("[textAgent] returning payload to caller (TEXT mode)", {
      text,
    });
    return { text, modelId: resolvedModelId };
  } catch (err) {
    console.error("[textAgent] generateTextFromHashes failed", {
      modelId: resolvedModelId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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
