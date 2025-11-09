import express, { type Request, type Response, type Router } from "express";
import { generateStoryDefinitionFromConfiguration } from "../generators/promptGenerator.js";
import { generateNextStoryPage } from "../generators/storylineGenerator.js";
import { type StoryConfiguration, type StoryDefinition, type OptionObject } from "../types/frontend.js";

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

  // Generate the next StoryPage guided by StoryDefinition and an optional previous OptionObject
  router.post("/step", async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const definition = (body as { definition?: StoryDefinition }).definition;
    const previousOption = (body as { previousOption?: OptionObject }).previousOption;
    let stepIndexRaw = (body as { stepIndex?: unknown; pageNumber?: unknown }).stepIndex;
    const pageNumberRaw = (body as { stepIndex?: unknown; pageNumber?: unknown }).pageNumber;
    if (stepIndexRaw === undefined && pageNumberRaw !== undefined) {
      stepIndexRaw = pageNumberRaw;
    }

    if (!definition || typeof definition !== "object") {
      return res.status(400).json({
        error: "Invalid payload. Expect { definition, stepIndex?, previousOption? } where definition is a StoryDefinition.",
      });
    }

    // Light validation on previousOption shape if provided
    if (previousOption) {
      const ok =
        typeof previousOption.id === "string" &&
        typeof previousOption.text === "string" &&
        previousOption.action &&
        typeof (previousOption.action as { type?: unknown }).type === "string";
      if (!ok) {
        return res.status(400).json({
          error: "Invalid previousOption. Must match OptionObject shape.",
        });
      }
    }

    try {
      let stepIndex = 0;
      if (typeof stepIndexRaw === "number" && Number.isInteger(stepIndexRaw) && stepIndexRaw >= 0) {
        stepIndex = stepIndexRaw;
      } else if (typeof stepIndexRaw === "string" && stepIndexRaw.trim().length > 0) {
        const n = Number.parseInt(stepIndexRaw, 10);
        if (Number.isInteger(n) && n >= 0) stepIndex = n;
      }

      const page = await generateNextStoryPage(
        definition as StoryDefinition,
        stepIndex,
        previousOption as OptionObject | undefined,
      );
      return res.json(page);
    } catch (err) {
      console.error("Error generating StoryPage:", err);
      return res.status(502).json({ error: "Failed to generate StoryPage." });
    }
  });

  return router;
}

// Default router
const defaultRouter = createStoryRouter();
export default defaultRouter;


