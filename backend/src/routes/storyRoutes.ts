import express, { type Request, type Response, type Router } from "express";
import { generateStoryDefinitionFromConfiguration } from "../generators/promptGenerator.js";
import { generateNextStoryPage } from "../generators/storylineGenerator.js";
import { type StoryConfiguration, type StoryDefinition, type OptionObject } from "../types/frontend.js";
import { generateImageFromPrompt } from "../agents/imageAgent.js";

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
    const configuration = (body as { configuration?: StoryConfiguration }).configuration;
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
        configuration as StoryConfiguration | undefined,
      );
      return res.json(page);
    } catch (err) {
      console.error("Error generating StoryPage:", err);
      return res.status(502).json({ error: "Failed to generate StoryPage." });
    }
  });

  // Generate cover image using image agent (Gemini)
  router.post("/cover-image", async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const promptRaw = (body as { prompt?: unknown }).prompt;
    const modelIdRaw = (body as { modelId?: unknown }).modelId;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    const modelId = typeof modelIdRaw === "string" ? modelIdRaw.trim() : undefined;

    if (!prompt || prompt.length === 0) {
      return res.status(400).json({
        error: "Invalid payload. Expect { prompt } where prompt is a non-empty string.",
      });
    }

    try {
      const started = performance.now();
      const result = await generateImageFromPrompt(prompt, { modelId });
      const elapsedMs = Math.round(performance.now() - started);
      return res.status(200).json({
        modelId: result.modelId,
        elapsedMs,
        mimeType: result.mimeType,
        imageBase64: result.imageBase64,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate cover image.";
      console.error("Error generating cover image:", message);
      return res.status(502).json({ error: message });
    }
  });

  return router;
}

// Default router
const defaultRouter = createStoryRouter();
export default defaultRouter;


