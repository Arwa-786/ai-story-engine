import express, { Request, Response, Router } from "express";

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


