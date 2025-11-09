import { createHash } from "node:crypto";

export interface ImageCacheEntry {
	imageBase64: string;
	mimeType: string;
	modelId: string;
	updatedAt: number;
	expiresAt: number;
}

/**
 * Lightweight in-memory LRU cache with TTL for generated images.
 * Keyed by sha256(`${modelId}::${prompt}`).
 */
class ImageLruCache {
	private map: Map<string, ImageCacheEntry>;
	private readonly capacity: number;
	private readonly ttlMs: number;

	constructor(capacity: number, ttlMs: number) {
		this.map = new Map();
		this.capacity = Math.max(10, capacity);
		this.ttlMs = Math.max(60_000, ttlMs);
	}

	get(key: string): ImageCacheEntry | null {
		const existing = this.map.get(key);
		if (!existing) return null;
		// Expired?
		if (existing.expiresAt <= Date.now()) {
			this.map.delete(key);
			return null;
		}
		// Bump recency (LRU)
		this.map.delete(key);
		this.map.set(key, existing);
		return existing;
	}

	set(key: string, value: Omit<ImageCacheEntry, "updatedAt" | "expiresAt">): void {
		const entry: ImageCacheEntry = {
			...value,
			updatedAt: Date.now(),
			expiresAt: Date.now() + this.ttlMs,
		};
		if (this.map.has(key)) {
			this.map.delete(key);
		}
		this.map.set(key, entry);
		this.evictIfNeeded();
	}

	private evictIfNeeded(): void {
		if (this.map.size <= this.capacity) return;
		// Evict oldest entries until within capacity
		const toRemove = this.map.size - this.capacity;
		let i = 0;
		for (const k of this.map.keys()) {
			this.map.delete(k);
			i += 1;
			if (i >= toRemove) break;
		}
	}
}

const DEFAULT_CAPACITY = Number.parseInt(process.env.IMAGE_CACHE_CAPACITY || "", 10);
const DEFAULT_TTL_MS = Number.parseInt(process.env.IMAGE_CACHE_TTL_MS || "", 10);
const cache = new ImageLruCache(
	Number.isFinite(DEFAULT_CAPACITY) && DEFAULT_CAPACITY > 0 ? DEFAULT_CAPACITY : 200,
	Number.isFinite(DEFAULT_TTL_MS) && DEFAULT_TTL_MS > 0 ? DEFAULT_TTL_MS : 6 * 60 * 60 * 1000, // 6 hours
);

export function getImageCacheKey(prompt: string, modelId?: string): string {
	const model = (modelId || "").trim();
	const normalizedPrompt = prompt.trim().replace(/\s+/g, " ");
	const hash = createHash("sha256").update(`${model}::${normalizedPrompt}`, "utf8").digest("hex");
	return hash;
}

export function getCachedImage(prompt: string, modelId?: string): ImageCacheEntry | null {
	const key = getImageCacheKey(prompt, modelId);
	return cache.get(key);
}

export function setCachedImage(
	prompt: string,
	modelId: string | undefined,
	imageBase64: string,
	mimeType: string,
): void {
	const key = getImageCacheKey(prompt, modelId);
	cache.set(key, {
		imageBase64,
		mimeType,
		modelId: modelId || "",
	});
}


