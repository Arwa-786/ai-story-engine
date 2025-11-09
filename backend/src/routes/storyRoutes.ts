import express, { Request, Response, Router } from "express";
import {
  generateTextFromHashes as realGenerateTextFromHashes,
  type HashGenerationRequest,
  type HashGenerationResult,
} from "../agents/orchestrator.js";

export interface TextRouterDeps {
  generateText: (
    request: HashGenerationRequest,
  ) => Promise<HashGenerationResult>;
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
      console.error("❌ Hash text route failed", error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({
        error: "Failed to generate text from hash inputs.",
        detail,
      });
    }
  });

  return router;
}

const defaultRouter = createTextRouter({
  generateText: realGenerateTextFromHashes,
});
export default defaultRouter;