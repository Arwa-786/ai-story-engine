import { GoogleGenerativeAI, Schema } from "@google/generative-ai";
import dotenv from "dotenv";
import { StoryNode } from "../types/story.js";

// Load environment variables from .env file in project root
// Path is relative to where the process runs from (backend/ directory)
dotenv.config({ path: '../.env' });

// Validate API key is present
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERROR: GEMINI_API_KEY is not set in environment variables!");
  console.error("   Please create a .env file in the project root with: GEMINI_API_KEY=your_key_here");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Define the schema for a single Choice (must match StoryChoice interface)
const choiceSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const, description: "A unique identifier for the choice." },
    text: { type: "string" as const, description: "The action or dialogue option for the user to select." },
    nextNodeId: { type: "string" as const, description: "The ID of the child node this choice leads to (e.g., 'N2_A')." },
  },
  required: ["id", "text", "nextNodeId"],
} as Schema;

// Define the schema for a StoryNode (recursive, matching StoryNode interface)
// We rely on the model to fill in the text and children structure based on the prompt.
const nodeSchema = {
    type: "object" as const,
    properties: {
        id: { type: "string" as const, description: "Unique ID for the node, e.g., 'root', 'N2_A', or 'E1'." },
        is_ending: { type: "boolean" as const, description: "True only for the 6 final ending nodes." },
        text: { type: "string" as const, description: "The full narrative text for this node. Should be detailed and descriptive." },
        choices: { type: "array" as const, description: "List of choices (3 for root, 2 for mid nodes, 0 for endings).", items: choiceSchema, },
        children: { 
            type: "array" as const, 
            description: "Array of nested StoryNode objects that the choices lead to.", 
            items: { 
                type: "object" as const,
                properties: {
                    id: { type: "string" as const },
                    is_ending: { type: "boolean" as const },
                    text: { type: "string" as const },
                    choices: { type: "array" as const, items: choiceSchema },
                    children: { type: "array" as const, items: { type: "object" as const } }
                }
            } 
        },
    },
    required: ["id", "is_ending", "text", "choices"],
} as unknown as Schema;

/**
 * Generates a full branching story tree in JSON format for a given genre.
 * @param genre The genre of the story (fantasy, sci-fi, thriller, mystery).
 * @returns A Promise resolving to the root StoryNode of the narrative tree.
 */
export async function generateStoryTree(genre: string): Promise<StoryNode> {
  // ============================================
  // TEST MODE: Simplified prompt for debugging
  // Uncomment the simple prompt below and comment out the full prompt to test
  // ============================================
  
  // SIMPLE TEST PROMPT (uncomment to test):
  /*
  const prompt = `
    Create a very simple JSON structure for a ${genre} story.
    Start with one node (id: 'root') that has two choices, both leading to simple ending nodes (id: 'E1', 'E2').
    The JSON must strictly conform to the responseSchema.
  `;
  */

  // FULL PROMPT (current):
  const prompt = `
    You are the master orchestrator for a branching narrative game.
    Create a complete, three-level branching narrative for a **${genre}** story.

    **Structure Requirements (Strictly Follow):**
    1.  **Level 1 (Root Node):** One starting node (id: 'root') with a compelling introduction and **3** distinct choices (e.g., 'C1', 'C2', 'C3'). This node must include the story text and a 'children' array.
    2.  **Level 2 (Mid Nodes):** The 'children' array of the root must contain **3** nodes (ids: 'N2_A', 'N2_B', 'N2_C'), one for each choice. Each of these 3 nodes must have **2** distinct choices each. Each must include story text and a 'children' array.
    3.  **Level 3 (Endings):** The 'children' array of the Level 2 nodes must collectively contain **6** unique, final ending nodes (ids: 'E1' through 'E6'), with 2 endings coming from each of the 3 Level 2 nodes. These 6 ending nodes MUST have 'is_ending: true' and an empty 'choices' array ([]).

    **CRITICAL:** Ensure every choice's 'nextNodeId' correctly points to the 'id' of its immediate child node in the 'children' array.

    Generate the complete story tree as a single JSON object conforming strictly to the provided schema.
  `;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: nodeSchema,
    },
  });

  try {
    console.log("🔄 Calling Gemini API to generate story tree...");
    console.log(`📝 Genre: ${genre}`);
    console.log(`🔑 API Key present: ${apiKey ? "Yes (length: " + apiKey.length + ")" : "NO - MISSING!"}`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text().trim();
    
    console.log("✅ Received response from Gemini");
    console.log(`📄 Response length: ${jsonString.length} characters`);
    console.log(`📄 First 200 chars: ${jsonString.substring(0, 200)}...`);
    
    const storyTree: StoryNode = JSON.parse(jsonString);
    console.log("✅ Successfully parsed JSON and generated story tree");
    return storyTree;
  } catch (error: any) {
    console.error("❌ Failed to generate or parse story JSON");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Detailed error logging
    if (error?.message) {
      console.error("Error Message:", error.message);
    }
    
    if (error?.status) {
      console.error("HTTP Status:", error.status);
    }
    
    if (error?.statusText) {
      console.error("Status Text:", error.statusText);
    }
    
    // Check for specific error types
    if (error?.message?.includes("API_KEY") || error?.message?.includes("401") || error?.message?.includes("unauthorized")) {
      console.error("🔑 AUTHENTICATION ERROR: Your API key is invalid or expired!");
      console.error("   → Check your .env file in the project root");
      console.error("   → Verify your key at: https://aistudio.google.com/apikey");
    } else if (error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("rate limit")) {
      console.error("⏱️  QUOTA/RATE LIMIT ERROR: You've exceeded your API limits!");
      console.error("   → Check your quota at: https://aistudio.google.com/apikey");
      console.error("   → You may need to enable billing for higher limits");
    } else if (error?.message?.includes("JSON") || error?.message?.includes("parse")) {
      console.error("📄 JSON PARSING ERROR: The response wasn't valid JSON");
      console.error("   → This might indicate the prompt is too complex");
      console.error("   → Try using the simplified test prompt (see comments in code)");
    } else {
      console.error("Full Error Object:", JSON.stringify(error, null, 2));
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Return a structured failure node
    return {
      id: "root",
      text: `Error: Failed to generate story structure. ${error?.message || "Unknown error"}`,
      is_ending: true,
      choices: [],
    };
  }
}