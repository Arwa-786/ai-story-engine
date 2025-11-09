import { generateJsonFromInputs } from "../agents/textAgent.js";
import { StoryConfiguration, StoryDefinition } from "../types/frontend.js";

/**
 * Generates a StoryDefinition using the text agent, from a StoryConfiguration.
 */
export async function generateStoryDefinitionFromConfiguration(
  configuration: StoryConfiguration,
): Promise<StoryDefinition> {
  const instructions = [
    "You are a story generator for an AI generated game.",
    "Use this input to create the StoryDefinition JSON object exactly matching this TypeScript shape:",
    "",
    "interface StoryDefinition {",
    "  title: string;",
    "  genre: string;",
    "  theme: string;",
    "  tagline: string;",
    "  image?: { alt?: string; prompt?: string; };",
    "  overview: string;",
    "  plot: string;",
    "  conflict: string;",
    "  resolution: string;",
    "  startHook: string;",
    "  endingOptions: Array<{ id: string; title: string; description: string; isCanonical?: boolean }>; ",
    "  protagonist: { id: string; name: string; role: string; description?: string; motivation?: string; backstory?: string; };",
    "  antagonist?: { id: string; name: string; role: string; description?: string; motivation?: string; backstory?: string; };",
    "  supportingCast?: Array<{ id: string; name: string; role: string; description?: string; motivation?: string; backstory?: string; }>;",
    "  location: string;",
    "  worldDescription: string;",
    "  timePeriod: string;",
    "}",
    "",
    "Constraints:",
    "- Base your choices on the provided configuration (length, density, description).",
    "- Produce compelling, concise fields consistent with the specified length and density.",
    "- endingOptions should include 3-5 diverse endings; mark one as canonical if appropriate.",
  ].join("\n");

  const { json } = await generateJsonFromInputs<StoryDefinition>(
    { configuration },
    instructions,
  );
  return json;
}


