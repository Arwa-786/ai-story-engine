import express, { Request, Response, Router } from "express";
import { generateStoryTree } from "../agents/orchestrator.js";
import { StoryNode } from "../types/story.js";

// Placeholder Agent Imports (MUST have .js extension for 'nodenext' module resolution)
// These will be uncommented when the agents are implemented:
// import { generateStoryText } from "../agents/textAgent.js";
// import { generateImage } from "../agents/imageAgent.js";
// import { generateNarration } from "../agents/audioAgent.js";

const router: Router = express.Router();

router.post("/start", async (req: Request, res: Response) => {
  const { genre } = req.body;

  if (!genre) {
    return res.status(400).json({ error: "Genre is required to start a story." });
  }

  try {
    // 1. ORCHESTRATION: Call Gemini to create the complete branching structure (all nodes)
    const storyRootNode: StoryNode = await generateStoryTree(genre);

    // *******************************************************************
    // 2. ENRICHMENT PHASE (This section will be fully built by your team)
    // *******************************************************************
    
    // The current Orchestrator structure already returns a fully fleshed-out node 
    // from Gemini (including text) thanks to the structured prompt.
    // If you were to split the roles, you would iterate through all nodes here 
    // to call the Text, Image, and Audio Agents for enrichment.

    /* Example of future full pipeline (Commented out until agents are built):
    
    // Simple recursive function to process the whole tree
    const processNode = async (node: StoryNode) => {
        // --- TEXT AGENT: If the Orchestrator only returns structure, call Text Agent here.
        // node.text = await generateStoryText(node);

        // --- IMAGE AGENT: Generate image based on text
        // node.imageUrl = await generateImage(node.text);
        
        // --- AUDIO AGENT: Generate narration based on text
        // node.audioUrl = await generateNarration(node.text);

        // Recursively process children
        if (node.children && node.children.length > 0) {
            await Promise.all(node.children.map(processNode));
        }
    }
    await processNode(storyRootNode);
    */

    // 3. RESPONSE: Return the structured and enriched story tree to the frontend
    return res.json(storyRootNode);

  } catch (err) {
    console.error("Error generating story:", err);
    return res.status(500).json({ error: "Failed to generate story due to a server or AI error." });
  }
});

export default router;