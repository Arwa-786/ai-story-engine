import express, { type Request, type Response, type Router } from "express";
import { generateStoryDefinitionFromConfiguration } from "../generators/promptGenerator.js";
import { type StoryConfiguration } from "../types/frontend.js";

export function createStoryRouter(): Router {
  const router: Router = express.Router();

  // Generate a StoryDefinition document from StoryConfiguration
  router.post("/define", async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { length, density, description } = body as Partial<StoryConfiguration>;

    if (!length || !density || typeof description !== "string") {
      return res.status(400).json({
        error: "Invalid StoryConfiguration. Expect { length, density, description }.",
      });
    }

    try {
      const configuration: StoryConfiguration = {
        length,
        density,
        description,
      } as StoryConfiguration;

      const definition = await generateStoryDefinitionFromConfiguration(configuration);
      return res.json(definition);
    } catch (err) {
      console.error("Error generating StoryDefinition:", err);
      return res.status(502).json({ error: "Failed to generate StoryDefinition." });
    }
  });

  return router;
}

// Default router
const defaultRouter = createStoryRouter();
export default defaultRouter;


