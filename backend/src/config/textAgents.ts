import { loadEnv } from "./env.js";

loadEnv();

// Only using Cloudflare Gateway
export type TextAgentProvider = "cloudflare-gateway";

export interface TextAgentConfig {
  name: string;
  provider: TextAgentProvider;
  modelCandidates: string[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  systemPrompt?: string;
  apiVersion?: string;
  gatewayProviderSlug?: string;
  baseUrlOverride?: string;
}

export interface TextAgentConfigDefaults {
  provider?: TextAgentProvider;
  modelCandidates: string[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  systemPrompt?: string;
  apiVersion?: string;
  gatewayProviderSlug?: string;
  baseUrlOverride?: string;
}

const DEFAULT_API_VERSION =
  normaliseString(process.env.TEXT_AGENT_DEFAULT_API_VERSION) ?? "v1beta";
const DEFAULT_RESPONSE_MIME = normaliseString(
  process.env.TEXT_AGENT_DEFAULT_RESPONSE_MIME,
);
const DEFAULT_GATEWAY_PROVIDER =
  normaliseString(process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER) ?? "google";

export function getDeclaredTextAgentNames(): string[] {
  const raw = normaliseString(process.env.TEXT_AGENTS);
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function getTextAgentConfig(
  name: string,
  defaults: TextAgentConfigDefaults,
): TextAgentConfig {
  const normalisedName = name.trim();
  const cacheKey = normalisedName.toLowerCase();

  const prefix = `TEXT_AGENT_${normalisedName.toUpperCase()}_`;

  // Always use cloudflare-gateway
  const provider: TextAgentProvider = "cloudflare-gateway";

  const modelsEnv = normaliseString(process.env[`${prefix}MODELS`]);
  const modelEnv = normaliseString(process.env[`${prefix}MODEL`]);
  const modelCandidates = mergeModelPreferences(
    modelsEnv
      ? modelsEnv
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean)
      : undefined,
    modelEnv ? [modelEnv] : undefined,
    defaults.modelCandidates,
  );

  if (modelCandidates.length === 0) {
    throw new Error(
      `Text agent "${name}" does not have any model candidates configured. ` +
        `Provide ${prefix}MODELS or defaults with at least one model.`,
    );
  }

  const temperature = parseNumber(
    process.env[`${prefix}TEMPERATURE`],
    defaults.temperature,
  );
  const maxOutputTokens = parseInteger(
    process.env[`${prefix}MAX_OUTPUT_TOKENS`],
    defaults.maxOutputTokens,
  );

  const responseMimeType =
    normaliseString(process.env[`${prefix}RESPONSE_MIME`]) ??
    defaults.responseMimeType ??
    DEFAULT_RESPONSE_MIME;

  const systemPrompt =
    normaliseMultiline(process.env[`${prefix}SYSTEM_PROMPT`]) ??
    defaults.systemPrompt;

  const apiVersion =
    normaliseString(process.env[`${prefix}API_VERSION`]) ??
    defaults.apiVersion ??
    DEFAULT_API_VERSION;

  const gatewayProviderSlug =
    normaliseString(process.env[`${prefix}GATEWAY_PROVIDER`]) ??
    defaults.gatewayProviderSlug ??
    DEFAULT_GATEWAY_PROVIDER;

  const baseUrlOverride =
    normaliseString(process.env[`${prefix}BASE_URL`]) ??
    defaults.baseUrlOverride;

  const config: TextAgentConfig = {
    name: cacheKey,
    provider,
    modelCandidates,
    apiVersion,
  };

  if (typeof temperature === "number" && !Number.isNaN(temperature)) {
    config.temperature = temperature;
  }

  if (
    typeof maxOutputTokens === "number" &&
    Number.isFinite(maxOutputTokens) &&
    maxOutputTokens > 0
  ) {
    config.maxOutputTokens = maxOutputTokens;
  }

  if (responseMimeType) {
    config.responseMimeType = responseMimeType;
  }

  if (systemPrompt) {
    config.systemPrompt = systemPrompt;
  }

  if (gatewayProviderSlug) {
    config.gatewayProviderSlug = gatewayProviderSlug;
  }

  if (baseUrlOverride) {
    config.baseUrlOverride = baseUrlOverride;
  }

  return config;
}

export function mergeModelPreferences(
  ...lists: Array<readonly string[] | undefined>
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const candidate = raw?.trim();
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      merged.push(candidate);
    }
  }

  return merged;
}


function normaliseString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseMultiline(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(
  rawValue: string | undefined,
  fallback?: number,
): number | undefined {
  if (typeof rawValue === "string") {
    const parsed = Number(rawValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseInteger(
  rawValue: string | undefined,
  fallback?: number,
): number | undefined {
  if (typeof rawValue === "string") {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}


