import { generateJsonFromInputs } from "../agents/textAgent.js";
import { StoryDefinition, StoryPage, OptionObject } from "../types/frontend.js";

/**
 * Generates the next StoryPage using the text agent, guided by the StoryDefinition.
 * If `previousOption` is provided, continue from that choice; otherwise start the story.
 */
export async function generateNextStoryPage(
  definition: StoryDefinition,
  stepIndex: number,
  previousOption?: OptionObject,
): Promise<StoryPage> {
  const instructions = [
    "You are an interactive fiction engine that outputs strict JSON.",
    "Use the provided StoryDefinition to guide tone, plot, and characters.",
    "",
    "Return a JSON object EXACTLY matching this TypeScript shape:",
    "",
    "interface ImageObject {",
    "  alt?: string;",
    "  prompt?: string;",
    "}",
    "",
    "interface OptionActionGoToNextPage {",
    "  type: 'goToNextPage';",
    "}",
    "",
    "interface OptionActionBranch {",
    "  type: 'branch';",
    "  text: string;",
    "  options: OptionObject[];",
    "}",
    "",
    "type OptionAction = OptionActionGoToNextPage | OptionActionBranch;",
    "",
    "interface OptionObject {",
    "  id: string;",
    "  text: string;",
    "  action: OptionAction;",
    "}",
    "",
    "interface StoryPage {",
    "  id: string;",
    "  text: string;",
    "  image?: ImageObject;",
    "  options: OptionObject[];",
    "}",
    "",
    "Guidance:",
    "- `stepIndex` is the zero-based page number.",
    "- If previousOption is missing and stepIndex === 0, this is the opening scene. Use definition.startHook to grab attention.",
    "- Use stepIndex to pace the narrative (rising tension, midpoint, escalation, resolution).",
    "- Keep the prose vivid and concise (2-6 sentences).",
    "- Offer 2-3 options that are meaningfully different decisions for the player.",
    "- Most pages should use action { type: 'goToNextPage' } on options.",
    "- Use { type: 'branch', text: '...', options: [...] } for a short nested interaction:",
    "  - The branch 'text' introduces the sub-choice context (e.g., a line of dialogue or a brief action prompt).",
    "  - The branch 'options' are nested OptionObject[] representing sub-choices within that mini-context.",
    "  - Prefer a single level of nesting; avoid deeper than 1 sub-level.",
    "  - Sub-options inside a branch should usually resolve with { type: 'goToNextPage' }.",
    "  - Typical uses: brief dialogue trees or a quick sequence of actions.",
    "- For all ids, generate short, unique, URL-safe ids (kebab-case or uuid-like).",
    "- The image.prompt should be an optional short prompt for an illustration; image.alt should be human-friendly.",
  ].join("\n");

  const { json } = await generateJsonFromInputs<StoryPage>(
    { definition, stepIndex, previousOption: previousOption ?? null },
    instructions,
  );
  return json;
}


