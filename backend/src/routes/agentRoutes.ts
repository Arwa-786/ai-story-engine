import express, { Request, Response, Router } from "express";
import { Readable } from "stream";
import { generateSpeech, type Env } from "../agents/speechAgents.js";
import { generateImageFromPrompt } from "../agents/imageAgent.js";
import { getCachedImage, setCachedImage } from "../utils/imageCache.js";

export interface HashGenerationRequest {
  inputs: Record<string, unknown>;
  instructions?: string;
  jobId?: string;
}

export interface HashGenerationResult {
  text: string;
  prompt: string;
  provider: string;
  modelId: string;
  inputs: Record<string, string>;
  jobId: string | null;
  createdAt: string;
}

export interface TextRouterDeps {
  generateText: (
    request: HashGenerationRequest,
  ) => Promise<HashGenerationResult>;
}

export interface AudioGenerationRequest {
  text: string;
  genre?: string;
}

export interface AudioRouterDeps {
  env: Env;
}

export function createTextRouter(deps: TextRouterDeps): Router {
  const router: Router = express.Router();

  router.post("/generate", async (req: Request, res: Response) => {
    const { inputs, instructions, jobId } = req.body as Partial<HashGenerationRequest>;

    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
      return res
        .status(400)
        .json({ error: "Request body must include an 'inputs' object." });
    }

    try {
      const requestPayload: HashGenerationRequest = {
        inputs,
      };
      if (instructions !== undefined) {
        requestPayload.instructions = instructions;
      }
      if (jobId !== undefined) {
        requestPayload.jobId = jobId;
      }

      const result = await deps.generateText(requestPayload);
      return res.json(result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({
        error: "Failed to generate text from hash inputs.",
        detail,
      });
    }
  });

  return router;
}

export function createAudioRouter(deps: AudioRouterDeps): Router {
  const router: Router = express.Router();

  router.post("/generate", async (req: Request, res: Response) => {
    const { text, genre } = req.body as Partial<AudioGenerationRequest>;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload. 'text' must be a non-empty string." });
    }

    try {
      // Call the speech generation function with genre support
      const speechResponse = await generateSpeech(text, deps.env, genre);

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
        return; // Stream is being piped, no need to send response
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
      // If headers were sent, stream is already in progress, nothing to do
      return;
    }
  });

  return router;
}


// Image generation
export interface ImageGenerationRequest {
  prompt: string;
  modelId?: string;
}

export function createImageRouter(): Router {
  const router: Router = express.Router();

  router.post("/generate", async (req: Request, res: Response) => {
    const { prompt, modelId } = req.body as Partial<ImageGenerationRequest>;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload. 'prompt' must be a non-empty string." });
    }

    try {
      // Check cache first
      const cached = getCachedImage(prompt, modelId);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json({
          modelId: cached.modelId || modelId || "",
          elapsedMs: 0,
          mimeType: cached.mimeType,
          imageBase64: cached.imageBase64,
        });
      }
      // Miss: generate and cache
      const started = performance.now();
      const options: { modelId?: string } = {};
      if (typeof modelId === "string" && modelId.trim().length > 0) {
        options.modelId = modelId.trim();
      }
      const result = await generateImageFromPrompt(prompt, options);
      const elapsedMs = Math.round(performance.now() - started);
      setCachedImage(prompt, modelId, result.imageBase64, result.mimeType);
      res.setHeader("X-Cache", "MISS");
      return res.status(200).json({
        modelId: result.modelId,
        elapsedMs,
        mimeType: result.mimeType,
        imageBase64: result.imageBase64,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown image generation error.";
      console.error("Image generation failed:", message);
      return res.status(502).json({ error: message });
    }
  });

  return router;
}

