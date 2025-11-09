import express, { Request, Response, Router } from "express";
import { StoryNode } from "../types/story.js";
import { generateStoryText } from "../agents/textAgent.js";
import { generateImage } from "../agents/imageAgent.js";
import { generateAudio } from "../agents/audioAgent.js";

interface TextAgentRequestBody {
  node?: Partial<StoryNode> & Record<string, unknown>;
  genre?: string;
  depth?: number;
  parentPath?: string[];
}

interface ImageAgentRequestBody {
  prompt?: string;
}

interface AudioAgentRequestBody {
  text?: string;
}

const agentRouter: Router = express.Router();

agentRouter.post("/text", async (req: Request, res: Response) => {
  const { node: rawNode, genre, depth, parentPath } = req.body as TextAgentRequestBody;

  if (!rawNode || typeof rawNode !== "object") {
    return res.status(400).json({ error: "Story node payload is required." });
  }

  const storyNode: StoryNode = {
    id: typeof rawNode.id === "string" && rawNode.id.trim().length > 0 ? rawNode.id : "node",
    text: typeof rawNode.text === "string" ? rawNode.text : "",
    is_ending: typeof rawNode.is_ending === "boolean" ? rawNode.is_ending : false,
    choices: Array.isArray(rawNode.choices) ? (rawNode.choices as StoryNode["choices"]) : [],
  };

  if (Array.isArray(rawNode.children)) {
    storyNode.children = rawNode.children as StoryNode[];
  }

  if (typeof rawNode.imageUrl === "string") {
    storyNode.imageUrl = rawNode.imageUrl as string;
  }

  if (typeof rawNode.audioUrl === "string") {
    storyNode.audioUrl = rawNode.audioUrl as string;
  }

  const resolvedGenre = typeof genre === "string" && genre.trim().length > 0 ? genre.trim() : "unspecified";
  const resolvedDepth = typeof depth === "number" && Number.isFinite(depth) ? depth : 0;
  const resolvedParentPath =
    Array.isArray(parentPath) && parentPath.every((item) => typeof item === "string") ? parentPath : [];

  try {
    const enrichedText = await generateStoryText(storyNode, {
      genre: resolvedGenre,
      depth: resolvedDepth,
      parentPath: resolvedParentPath,
    });

    const updatedNode = {
      ...rawNode,
      text: enrichedText,
    };

    return res.json({
      text: enrichedText,
      node: updatedNode,
      metadata: {
        genre: resolvedGenre,
        depth: resolvedDepth,
        parentPath: resolvedParentPath,
      },
    });
  } catch (error) {
    console.error("❌ Text agent route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to enrich story node text.",
      detail,
    });
  }
});

agentRouter.post("/image", async (req: Request, res: Response) => {
  const { prompt } = req.body as ImageAgentRequestBody;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Image prompt is required." });
  }

  const resolvedPrompt = prompt.trim();

  try {
    const imageUrl = await generateImage(resolvedPrompt);
    return res.json({
      imageUrl,
      prompt: resolvedPrompt,
    });
  } catch (error) {
    console.error("❌ Image agent route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to generate image.",
      detail,
    });
  }
});

agentRouter.post("/audio", async (req: Request, res: Response) => {
  const { text } = req.body as AudioAgentRequestBody;

  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Narration text is required." });
  }

  const resolvedText = text.trim();

  try {
    const audioUrl = await generateAudio(resolvedText);
    return res.json({
      audioUrl,
      text: resolvedText,
    });
  } catch (error) {
    console.error("❌ Audio agent route failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to generate audio narration.",
      detail,
    });
  }
});

export default agentRouter;

