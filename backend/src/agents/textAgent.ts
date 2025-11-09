import { composeAgentPrompt } from "../ai/geminiModelInvoker.js";
import { generateGeminiContentViaGateway } from "../ai/geminiGatewayClient.js";
import {
  getTextAgentConfig,
  type TextAgentConfigDefaults,
} from "../config/textAgents.js";

export type HashInputMap = Record<string, unknown>;

export interface HashTextRequest {
  inputs: HashInputMap;
  instructions?: string;
}

export interface HashTextResult {
  text: string;
  prompt: string;
  provider: "cloudflare-gateway";
  modelId: string;
  inputs: Record<string, string>;
}

const DEFAULT_SYSTEM_PROMPT =
  process.env.TEXT_AGENT_HASH_SYSTEM_PROMPT?.trim() ??
  "You convert hash-based inputs into a cohesive, well-written response. Respect the intent of each hash key.";
const DEFAULT_INSTRUCTIONS =
  process.env.TEXT_AGENT_HASH_INSTRUCTIONS?.trim() ??
  "Interpret each hash input and craft a single, high-signal response. Reference the hashes implicitly rather than echoing them verbatim.";

const hashAgentDefaults: TextAgentConfigDefaults = {
  provider: "cloudflare-gateway",
  modelCandidates: resolveDefaultGatewayModels(),
  responseMimeType:
    process.env.TEXT_AGENT_HASH_RESPONSE_MIME?.trim() ?? "text/plain",
};

const hashTemperature = parseOptionalNumber("TEXT_AGENT_HASH_TEMPERATURE");
if (hashTemperature !== undefined) {
  hashAgentDefaults.temperature = hashTemperature;
}

const hashMaxTokens = parseOptionalNumber("TEXT_AGENT_HASH_MAX_OUTPUT_TOKENS");
if (hashMaxTokens !== undefined) {
  hashAgentDefaults.maxOutputTokens = hashMaxTokens;
}

if (DEFAULT_SYSTEM_PROMPT) {
  hashAgentDefaults.systemPrompt = DEFAULT_SYSTEM_PROMPT;
}

const rawHashAgentConfig = getTextAgentConfig("hash", hashAgentDefaults);
const hashAgentConfig = {
  ...rawHashAgentConfig,
  provider: "cloudflare-gateway" as const,
};
const gatewayModelCandidates = hashAgentConfig.modelCandidates
  .map((candidate) => candidate?.trim())
  .filter((candidate): candidate is string => Boolean(candidate && candidate.length > 0));

if (gatewayModelCandidates.length === 0) {
  throw new Error(
    "Hash text agent misconfigured: no Cloudflare AI Gateway models available. Configure TEXT_AGENT_HASH_MODELS or GEMINI_MODEL_ID.",
  );
}

export async function generateHashText(
  request: HashTextRequest,
): Promise<HashTextResult> {
  const normalisedInputs = normaliseInputs(request.inputs);

  if (Object.keys(normalisedInputs).length === 0) {
    throw new Error("At least one hash input is required to generate text.");
  }

  const instructions =
    request.instructions?.trim() ?? DEFAULT_INSTRUCTIONS ?? "";
  const userPrompt = buildUserPrompt(normalisedInputs, instructions);
  const prompt = composeAgentPrompt(hashAgentConfig.systemPrompt, userPrompt);

  const attemptLog: Array<{ modelId: string; message: string }> = [];

  for (const modelId of gatewayModelCandidates) {
    try {
      const gatewayRequest: Parameters<typeof generateGeminiContentViaGateway>[0] = {
        modelId,
        prompt,
        responseMimeType: hashAgentConfig.responseMimeType ?? "text/plain",
      };
      
      if (typeof hashAgentConfig.temperature === "number") {
        gatewayRequest.temperature = hashAgentConfig.temperature;
      }
      
      if (typeof hashAgentConfig.maxOutputTokens === "number") {
        gatewayRequest.maxOutputTokens = hashAgentConfig.maxOutputTokens;
      }
      
      if (hashAgentConfig.apiVersion) {
        gatewayRequest.apiVersion = hashAgentConfig.apiVersion;
      }
      
      if (hashAgentConfig.gatewayProviderSlug) {
        gatewayRequest.providerSlug = hashAgentConfig.gatewayProviderSlug;
      }
      
      if (hashAgentConfig.baseUrlOverride) {
        gatewayRequest.baseUrlOverride = hashAgentConfig.baseUrlOverride;
      }
      
      const rawOutput = await generateGeminiContentViaGateway(gatewayRequest);

      return {
        text: rawOutput.trim(),
        prompt,
        provider: "cloudflare-gateway",
        modelId,
        inputs: normalisedInputs,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      attemptLog.push({ modelId, message });
      continue;
    }
  }

  const summary =
    attemptLog.length > 0
      ? attemptLog.map(({ modelId, message }) => `"${modelId}" → ${message}`).join("; ")
      : "No gateway model attempts were recorded.";

  throw new Error(
    `Cloudflare AI Gateway exhausted all configured models without success. Attempts: ${summary}`,
  );
}

function normaliseInputs(
  inputs: HashInputMap | undefined,
): Record<string, string> {
  if (!inputs || typeof inputs !== "object") {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (!key || key.trim().length === 0) {
      continue;
    }

    const cleanedKey = key.trim();
    const serialised = serialiseValue(value);
    if (serialised.length === 0) {
      continue;
    }

    result[cleanedKey] = serialised;
  }

  return result;
}

function serialiseValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildUserPrompt(
  inputs: Record<string, string>,
  instructions: string,
): string {
  const formattedHashes = Object.entries(inputs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `# ${key}\n${value}`)
    .join("\n\n");

  return `
${instructions.trim()}

${formattedHashes}
  `.trim();
}

function parseOptionalNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDefaultGatewayModels(): string[] {
  const explicitList = process.env.TEXT_AGENT_HASH_MODELS_DEFAULT;
  if (explicitList) {
    return explicitList
      .split(",")
      .map((model) => model.trim())
      .filter((model) => model.length > 0);
  }

  const primary = process.env.TEXT_AGENT_HASH_MODEL?.trim();
  if (primary && primary.length > 0) {
    return [primary];
  }

  const geminiModel = process.env.GEMINI_MODEL_ID?.trim();
  if (geminiModel && geminiModel.length > 0) {
    return [geminiModel];
  }

  return ["gemini-1.5-pro-latest"];
}
