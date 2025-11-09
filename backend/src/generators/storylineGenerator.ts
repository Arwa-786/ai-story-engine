import { generateJsonFromInputs } from "../agents/textAgent.js";
import { StoryDefinition, StoryPage, OptionObject, StoryConfiguration } from "../types/frontend.js";

/**
 * Generates the next StoryPage using the text agent, guided by the StoryDefinition.
 * If `previousOption` is provided, continue from that choice; otherwise start the story.
 */
export async function generateNextStoryPage(
  definition: StoryDefinition,
  stepIndex: number,
  previousOption?: OptionObject,
  configuration?: StoryConfiguration,
): Promise<StoryPage> {
  const storyLength = (configuration?.length ?? "medium") as "short" | "medium" | "long";
  const storyDensity = (configuration?.density ?? "medium") as "short" | "medium" | "dense";
  let minPages = 6;
  let maxPages = 10;
  switch (storyLength) {
    case "short":
      minPages = 3;
      maxPages = 5;
      break;
    case "medium":
      minPages = 6;
      maxPages = 10;
      break;
    case "long":
      minPages = 10;
      maxPages = 16;
      break;
  }
  const isFinalPage = stepIndex >= maxPages - 1;
  let densityGuidance: string;
  switch (storyDensity) {
    case "short":
      densityGuidance = [
        "- STRICT: Write 1–4 sentences in a SINGLE paragraph.",
        "- Do NOT include blank lines.",
        "- Do NOT exceed 4 sentences.",
      ].join("\n");
      break;
    case "medium":
      densityGuidance = [
        "- STRICT: Write 1–2 paragraphs.",
        "- Separate paragraphs with exactly ONE blank line.",
        "- Keep each paragraph concise (2–5 sentences).",
        "- Do NOT exceed 2 paragraphs.",
      ].join("\n");
      break;
    case "dense":
    default:
      densityGuidance = [
        "- STRICT: Write 2–4 paragraphs.",
        "- Separate paragraphs with exactly ONE blank line.",
        "- Keep each paragraph concise (2–5 sentences).",
        "- Do NOT exceed 4 paragraphs.",
      ].join("\n");
      break;
  }

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
    "- Obey StoryConfiguration.length using the following total page ranges:",
    "  - short: 3–5 pages total",
    "  - medium: 6–10 pages total",
    "  - long: 10–16 pages total",
    "- Use stepIndex to pace the narrative (rising tension, midpoint, escalation, resolution).",
    "- If previousOption is missing and stepIndex === 0, this is the opening scene. Use definition.startHook to grab attention.",
    "- Offer 2–3 options that are meaningfully different decisions for the player.",
    "- Most pages should use action { type: 'goToNextPage' } on options.",
    "- Use { type: 'branch', text: '...', options: [...] } for a short nested interaction:",
    "  - The branch 'text' introduces the sub-choice context (e.g., a line of dialogue or a brief action prompt).",
    "  - The branch 'options' are nested OptionObject[] representing sub-choices within that mini-context.",
    "  - Prefer a single level of nesting; avoid deeper than 1 sub-level.",
    "  - Sub-options inside a branch should usually resolve with { type: 'goToNextPage' }.",
    "  - Typical uses: brief dialogue trees or a quick sequence of actions.",
    "- Density rules based on StoryConfiguration.density:",
    `${densityGuidance}`,
    "- Do NOT use bullet lists or headings; write natural narrative prose only.",
    "- For all ids, generate short, unique, URL-safe ids (kebab-case or uuid-like).",
    "- The image.prompt should be an optional short prompt for an illustration; image.alt should be human-friendly.",
    "",
    "Ending:",
    isFinalPage
      ? "- This is the final page. Conclude decisively using one of StoryDefinition.endingOptions as inspiration; do not leave a cliffhanger."
      : "- Do not end the story yet; leave meaningful directions for the next page.",
    isFinalPage
      ? "- Present a single clear option to finish (e.g., 'Finish') with { type: 'goToNextPage' }."
      : "- Present 2–3 options for the next decision.",
    "",
    "Hard Constraints:",
    `- Never exceed the maximum total pages for the configured length (maxPages=${maxPages}); if stepIndex >= maxPages-1 you MUST end now.`,
    "- Enforce the density constraints exactly (paragraph and sentence counts).",
  ].join("\n");

  const { json } = await generateJsonFromInputs<StoryPage>(
    {
      definition,
      stepIndex,
      previousOption: previousOption ?? null,
      configuration: configuration ?? null,
      pagePolicy: { minPages, maxPages, isFinalPage },
    },
    instructions,
  );
  return json;
}


