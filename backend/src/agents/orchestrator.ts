import dotenv from "dotenv";
import { CloudflareAiClient } from "../clients/cloudflareAiClient.js";
import { StoryNode } from "../types/story.js";
import { ensureGeminiClient, getGeminiModelId } from "../ai/geminiClient.js";
import { generateStoryText } from "./textAgent.js";

// Load environment variables from .env file in project root
// Path is relative to where the process runs from (backend/ directory)
dotenv.config({ path: '../.env' });

// Resolve AI provider selection
type AiProvider = "gemini" | "cloudflare";
const rawProvider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
const aiProvider: AiProvider =
  rawProvider === "cloudflare" ? "cloudflare" : "gemini";

// GEMINI CLIENT CONFIGURATION (Lazy init to avoid demanding keys for other providers)
const geminiModelId = getGeminiModelId();
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
  const model = ensureGeminiClient().getGenerativeModel({
    model: geminiModelId,
    generationConfig: {
      responseMimeType: "application/json"
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonString = response.text().trim();

  console.log("✅ Gemini responded with structured JSON");
  console.log(`📄 Response length: ${jsonString.length} characters`);
  return JSON.parse(jsonString) as StoryNode;
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