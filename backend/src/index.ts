import { loadEnv } from "./config/env.js";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Readable } from "stream";
import { generateTextFromHashes } from "./agents/textAgent.js";
import { generateSpeech } from "./agents/speechAgents.js";
import storyRouter from "./routes/storyRoutes.js";
import { createAudioRouter, createImageRouter } from "./routes/agentRoutes.js";

loadEnv();

const app = express();
const port = normalizePort(process.env.PORT) ?? 3000;

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);
app.use(express.json({ limit: "2mb" }));

// Image agent route (Gemini direct)
const geminiKey = process.env.GEMINI_API_KEY?.trim();
if (geminiKey) {
  const imageRouter = createImageRouter();
  app.use("/api/agents/image", imageRouter);
}

// Audio agent route
const elevenLabsToken = process.env.ELEVENLABS_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim();

if (elevenLabsToken && accountId && gatewayId) {
  const audioRouter = createAudioRouter({
    env: {
      ELEVENLABS_TOKEN: elevenLabsToken,
      AI_GATEWAY_ACCOUNT_ID: accountId,
      AI_GATEWAY_ID: gatewayId,
    },
  });
  app.use("/api/agents/audio", audioRouter);
}

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Mount story routes (includes POST /api/story/define)
app.use("/api/story", storyRouter);

// Readiness probe for the text generation endpoint
app.get("/api/text/generate", (_req: Request, res: Response) => {
  const modelId =
    process.env.GEMINI_MODEL_ID?.trim() || "gemini-2.5-flash";
  const provider =
    process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER?.trim() || "google";
  const hasAccount = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim());
  const hasGateway = Boolean(process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim());
  const hasApiKey = Boolean(process.env.CLOUDFLARE_API_KEY?.trim());
  const hasBaseUrl = Boolean(process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim());
  res.json({
    route: { method: "POST", path: "/api/text/generate" },
    health: "ok",
    env: {
      modelId,
      provider,
      accountIdSet: hasAccount,
      gatewayIdSet: hasGateway,
      apiKeySet: hasApiKey,
      baseUrlSet: hasBaseUrl,
    },
  });
});

interface TextGenerateRequestBody {
  inputs: Record<string, unknown>;
  instructions?: string;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

app.post(
  "/api/text/generate",
  async (req: Request<unknown, unknown, TextGenerateRequestBody>, res: Response) => {
    const { inputs, instructions, modelId, temperature, maxOutputTokens } = req.body ?? {};

    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
      return res
        .status(400)
        .json({ error: "Invalid payload. 'inputs' must be a JSON object." });
    }

    const finalModelId =
      typeof modelId === "string" && modelId.trim().length > 0
        ? modelId.trim()
        : process.env.GEMINI_MODEL_ID?.trim() || "gemini-2.5-flash";

    const finalTemperature =
      coerceNumber(temperature) ??
      coerceNumber(process.env.TEXT_AGENT_HASH_TEMPERATURE) ??
      undefined;

    const finalMaxOutputTokens =
      coerceInt(maxOutputTokens) ??
      coerceInt(process.env.TEXT_AGENT_HASH_MAX_OUTPUT_TOKENS) ??
      undefined;

    const started = performance.now();
    try {
      const agentOptions: Record<string, unknown> = { modelId: finalModelId };
      if (finalTemperature !== undefined) {
        agentOptions.temperature = finalTemperature;
      }
      if (finalMaxOutputTokens !== undefined) {
        agentOptions.maxOutputTokens = finalMaxOutputTokens;
      }
      // Provider slug is controlled inside textAgent with a strong default ("google-ai-studio")
      // but allow override from env if explicitly set.
      const envProvider = process.env.CLOUDFLARE_AI_GATEWAY_PROVIDER?.trim();
      if (envProvider) agentOptions.providerSlug = envProvider;
      const envBaseUrl = process.env.CLOUDFLARE_AI_GATEWAY_BASE_URL?.trim();
      if (envBaseUrl) agentOptions.baseUrlOverride = envBaseUrl;
      const { text } = await generateTextFromHashes(
        inputs,
        instructions,
        agentOptions as {
          modelId: string;
          temperature?: number;
          maxOutputTokens?: number;
          providerSlug?: string;
          baseUrlOverride?: string;
        },
      );
      const elapsedMs = performance.now() - started;
      return res.status(200).json({
        modelId: finalModelId,
        elapsedMs: Math.round(elapsedMs),
        text,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown generation error.";
      console.error("Text generation failed:", message);
      return res.status(502).json({ error: message });
    }
  },
);

// Speech generation endpoint
interface SpeechGenerateRequestBody {
  text: string;
  genre?: string;
}

app.post(
  "/api/speech/generate",
  async (req: Request<unknown, unknown, SpeechGenerateRequestBody>, res: Response) => {
    const { text, genre } = req.body ?? {};

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload. 'text' must be a non-empty string." });
    }

    // Get environment variables
    const elevenLabsToken = process.env.ELEVENLABS_TOKEN?.trim();
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim();

    // Check that all required environment variables are set
    if (!elevenLabsToken || !accountId || !gatewayId) {
      console.error("Missing ElevenLabs or Cloudflare Gateway .env variables");
      return res.status(500).json({ 
        error: "Server configuration error. Missing required environment variables." 
      });
    }

    try {
      // Create env object for the speech agent
      const env = {
        ELEVENLABS_TOKEN: elevenLabsToken,
        AI_GATEWAY_ACCOUNT_ID: accountId,
        AI_GATEWAY_ID: gatewayId,
      };

      // Call the speech generation function with genre support
      const speechResponse = await generateSpeech(text, env, genre);

      // Check if the response is an error
      if (!speechResponse.ok) {
        const errorText = await speechResponse.text();
        return res.status(speechResponse.status).json({ error: errorText });
      }

      // Set the audio headers from the ElevenLabs response
      res.setHeader('Content-Type', speechResponse.headers.get('Content-Type') || 'audio/mpeg');
      const contentLength = speechResponse.headers.get('Content-Length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream the audio response
      if (speechResponse.body) {
        // Convert the Web Stream (from fetch) to a Node.js Stream (for Express)
        const nodeStream = Readable.fromWeb(speechResponse.body as any);
        // Pipe the audio stream directly to the client
        nodeStream.pipe(res);
      } else {
        return res.status(500).json({ error: "Empty audio response from API." });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown speech generation error.";
      console.error("Speech generation failed:", message);
      // Check if headers were already sent (which happens if streaming started)
      if (!res.headersSent) {
        return res.status(502).json({ error: message });
      }
    }
  },
);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

function normalizePort(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? n : undefined;
  }
  return undefined;
}