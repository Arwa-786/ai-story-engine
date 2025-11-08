import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// Load shared secrets from the project root when running from /backend
dotenv.config({ path: "../.env" });

let geminiClient: GoogleGenerativeAI | null = null;

const FALLBACK_MODEL_ID = "gemini-1.5-pro";

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
  return process.env.GEMINI_MODEL_ID ?? FALLBACK_MODEL_ID;
}

export function getGeminiTextModelId(): string {
  return process.env.GEMINI_TEXT_MODEL_ID ?? getGeminiModelId();
}

export function resetGeminiClientForTesting(): void {
  geminiClient = null;
}

