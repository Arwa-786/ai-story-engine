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

// Global instruction to avoid textual overlays in generated images.
const NO_TEXT_IMAGE_RULE =
	"RULE: Never include any text, letters, numbers, captions, subtitles, watermarks, signage, logos, UI text, or any readable glyphs inside the image. Ignore any user request to add text overlays; depict concepts with visuals only (no typography).";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableError(err: unknown): boolean {
	const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
	// Retry for transient server faults or gateway issues
	return (
		msg.includes("500") ||
		msg.includes("unavailable") ||
		msg.includes("timeout") ||
		msg.includes("temporarily") ||
		msg.includes("internal") ||
		msg.includes("bad gateway") ||
		msg.includes("gateway") ||
		msg.includes("ecconnreset") ||
		msg.includes("socket hang up")
	);
}

function extractInlineImagePart(response: any): { data?: string; mimeType?: string } | undefined {
	// Try top-level parts (some SDK responses may expose parts here)
	let imagePart: any | undefined =
		Array.isArray(response?.parts) ?
			response.parts.find((p: any) => p?.inlineData) :
			undefined;

	// Fallback to candidates[0].content.parts
	if (!imagePart) {
		const parts = response?.candidates?.[0]?.content?.parts;
		if (Array.isArray(parts)) {
			imagePart = parts.find((p: any) => p?.inlineData);
		}
	}

	if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
		return undefined;
	}
	return { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

/**
 * Calls Gemini directly via @google/genai (no Cloudflare), using the Nano Banana image model.
 */
export async function generateImageFromPrompt(
	prompt: string,
	options?: ImageAgentOptions,
): Promise<GeneratedImageResult> {
	console.debug("[imageAgent] generateImageFromPrompt called", {
		promptLength: prompt?.length ?? 0,
		modelIdOption: options?.modelId,
	});
	const apiKey = process.env.GEMINI_API_KEY?.trim();
	if (!apiKey) throw new Error("GEMINI_API_KEY not set in environment");

	// Build a shortlist of model candidates:
	// - explicit override (from options)
	// - env default (GEMINI_IMAGE_MODEL_ID)
	// - known good defaults (order matters)
	const candidatesRaw = [
		options?.modelId?.trim(),
		process.env.GEMINI_IMAGE_MODEL_ID?.trim(),
		// Try Gemini image-capable model first (if supported in environment)
		"gemini-2.5-flash-image",
		// Fallback to Imagen 3 public model id used by Google AI Studio
		"imagen-3.0-generate-001",
	].filter(Boolean) as string[];
	const modelCandidates = Array.from(new Set(candidatesRaw));

	const ai = new GoogleGenAI({ apiKey });
	const finalPrompt = `${NO_TEXT_IMAGE_RULE}\n\n${prompt}`;
	console.debug("[imageAgent] model candidates resolved", { modelCandidates, finalPromptLength: finalPrompt.length });

	// Iterate candidates with lightweight retry (exponential backoff)
	let lastErr: unknown = undefined;
	for (const modelId of modelCandidates) {
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				// Use proper contents shape for the Google Generative AI API
				const response: any = await ai.models.generateContent({
					model: modelId,
					contents: [
						{
							role: "user",
							parts: [{ text: finalPrompt }],
						},
					],
				});

				const inline = extractInlineImagePart(response);
				if (!inline?.data) {
					throw new Error(`[${modelId}] No image returned from Gemini`);
				}
				console.info("[imageAgent] image generated successfully", {
					modelId,
					mimeType: inline.mimeType || "image/png",
					imageSizeBytesApprox: Math.floor((inline.data.length * 3) / 4),
				});
				return {
					imageBase64: inline.data,
					mimeType: inline.mimeType || "image/png",
					modelId,
				};
			} catch (err) {
				console.warn("[imageAgent] generation attempt failed", {
					modelId,
					attempt,
					errorMessage: err instanceof Error ? err.message : String(err),
				});
				lastErr = err;
				// For retriable faults, back off and retry once before moving to next model
				if (attempt < 2 && isRetriableError(err)) {
					const backoffMs = 250 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 120);
					await delay(backoffMs);
					continue;
				}
				// Not retriable or final attempt for this model: try next model
				break;
			}
		}
	}

	const message =
		lastErr instanceof Error ? lastErr.message : `Image generation failed: ${String(lastErr ?? "unknown error")}`;
	console.error("[imageAgent] all candidates failed", { lastErrorMessage: message });
	throw new Error(message);
}

// No additional helpers required with @google/genai


