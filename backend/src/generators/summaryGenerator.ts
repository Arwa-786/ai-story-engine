import { generateJsonFromInputs } from "../agents/textAgent.js";
import { type StoryConfiguration, type StoryDefinition, type StoryPage } from "../types/frontend.js";

export interface BackCoverSummary {
  summary: string;
}

/**
 * Generates a concise, engaging back cover summary for the story.
 * Accepts the StoryDefinition and optional pages to ground the recap.
 */
export async function generateBackCoverSummary(
  definition: StoryDefinition,
  pages?: StoryPage[] | null,
  configuration?: StoryConfiguration | null,
): Promise<BackCoverSummary> {
  const safePages = Array.isArray(pages) ? pages : [];
  const instructions = [
    "You are a book blurb writer. Produce a concise, engaging, and spoiler-light back cover summary.",
    "Return STRICT JSON matching: { \"summary\": string }",
    "",
    "Guidance:",
    "- 1 short paragraph (3–6 sentences).",
    "- Convey tone, genre, conflict, stakes, and hook.",
    "- Avoid explicit spoilers of the ending; tease resolution.",
    "- Reflect the protagonist, setting, and theme from the definition.",
    "- If pages are provided, ground the summary in their events without enumerating them.",
  ].join("\n");

  const { json } = await generateJsonFromInputs<BackCoverSummary>(
    {
      definition,
      pages: safePages.map(p => ({ id: p.id, text: p.text })), // trim to essentials
      configuration: configuration ?? null,
    },
    instructions,
  );
  return json;
}


