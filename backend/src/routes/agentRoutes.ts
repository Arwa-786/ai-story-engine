import express, { Request, Response, Router } from "express";
import { generateHashText, type HashTextRequest } from "../agents/textAgent.js";
import { generateImage } from "../agents/imageAgent.js";
import { generateAudio } from "../agents/audioAgent.js";

interface TextAgentRequestBody {
  inputs?: Record<string, unknown>;
  instructions?: string;
  jobId?: string;
}

interface ImageAgentRequestBody {
  prompt?: string;
}

interface AudioAgentRequestBody {
  text?: string;
}

const agentRouter: Router = express.Router();

agentRouter.post("/text", async (req: Request, res: Response) => {
  const { inputs, instructions, jobId } = req.body as TextAgentRequestBody;

  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return res.status(400).json({ error: "Request body must include an 'inputs' object." });
  }

  const requestPayload: HashTextRequest = {
    inputs,
  };
  
  if (instructions !== undefined) {
    requestPayload.instructions = instructions;
  }

  try {
    const result = await generateHashText(requestPayload);
    return res.json({
      text: result.text,
      prompt: result.prompt,
      provider: result.provider,
      modelId: result.modelId,
      inputs: result.inputs,
      jobId: jobId ?? null,
    });
  } catch (error) {
    console.error("❌ Text agent route failed:", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific error types
    if (detail.includes("GEMINI_API_KEY")) {
      return res.status(503).json({
        error: "Text generation service not configured",
        detail: "Gemini API key is missing. Please configure GEMINI_API_KEY in your .env file.",
        provider: "cloudflare-gateway"
      });
    }
    
    if (detail.includes("CLOUDFLARE_ACCOUNT_ID") || detail.includes("CLOUDFLARE_AI_GATEWAY_ID")) {
      return res.status(503).json({
        error: "Cloudflare AI Gateway not configured",
        detail: "Cloudflare Gateway credentials are missing. Please configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_GATEWAY_ID in your .env file.",
        provider: "cloudflare-gateway"
      });
    }
    
    if (detail.includes("404") || detail.includes("not found")) {
      return res.status(503).json({
        error: "AI model not available",
        detail: "The requested AI model is not available. Please check your model configuration.",
        provider: "cloudflare-gateway"
      });
    }
    
    return res.status(500).json({
      error: "Failed to generate text from hash inputs.",
      detail,
      provider: "cloudflare-gateway"
    });
  }
});

agentRouter.post("/image", async (req: Request, res: Response) => {
  const { prompt } = req.body as ImageAgentRequestBody;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Image prompt is required." });
  }

  const resolvedPrompt = prompt.trim();

  try {
    const imageUrl = await generateImage(resolvedPrompt);
    return res.json({
      imageUrl,
      prompt: resolvedPrompt,
    });
  } catch (error) {
    console.error("❌ Image agent route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to generate image.",
      detail,
    });
  }
});

agentRouter.post("/audio", async (req: Request, res: Response) => {
  const { text } = req.body as AudioAgentRequestBody;

  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Narration text is required." });
  }

  const resolvedText = text.trim();

  try {
    const audioUrl = await generateAudio(resolvedText);
    return res.json({
      audioUrl,
      text: resolvedText,
    });
  } catch (error) {
    console.error("❌ Audio agent route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to generate audio narration.",
      detail,
    });
  }
});

export default agentRouter;

