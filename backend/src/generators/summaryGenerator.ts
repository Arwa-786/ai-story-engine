import { generateJsonFromInputs } from "../agents/textAgent.js";
import { type StoryConfiguration, type StoryDefinition, type StoryPage, type ImageObject } from "../types/frontend.js";

export interface BackCoverSummary {
  summary: string;
  image?: ImageObject;
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
  // Character limit guidance (hard cap)
  const charLimit = 400;
  const charGuidance = `Maximum ${charLimit} characters (aim for 320–400) in one paragraph.`;

  const protagonistName = definition?.protagonist?.name?.trim() || "the protagonist";
  const settingHint = [definition?.location, definition?.timePeriod]
    .filter(Boolean)
    .join(" • ");

  const instructions = [
    "You are an award‑winning back‑cover copywriter. Write a distinctive, high‑impact, spoiler‑light blurb.",
    "Return STRICT JSON matching: { \"summary\": string; \"image\"?: { \"alt\"?: string; \"prompt\"?: string } }",
    "",
    "Requirements for summary:",
    `- ${charGuidance}`,
    `- The summary MUST be ≤ ${charLimit} characters.`,
    "- Present tense, active voice. Show, don’t tell. Concrete nouns, vivid verbs.",
    `- Center the copy on ${protagonistName} and the live wire of the conflict.`,
    `- Hint at setting only if it adds flavor (e.g., ${settingHint || "setting/time"}).`,
    "- Convey genre, tone, central dilemma and stakes without stating the ending.",
    "- End on a provocative question or knife‑edge beat (no exclamation marks).",
    "- Avoid boilerplate like “this book/novel/story,” “readers,” or “page‑turner.”",
    "- Avoid lists, ellipses, parentheticals, and meta commentary.",
    "- Include one sharp, specific detail from the world or rules that makes it feel singular.",
    "- Do not repeat the tagline verbatim; echo its energy instead.",
    "- If pages are provided, ground the blurb in those events implicitly (no step‑by‑step).",
    "",
    "Language guardrails:",
    "- Avoid clichés and filler: journey, unleash, destined, ultimate, thrilling, gripping, epic, heart‑pounding, unforgettable, secrets will be revealed, things aren’t what they seem.",
    "- Keep adjectives purposeful and specific; prefer images over adjectives.",
    "",
    "Image (back cover) JSON fields:",
    "- image.prompt: One sentence for a subtle back‑cover motif that complements (not duplicates) the front cover. Mention mood/lighting, palette, and 1–2 concrete motifs tied to the world/setting. Avoid text, logos, character faces, and spoilers.",
    "- image.alt: 8–14 words, natural language, describing the same motif for accessibility.",
  ].join("\n");

  const { json } = await generateJsonFromInputs<BackCoverSummary>(
    {
      definition,
      pages: safePages.map(p => ({ id: p.id, text: p.text })), // trim to essentials
      configuration: configuration ?? null,
    },
    instructions,
  );
  // Enforce hard character limit on the returned JSON
  const limit = charLimit;
  const original = (json?.summary ?? "").trim();
  let summary = original;
  if (summary.length > limit) {
    const clipped = summary.slice(0, limit);
    // Prefer trimming to the last sentence boundary within the limit
    const lastPeriod = Math.max(
      clipped.lastIndexOf(". "),
      clipped.lastIndexOf("! "),
      clipped.lastIndexOf("? "),
    );
    summary = (lastPeriod > 0 ? clipped.slice(0, lastPeriod + 1) : clipped).trim();
  }
  const sanitized: BackCoverSummary = {
    ...json,
    summary,
  };
  return sanitized;
}


