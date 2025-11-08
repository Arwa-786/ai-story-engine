// backend/src/agents/imageAgent.ts
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const GEMINI_IMAGE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages";

export async function generateImage(prompt: string): Promise<string> {
  const apiKey =
    process.env.GEMINI_IMAGE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

  if (!apiKey) {
    console.warn(
      "⚠️  Gemini image agent skipped: GEMINI_IMAGE_API_KEY (or GEMINI_API_KEY) missing.",
    );
    return "https://via.placeholder.com/1024x576.png?text=MISSING%20GEMINI%20KEY";
  }

  try {
    const fullPrompt = `Cinematic video game concept art of a ${prompt}. Focus on lighting and high-quality detail.`;

    const response = await axios.post(
      `${GEMINI_IMAGE_ENDPOINT}?key=${apiKey}`,
      {
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "16:9",
        },
      },
      { timeout: 30000 },
    );

    const imageData = response.data.generatedImages?.[0]?.image?.imageBytes;

    if (imageData) {
      return `data:image/jpeg;base64,${imageData}`;
    }

    throw new Error("Gemini did not return a valid image payload.");
  } catch (error: any) {
    console.error(
      "Gemini Image Generation Error:",
      error.response?.data ?? error.message,
    );
    return "https://via.placeholder.com/1024x576.png?text=GEMINI%20IMAGE%20ERROR";
  }
}