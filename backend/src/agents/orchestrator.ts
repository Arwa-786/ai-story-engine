import { loadEnv } from "../config/env.js";
import { CloudflareAiClient } from "../clients/cloudflareAiClient.js";
import type { StoryChoice, StoryNode } from "../types/story.js";
import {
  ensureGeminiClient,
  getGeminiModelCandidates,
  isGeminiModelNotFoundError,
} from "../ai/geminiClient.js";
import { generateStoryText } from "./textAgent.js";

// Ensure environment is loaded once per process
loadEnv();

// Resolve AI provider selection
type AiProvider = "gemini" | "cloudflare";
const rawProvider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
const aiProvider: AiProvider =
  rawProvider === "cloudflare" ? "cloudflare" : "gemini";

// GEMINI CLIENT CONFIGURATION (Lazy init to avoid demanding keys for other providers)
const geminiModelCandidates = getGeminiModelCandidates();
console.log(`🧠 Gemini model preference chain: ${geminiModelCandidates.join(" → ")}`);
const enableHybridEnrich =
  (process.env.ENABLE_HYBRID_ENRICH ?? "false").toLowerCase() === "true";

// CLOUDFLARE CLIENT INITIALISATION (Lazy)
let cloudflareClient: CloudflareAiClient | null = null;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;
const cloudflareModel =
  process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-70b-instruct";

// NOTE: We previously constructed a strict JSON schema for Gemini, but removed it
// from the request due to API validation compatibility issues. The prompt now
// describes structure strictly without responseSchema.

/**
 * Generates a full branching story tree in JSON format for a given genre.
 * @param genre The genre of the story (fantasy, sci-fi, thriller, mystery).
 * @returns A Promise resolving to the root StoryNode of the narrative tree.
 */
export async function generateStoryTree(genre: string): Promise<StoryNode> {
  try {
    console.log(`🔄 [AI:${aiProvider}] Generating story tree for genre "${genre}"`);
    const story =
      aiProvider === "cloudflare"
        ? await generateWithCloudflare(genre)
        : await generateWithGemini(genre);

    if (aiProvider === "cloudflare" && enableHybridEnrich && isGeminiConfigured()) {
      console.log("✨ Hybrid mode: enriching Cloudflare skeleton with Gemini text agent");
      await enrichStoryTree(story, genre);
    }

    const validated = validateStoryNode(story);
    console.log(`✅ [AI:${aiProvider}] Successfully generated story tree`);
    return validated;
  } catch (error: any) {
    console.error(`❌ [AI:${aiProvider}] Failed to generate story JSON`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (error?.message) {
      console.error("Error Message:", error.message);
    }

    if (error?.status) {
      console.error("HTTP Status:", error.status);
    }

    if (error?.statusText) {
      console.error("Status Text:", error.statusText);
    }

    if (aiProvider === "gemini") {
      if (
        error?.message?.includes("API_KEY") ||
        error?.message?.includes("401") ||
        error?.message?.includes("unauthorized")
      ) {
        console.error("🔑 AUTHENTICATION ERROR: Gemini API key is invalid or expired.");
        console.error("   → Check your .env file in the project root");
        console.error("   → Verify your key at: https://aistudio.google.com/apikey");
      } else if (
        error?.message?.includes("429") ||
        error?.message?.includes("quota") ||
        error?.message?.includes("rate limit")
      ) {
        console.error("⏱️  QUOTA/RATE LIMIT ERROR: Gemini usage limits exceeded.");
        console.error("   → Check your quota at: https://aistudio.google.com/apikey");
        console.error("   → You may need to enable billing for higher limits");
      } else if (error?.message?.includes("JSON") || error?.message?.includes("parse")) {
        console.error("📄 JSON PARSING ERROR: Gemini response was not valid JSON.");
        console.error("   → Consider switching to the simplified test prompt (see code comments).");
      } else {
        console.error("Full Error Object:", JSON.stringify(error, null, 2));
      }
    } else {
      if (
        error?.message?.includes("401") ||
        error?.message?.toLowerCase().includes("token")
      ) {
        console.error(
          "🔑 AUTHENTICATION ERROR: Cloudflare API token missing scope or expired.",
        );
        console.error("   → Token requires Workers AI (AI Gateway) permissions.");
      } else if (error?.message?.includes("404")) {
        console.error(
          "🔗 ENDPOINT ERROR: Cloudflare account ID or model slug is incorrect.",
        );
        console.error("   → Confirm CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_MODEL values.");
      } else if (
        error?.message?.includes("429") ||
        error?.message?.toLowerCase().includes("rate limit")
      ) {
        console.error("⏱️  QUOTA/RATE LIMIT ERROR: Cloudflare Workers AI limits exceeded.");
        console.error("   → Review usage in Cloudflare dashboard or raise plan limits.");
      } else if (error?.message?.includes("JSON") || error?.message?.includes("parse")) {
        console.error("📄 JSON PARSING ERROR: Cloudflare AI response was not valid JSON.");
        console.error("   → Verify prompt instructions enforce strict JSON output.");
      } else {
        console.error("Full Error Object:", JSON.stringify(error, null, 2));
      }
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return {
      id: "root",
      text: `Error: Failed to generate story structure. ${error?.message || "Unknown error"}`,
      is_ending: true,
      choices: [],
    };
  }
}

function buildStoryPrompt(genre: string): string {
  return `
    You are the master orchestrator for a branching narrative game.
    Create a complete, three-level branching narrative for a **${genre}** story.

    **Structure Requirements (Strictly Follow):**
    1.  **Level 1 (Root Node):** One starting node (id: 'root') with a compelling introduction and **3** distinct choices (e.g., 'C1', 'C2', 'C3'). This node must include the story text and a 'children' array.
    2.  **Level 2 (Mid Nodes):** The 'children' array of the root must contain **3** nodes (ids: 'N2_A', 'N2_B', 'N2_C'), one for each choice. Each of these 3 nodes must have **2** distinct choices each. Each must include story text and a 'children' array.
    3.  **Level 3 (Endings):** The 'children' array of the Level 2 nodes must collectively contain **6** unique, final ending nodes (ids: 'E1' through 'E6'), with 2 endings coming from each of the 3 Level 2 nodes. These 6 ending nodes MUST have 'is_ending: true' and an empty 'choices' array ([]).

    **CRITICAL:** Ensure every choice's 'nextNodeId' correctly points to the 'id' of its immediate child node in the 'children' array.

    Generate the complete story tree as a single JSON object conforming strictly to the provided schema.
  `;
}

async function generateWithGemini(genre: string): Promise<StoryNode> {
  const prompt = buildStoryPrompt(genre);
  const client = ensureGeminiClient();
  const attemptLog: Array<{ modelId: string; message: string }> = [];

  for (const modelId of geminiModelCandidates) {
    try {
      console.log(`🤖 Trying Gemini model "${modelId}" for story generation`);
      const model = client.getGenerativeModel({
        model: modelId,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonString = response.text().trim();

      console.log(`✅ Gemini model "${modelId}" responded with structured JSON`);
      console.log(`📄 Response length: ${jsonString.length} characters`);
      const parsedPayload = JSON.parse(jsonString) as unknown;
      return normaliseGeminiStoryPayload(parsedPayload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
      attemptLog.push({ modelId, message });

      if (isGeminiModelNotFoundError(error)) {
        console.warn(
          `🚧 Gemini model "${modelId}" unavailable (${message}). Advancing to next fallback.`,
        );
        continue;
      }

      console.error(
        `💥 Gemini model "${modelId}" failed with non-recoverable error. Aborting model fallback.`,
      );
      throw error;
    }
  }

  const summary =
    attemptLog.length > 0
      ? attemptLog.map(({ modelId, message }) => `"${modelId}" → ${message}`).join("; ")
      : "No model attempts were recorded.";

  throw new Error(
    `No Gemini model in the preference chain could generate story JSON. Attempts: ${summary}`,
  );
}

async function generateWithCloudflare(genre: string): Promise<StoryNode> {
  const prompt = buildStoryPrompt(genre);
  const latencyLabel = "Cloudflare AI latency";
  console.time(latencyLabel);
  const story = await ensureCloudflareClient().generateStoryTree(prompt);
  console.timeEnd(latencyLabel);
  return story;
}

function ensureCloudflareClient(): CloudflareAiClient {
  if (!cloudflareClient) {
    if (!cloudflareAccountId || !cloudflareApiToken) {
      throw new Error(
        "Cloudflare AI configuration missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
      );
    }

    cloudflareClient = new CloudflareAiClient({
      accountId: cloudflareAccountId,
      apiToken: cloudflareApiToken,
      model: cloudflareModel,
    });
    console.log(
      `⚙️  Initialised Cloudflare AI client with model "${cloudflareModel}"`,
    );
  }
  return cloudflareClient;
}

function validateStoryNode(node: StoryNode): StoryNode {
  if (!node || typeof node !== "object") {
    throw new Error("StoryNode validation failed: node is undefined or not an object.");
  }
  if (!node.id || typeof node.id !== "string") {
    throw new Error("StoryNode validation failed: 'id' is required.");
  }
  if (typeof node.is_ending !== "boolean") {
    throw new Error("StoryNode validation failed: 'is_ending' boolean is required.");
  }
  if (typeof node.text !== "string" || node.text.trim().length === 0) {
    throw new Error("StoryNode validation failed: 'text' must be a non-empty string.");
  }
  if (!Array.isArray(node.choices)) {
    throw new Error("StoryNode validation failed: 'choices' must be an array.");
  }
  return node;
}

function isGeminiConfigured(): boolean {
  return typeof process.env.GEMINI_API_KEY === "string" && process.env.GEMINI_API_KEY.trim().length > 0;
}

async function enrichStoryTree(root: StoryNode, genre: string): Promise<void> {
  await traverse(root, 0, []);

  async function traverse(node: StoryNode, depth: number, parentPath: string[]): Promise<void> {
    const enrichedText = await generateStoryText(node, { genre, depth, parentPath });
    if (enrichedText.trim().length > 0) {
      node.text = enrichedText;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      for (const child of node.children) {
        await traverse(child, depth + 1, [...parentPath, node.id]);
      }
    }
  }
}

function normaliseGeminiStoryPayload(raw: unknown): StoryNode {
  const candidate = extractRootCandidate(raw);
  return normaliseStoryNode(candidate, new WeakSet<object>(), "root");
}

function extractRootCandidate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw[0];
  }

  const record = raw as Record<string, unknown>;
  const priorityKeys = ["root", "story", "node", "data"];
  for (const key of priorityKeys) {
    if (record[key] && typeof record[key] === "object") {
      return record[key];
    }
  }

  return raw;
}

function normaliseStoryNode(
  rawNode: unknown,
  visited: WeakSet<object>,
  fallbackId: string,
): StoryNode {
  if (!rawNode || typeof rawNode !== "object") {
    throw new Error("Gemini response invalid: expected an object for story node.");
  }

  if (visited.has(rawNode as object)) {
    throw new Error("Gemini response invalid: cyclic reference detected in story graph.");
  }
  visited.add(rawNode as object);

  const nodeRecord = rawNode as Record<string, unknown>;
  const resolvedId = deriveId(nodeRecord, fallbackId);
  const resolvedText = deriveNodeText(nodeRecord, resolvedId);
  const resolvedIsEnding = deriveIsEnding(nodeRecord);

  const rawChoices = Array.isArray(nodeRecord.choices) ? nodeRecord.choices : [];
  const normalisedChoices = rawChoices.map((choice, index) =>
    normaliseStoryChoice(choice, resolvedId, index),
  );

  const rawChildren = Array.isArray(nodeRecord.children) ? nodeRecord.children : [];
  const normalisedChildren =
    rawChildren.length > 0
      ? rawChildren.map((child, index) =>
          normaliseStoryNode(child, visited, `${resolvedId}_child_${index + 1}`),
        )
      : undefined;

  const normalisedNode: StoryNode = {
    id: resolvedId,
    text: resolvedText,
    is_ending: resolvedIsEnding,
    choices: normalisedChoices,
  };

  if (normalisedChildren && normalisedChildren.length > 0) {
    normalisedNode.children = normalisedChildren;
  }

  const imageUrl = deriveOptionalString(nodeRecord, ["imageUrl", "image_url"]);
  if (imageUrl) {
    normalisedNode.imageUrl = imageUrl;
  }

  const audioUrl = deriveOptionalString(nodeRecord, ["audioUrl", "audio_url"]);
  if (audioUrl) {
    normalisedNode.audioUrl = audioUrl;
  }

  return normalisedNode;
}

function normaliseStoryChoice(
  rawChoice: unknown,
  parentId: string,
  index: number,
): StoryChoice {
  if (!rawChoice || typeof rawChoice !== "object") {
    return {
      id: `${parentId}_choice_${index + 1}`,
      text: `Choice ${index + 1}`,
    };
  }

  const choiceRecord = rawChoice as Record<string, unknown>;
  const id =
    typeof choiceRecord.id === "string" && choiceRecord.id.trim().length > 0
      ? choiceRecord.id.trim()
      : `${parentId}_choice_${index + 1}`;
  const text =
    typeof choiceRecord.text === "string" && choiceRecord.text.trim().length > 0
      ? choiceRecord.text
      : `Choice ${index + 1}`;

  const normalisedChoice: StoryChoice = {
    id,
    text,
  };

  const nextNodeId = deriveOptionalString(choiceRecord, ["nextNodeId", "next_node_id"]);
  if (nextNodeId) {
    normalisedChoice.nextNodeId = nextNodeId;
  }

  return normalisedChoice;
}

function deriveId(record: Record<string, unknown>, fallbackId: string): string {
  const rawIdCandidates = ["id", "nodeId", "node_id", "identifier"];
  for (const key of rawIdCandidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return fallbackId;
}

function deriveIsEnding(record: Record<string, unknown>): boolean {
  const candidates = ["is_ending", "isEnding", "ending"];
  for (const key of candidates) {
    if (typeof record[key] === "boolean") {
      return record[key] as boolean;
    }
    if (typeof record[key] === "string") {
      const normalized = (record[key] as string).trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }

  // Fallback heuristic: if there are no children or choices, mark as ending.
  const hasChoices = Array.isArray(record.choices) && record.choices.length > 0;
  const hasChildren = Array.isArray(record.children) && record.children.length > 0;
  return !hasChoices && !hasChildren;
}

function deriveOptionalString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function deriveNodeText(record: Record<string, unknown>, nodeId: string): string {
  const stringKeys = [
    "text",
    "story",
    "content",
    "narrative",
    "body",
    "description",
    "passage",
    "scene",
  ];

  for (const key of stringKeys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  const paragraphCollections = ["paragraphs", "lines", "segments"];
  for (const key of paragraphCollections) {
    const value = record[key];
    if (Array.isArray(value)) {
      const joined = value
        .filter((paragraph): paragraph is string => typeof paragraph === "string")
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .join("\n\n");

      if (joined.length > 0) {
        return joined;
      }
    }
  }

  const summaryKeys = ["summary", "overview", "synopsis"];
  for (const key of summaryKeys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  console.warn(
    `⚠️ Gemini response missing narrative text for node "${nodeId}". Injecting placeholder content.`,
  );
  return `Scene placeholder: Gemini omitted narrative text for node "${nodeId}". Please regenerate this branch if richer prose is required.`;
}