import type { StoryNode } from "../types/story.js";
import {
  ensureGeminiClient,
  getGeminiTextModelCandidates,
  isGeminiModelNotFoundError,
} from "../ai/geminiClient.js";

interface GenerateStoryTextOptions {
  genre: string;
  depth: number;
  parentPath: string[];
}

const DEFAULT_MAX_OUTPUT_TOKENS = Number(
  process.env.GEMINI_TEXT_MAX_OUTPUT_TOKENS ?? 1024,
);

const DEFAULT_TEMPERATURE = Number(
  process.env.GEMINI_TEXT_TEMPERATURE ?? 0.7,
);

/**
 * Generates enriched story text for a given node using Gemini.
 * Falls back to the node's original text if Gemini is not available or fails.
 */
export async function generateStoryText(
  node: StoryNode,
  options: GenerateStoryTextOptions,
): Promise<string> {
  const originalText = node.text?.trim() ?? "";

  if (originalText.length === 0) {
    console.warn(
      `⚠️  Story node "${node.id}" submitted to text agent without baseline text.`,
    );
  }

  try {
    const client = ensureGeminiClient();
    const modelCandidates = getGeminiTextModelCandidates();
    const attemptLog: Array<{ modelId: string; message: string }> = [];

    for (const modelId of modelCandidates) {
      try {
        const model = client.getGenerativeModel({
          model: modelId,
          generationConfig: {
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
            temperature: DEFAULT_TEMPERATURE,
          },
        });

        const prompt = buildPrompt(node, options, originalText);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const candidate = response.text().trim();

        const enriched = extractTextPayload(candidate);
        if (enriched.length > 0) {
          return enriched;
        }

        console.warn(
          `⚠️ Gemini model "${modelId}" returned empty enrichment for node "${node.id}". Falling back to baseline text.`,
        );
        return originalText;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error";
        attemptLog.push({ modelId, message });

        if (isGeminiModelNotFoundError(error)) {
          console.warn(
            `🚧 Gemini text model "${modelId}" unavailable for node "${node.id}" (${message}). Trying next fallback.`,
          );
          continue;
        }

        throw error;
      }
    }

    if (attemptLog.length > 0) {
      const summary = attemptLog
        .map(({ modelId, message }) => `"${modelId}" → ${message}`)
        .join("; ");
      throw new Error(
        `Gemini text enrichment exhausted all model fallbacks for node "${node.id}". Attempts: ${summary}`,
      );
    }

    throw new Error(
      `Gemini text enrichment exhausted all model fallbacks for node "${node.id}" without any recorded attempts.`,
    );
  } catch (error) {
    console.error(
      `❌ Gemini text agent failed for node "${node.id}":`,
      (error as Error).message,
    );
    return originalText;
  }
}

function buildPrompt(
  node: StoryNode,
  { genre, depth, parentPath }: GenerateStoryTextOptions,
  originalText: string,
): string {
  const nodeKind = node.is_ending
    ? "ending node"
    : depth === 0
      ? "intro node"
      : "branch node";
  const path = [...parentPath, node.id].join(" → ");
  const choiceSummary =
    node.choices
      ?.map((choice, index) => `${index + 1}. ${choice.text}`)
      .join("\n") ?? "No choices available (ending node).";

  return `
You are an award-winning narrative designer polishing branching interactive fiction.

Genre: ${genre}
Node path: ${path}
Node type: ${nodeKind}
Is ending: ${node.is_ending}

Existing draft text:
"""
${originalText}
"""

Player choices leading out of this node:
${choiceSummary}

Rewrite the draft into a vivid, emotionally resonant passage tuned for modern interactive storytelling.
Keep the tone consistent with the genre, ensure continuity with the node type, and do not mention branching mechanics explicitly.
Respond with strict JSON: { "text": "refined narrative text here" }.
  `.trim();
}

function extractTextPayload(candidate: string): string {
  try {
    const parsed = JSON.parse(candidate) as { text?: string };
    return parsed.text?.trim() ?? "";
  } catch {
    return candidate;
  }
}

