import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadEnv } from "../config/env.js";

// Ensure environment is loaded once per process
loadEnv();

let geminiClient: GoogleGenerativeAI | null = null;

const FALLBACK_MODEL_CHAIN = [
  "gemini-1.5-pro-latest",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash",
] as const;

const MODEL_ALIASES = new Map<string, string>([
  ["gemini-pro", "gemini-1.5-flash-latest"],
  ["gemini-pro-latest", "gemini-1.5-flash-latest"],
  ["gemini-1.5-pro", "gemini-1.5-pro-latest"],
  ["gemini-1.5-pro-exp", "gemini-1.5-pro-latest"],
  ["gemini-1.5-flash", "gemini-1.5-flash-latest"],
  ["gemini-1.0-pro", "gemini-1.5-pro-latest"],
  ["gemini-pro-vision", "gemini-1.5-pro-latest"],
]);

function normaliseModelId(rawModelId: string | undefined | null): string | undefined {
  if (!rawModelId) {
    return undefined;
  }

  const trimmed = rawModelId.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const alias = MODEL_ALIASES.get(trimmed.toLowerCase());
  return alias ?? trimmed;
}

function buildModelPreferenceChain(
  preferredModelId?: string | null,
  additionalFallbacks: readonly string[] = [],
): string[] {
  const candidates = new Set<string>();

  const normalisedPreferred = normaliseModelId(preferredModelId);
  if (normalisedPreferred) {
    candidates.add(normalisedPreferred);
  }

  for (const fallback of additionalFallbacks) {
    candidates.add(fallback);
  }

  for (const fallback of FALLBACK_MODEL_CHAIN) {
    candidates.add(fallback);
  }

  return Array.from(candidates);
}

export function ensureGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini configuration missing. Set GEMINI_API_KEY in the project root .env file.",
    );
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
    console.log("⚙️  Initialised shared Gemini client");
  }

  return geminiClient;
}

export function getGeminiModelId(): string {
  const [primary] = getGeminiModelCandidates();
  return primary ?? FALLBACK_MODEL_CHAIN[0];
}

export function getGeminiTextModelId(): string {
  const [primary] = getGeminiTextModelCandidates();
  return primary ?? FALLBACK_MODEL_CHAIN[0];
}

export function getGeminiModelCandidates(): string[] {
  return buildModelPreferenceChain(process.env.GEMINI_MODEL_ID);
}

export function getGeminiTextModelCandidates(): string[] {
  const textModel = normaliseModelId(process.env.GEMINI_TEXT_MODEL_ID);
  if (textModel) {
    return buildModelPreferenceChain(textModel, getGeminiModelCandidates());
  }

  return getGeminiModelCandidates();
}

export function isGeminiModelNotFoundError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && "message" in error && typeof (error as any).message === "string"
        ? (error as any).message
        : "";

  if (message.length === 0) {
    return false;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("model") && lower.includes("generatecontent")
  );
}

export function resetGeminiClientForTesting(): void {
  geminiClient = null;
}

