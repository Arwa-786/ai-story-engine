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
  const storyLength = (configuration?.length ?? "medium") as "small" | "medium" | "long";
  const storyDensity = (configuration?.density ?? "medium") as "short" | "medium" | "dense";
  let minPages = 6;
  let maxPages = 10;
  switch (storyLength) {
    case "small":
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
  const encourageFinalization = stepIndex >= minPages - 1 && !isFinalPage;
  let densityGuidance: string;
  switch (storyDensity) {
    case "short":
      densityGuidance = [
        "- STRICT: Write 1–2 sentences in a SINGLE paragraph.",
        "- Do NOT include blank lines.",
        "- Do NOT exceed 3 sentences.",
        "- Use 1–3 words for options; terse and punchy."
      ].join("\n");
      break;
    case "medium":
      densityGuidance = [
        "- STRICT: Write 1–2 short paragraphs.",
        "- Separate paragraphs with exactly ONE blank line.",
        "- Keep each paragraph concise (2–5 sentences).",
        "- Prefer short options; full-sentence options are acceptable."
      ].join("\n");
      break;
    case "dense":
    default:
      densityGuidance = [
        "- STRICT: Write 1–3 paragraphs.",
        "- Separate paragraphs with exactly ONE blank line.",
        "- Keep each paragraph concise (2–5 sentences).",
        "- Do NOT exceed 4 paragraphs.",
      ].join("\n");
      break;
  }

  const beatGuidance = buildBeatGuidance(stepIndex, maxPages, isFinalPage);

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
    "  - small: 3–5 pages total",
    "  - medium: 6–10 pages total",
    "  - long: 10–16 pages total",
    "- Use stepIndex to pace the narrative (rising tension, midpoint, escalation, resolution).",
    `- Current beat focus: ${beatGuidance.title}`,
    ...beatGuidance.bullets.map(b => `  ${b}`),
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
    "Prose Quality:",
    "- Match the genre and tone in the definition (e.g., horror tension, noir voice, whimsical YA).",
    "- Prefer show-don't-tell; use specific, concrete sensory detail sparingly but impactfully.",
    "- Keep continuity: character names, goals, facts of the world, time-of-day, location. No teleporting or forgotten injuries.",
    "- Vary sentence rhythm; avoid clichés and generic phrasing (‘suddenly’, ‘very’, ‘really’).",
    "- Keep POV and tense consistent with the opening; if unspecified, use close third-person, present tense.",
    "",
    "Options Quality:",
    "- Options must be distinct strategic choices, not mere restatements of the text.",
    "- Avoid redundant or 'do nothing' options; each option should change the situation or intent.",
    "- Keep option text concise, starting with a strong verb or clear intent.",
    "- If using a 'branch', keep it to a single short micro-interaction; end sub-options with goToNextPage.",
    "",
    "Image Guidance:",
    "- Use image.prompt for a single scene snapshot from this page (subject + setting + mood/lighting + style hint).",
    "- Never include text overlays in the image. Describe visuals only.",
    "- image.alt should be a plain, human-friendly caption of the illustration.",
    "",
    "Ending:",
    isFinalPage
      ? "- This is the final page. Conclude decisively using one of StoryDefinition.endingOptions as inspiration; do not leave a cliffhanger."
      : "- Do not end the story yet; leave meaningful directions for the next page.",
    encourageFinalization
      ? "- You have reached at least the minimum pages for the configured length; begin converging towards a resolution and consider concluding soon if it feels natural."
      : "",
    isFinalPage
      ? "- Present a single clear option to finish (e.g., 'Finish') with { type: 'goToNextPage' }."
      : "- Present 2–3 options for the next decision.",
    "",
    "Hard Constraints:",
    `- Never exceed the maximum total pages for the configured length (maxPages=${maxPages}); if stepIndex >= maxPages-1 you MUST end now.`,
    `- Aim to reach a satisfying ending on or after minPages=${minPages}; escalate pacing after this point.`,
    "- Enforce the density constraints exactly (paragraph and sentence counts).",
    "- Output must be VALID JSON ONLY (no markdown, no prose outside JSON)."
  ].join("\n");

  // First attempt
  try {
    const { json } = await generateJsonFromInputs<StoryPage>(
      {
        definition,
        stepIndex,
        previousOption: previousOption ?? null,
        configuration: configuration ?? null,
        pagePolicy: { minPages, maxPages, isFinalPage, encourageFinalization, stepIndex },
      },
      instructions,
    );
    return normalizeStoryPage(json, { isFinalPage });
  } catch {
    // Retry with stricter reminder if the first attempt failed to parse/validate upstream
    const strictReminder = `${instructions}\n\nIMPORTANT: Return ONLY the JSON object for StoryPage. No explanations, no code fences, no comments.`;
    const { json } = await generateJsonFromInputs<StoryPage>(
      {
        definition,
        stepIndex,
        previousOption: previousOption ?? null,
        configuration: configuration ?? null,
        pagePolicy: { minPages, maxPages, isFinalPage, encourageFinalization, stepIndex },
      },
      strictReminder,
    );
    return normalizeStoryPage(json, { isFinalPage });
  }
}

function buildBeatGuidance(
  stepIndex: number,
  maxPages: number,
  isFinalPage: boolean,
): { title: string; bullets: string[] } {
  if (isFinalPage) {
    return {
      title: "Finale / Resolution",
      bullets: [
        "- Resolve the central conflict and tie back to the theme.",
        "- Echo or invert an image/idea from the opening.",
        "- Leave a satisfying aftertaste; no cliffhangers.",
      ],
    };
  }
  if (stepIndex === 0) {
    return {
      title: "Opening / Hook",
      bullets: [
        "- Grab attention using definition.startHook.",
        "- Establish the protagonist, the immediate desire, and the lived-in world.",
        "- Plant a question or tension that demands a next choice.",
      ],
    };
  }
  const denom = Math.max(1, maxPages - 1);
  const r = stepIndex / denom;
  if (r < 0.2) {
    return {
      title: "Inciting Incident",
      bullets: [
        "- Disrupt the status quo; introduce a compelling problem.",
        "- Clarify stakes and early consequences.",
      ],
    };
  }
  if (r < 0.45) {
    return {
      title: "Rising Action",
      bullets: [
        "- Complications multiply; choices have trade-offs.",
        "- Deepen character goals and opposition.",
      ],
    };
  }
  if (r < 0.55) {
    return {
      title: "Midpoint Shift",
      bullets: [
        "- A twist, revelation, or irreversible choice reframes the goal.",
        "- Raise the stakes and narrow the path forward.",
      ],
    };
  }
  if (r < 0.8) {
    return {
      title: "Escalation",
      bullets: [
        "- Pressure intensifies; resources dwindle.",
        "- Foreshadow elements that pay off in the finale.",
      ],
    };
  }
  return {
    title: "Approach to Climax",
    bullets: [
      "- Set up the decisive confrontation or commitment.",
      "- Present options that meaningfully shape the final outcome.",
    ],
  };
}

function normalizeStoryPage(page: StoryPage, ctx: { isFinalPage: boolean }): StoryPage {
  const safeId = coerceId(page?.id, "sp");
  const safeText = String(page?.text ?? "").trim();
  const normalizedOptions = normalizeOptions(page?.options, { isFinalPage: ctx.isFinalPage });
  const image = page?.image ? sanitizeImage(page.image) : undefined;
  const base: StoryPage = {
    id: safeId,
    text: safeText,
    options: normalizedOptions,
  };
  if (image) {
    (base as any).image = image;
  }
  return base;
}

function sanitizeImage(img: StoryPage["image"]): StoryPage["image"] {
  const alt = img?.alt ? String(img.alt).trim() : undefined;
  const prompt = img?.prompt ? String(img.prompt).trim() : undefined;
  if (!alt && !prompt) return undefined;
  const out: any = {};
  if (alt) out.alt = alt;
  if (prompt) out.prompt = prompt;
  return out;
}

function normalizeOptions(
  input: OptionObject[] | undefined,
  ctx: { isFinalPage: boolean },
): OptionObject[] {
  const list = Array.isArray(input) ? input.slice(0) : [];
  // Sanitize and ensure IDs
  const sanitized: OptionObject[] = list
    .map(opt => {
      const id = coerceId(opt?.id, "opt");
      const text = String(opt?.text ?? "").trim();
      const action = sanitizeAction(opt?.action);
      return { id, text, action };
    })
    .filter(o => o.text.length > 0);

  // Dedupe by text
  const seen = new Set<string>();
  const deduped: OptionObject[] = [];
  for (const o of sanitized) {
    const key = o.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(o);
    }
  }

  if (ctx.isFinalPage) {
    // Final page: single finishing option
    const finish: OptionObject = {
      id: coerceId(deduped[0]?.id ?? "", "finish"),
      text: "Finish",
      action: { type: "goToNextPage" },
    };
    return [finish];
  }

  // Non-final page: enforce 2–3 options
  let options = deduped.filter(o => isRecognisedAction(o.action));
  if (options.length < 2) {
    const needed = 2 - options.length;
    for (let i = 0; i < needed; i++) {
      options.push({
        id: generateId(`opt`),
        text: i === 0 ? "Continue" : "Look around",
        action: { type: "goToNextPage" },
      });
    }
  }
  if (options.length > 3) {
    options = options.slice(0, 3);
  }
  return options;
}

function sanitizeAction(action: OptionObject["action"]): OptionObject["action"] {
  if (!action || typeof (action as any)?.type !== "string") {
    return { type: "goToNextPage" };
  }
  if ((action as any).type === "branch") {
    const branchText = String((action as any).text ?? "").trim() || "Decide";
    const raw = Array.isArray((action as any).options) ? (action as any).options : [];
    const nested = raw
      .map((o: any) => ({
        id: coerceId(String(o?.id ?? ""), "opt"),
        text: String(o?.text ?? "").trim(),
        action: { type: "goToNextPage" as const },
      }))
      .filter((o: OptionObject) => o.text.length > 0);
    return {
      type: "branch",
      text: branchText,
      options: nested.length > 0 ? nested.slice(0, 3) : [
        { id: generateId("opt"), text: "Confirm", action: { type: "goToNextPage" } },
      ],
    };
  }
  return { type: "goToNextPage" };
}

function isRecognisedAction(action: OptionObject["action"]): boolean {
  return action?.type === "goToNextPage" || action?.type === "branch";
}

function coerceId(value: string | undefined, prefix: string): string {
  const v = String(value ?? "").trim();
  if (v.length >= 6) return v;
  return generateId(prefix);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}-${time}-${rand}`;
}


