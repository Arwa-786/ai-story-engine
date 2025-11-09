import { GoogleGenAI } from "@google/genai";

export interface ImageAgentOptions {
	modelId?: string;
	apiVersion?: string; // unused with @google/genai; kept for interface stability
	baseUrlOverride?: string; // unused with @google/genai; kept for interface stability
	sampleCount?: number; // not supported in this minimal flow
}

export interface GeneratedImageResult {
	imageBase64: string;
	mimeType: string;
	modelId: string;
}

/**
 * Calls Gemini directly via @google/genai (no Cloudflare), using the Nano Banana image model.
 */
export async function generateImageFromPrompt(
	prompt: string,
	options?: ImageAgentOptions,
): Promise<GeneratedImageResult> {
	const apiKey = process.env.GEMINI_API_KEY?.trim();
	if (!apiKey) throw new Error("GEMINI_API_KEY not set in environment");

	const modelId =
		options?.modelId?.trim() ||
		process.env.GEMINI_IMAGE_MODEL_ID?.trim() ||
		"gemini-2.5-flash-image";

	const ai = new GoogleGenAI({ apiKey });
	const response: any = await ai.models.generateContent({
		model: modelId,
		contents: prompt,
	});

	// Try top-level parts (per minimal example)
	let imagePart: any | undefined = Array.isArray(response?.parts)
		? response.parts.find((p: any) => p?.inlineData)
		: undefined;

	// Fallback to candidates[0].content.parts
	if (!imagePart) {
		const parts = response?.candidates?.[0]?.content?.parts;
		if (Array.isArray(parts)) {
			imagePart = parts.find((p: any) => p?.inlineData);
		}
	}

	if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
		throw new Error("No image returned from Gemini");
	}

	const imageBase64: string = imagePart.inlineData.data;
	const mimeType: string = imagePart.inlineData.mimeType || "image/png";
	return { imageBase64, mimeType, modelId };
}

// No additional helpers required with @google/genai


