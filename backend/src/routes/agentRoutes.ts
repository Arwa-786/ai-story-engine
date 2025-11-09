import express, { Request, Response, Router } from "express";
import { generateTextFromHashes } from "../agents/textAgent.js";

interface TextAgentRequestBody {
  inputs?: Record<string, unknown>;
  instructions?: string;
  jobId?: string;
}

const agentRouter: Router = express.Router();

agentRouter.post("/text", async (req: Request, res: Response) => {
  const { inputs, instructions } = req.body as TextAgentRequestBody;

  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return res
      .status(400)
      .json({ error: "Request body must include an 'inputs' object." });
  }

  try {
    const { text, modelId } = await generateTextFromHashes(inputs, instructions);
    return res.json({
      text,
      modelId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to generate text from hash inputs.",
      detail,
      provider: "cloudflare-gateway",
    });
  }
});

export default agentRouter;

