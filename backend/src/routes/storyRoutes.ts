import express, { Request, Response, Router } from "express";
import { generateStoryTree as realGenerateStoryTree } from "../agents/orchestrator.js";
import { StoryNode } from "../types/story.js";

// Placeholder Agent Imports (MUST have .js extension for 'nodenext' module resolution)
// These will be uncommented when the agents are implemented:
// import { generateStoryText } from "../agents/textAgent.js";
// import { generateImage } from "../agents/imageAgent.js";
// import { generateNarration } from "../agents/audioAgent.js";

export interface StoryDeps {
  generateStoryTree: (genre: string) => Promise<StoryNode>;
}

export function createStoryRouter(deps: StoryDeps): Router {
  const router: Router = express.Router();

  router.post("/start", async (req: Request, res: Response) => {
    const { genre } = req.body;

    if (!genre) {
      return res.status(400).json({ error: "Genre is required to start a story." });
    }

    try {
      // 1. ORCHESTRATION: Create the complete branching structure (all nodes)
      const storyRootNode: StoryNode = await deps.generateStoryTree(genre);

      // *******************************************************************
      // 2. ENRICHMENT PHASE (future work)
      // *******************************************************************

      // 3. RESPONSE: Return the structured and enriched story tree to the frontend
      return res.json(storyRootNode);

    } catch (err) {
      console.error("Error generating story:", err);
      return res.status(500).json({ error: "Failed to generate story due to a server or AI error." });
    }
  });

  return router;
}

// Default router using the real orchestrator for production runtime
const defaultRouter = createStoryRouter({ generateStoryTree: realGenerateStoryTree });
export default defaultRouter;