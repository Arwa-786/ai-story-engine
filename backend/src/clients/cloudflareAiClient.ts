import { fetch, Response } from "undici";
import { StoryNode } from "../types/story.js";

export interface CloudflareAiClientConfig {
  accountId: string;
  apiToken: string;
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export class CloudflareAiClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: CloudflareAiClientConfig,
    fetchImpl: typeof fetch = fetch,
  ) {
    const { accountId, model } = config;
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    this.fetchImpl = fetchImpl;
  }

  async generateStoryTree(prompt: string): Promise<StoryNode> {
    const { apiToken, maxOutputTokens = 2048, temperature = 0.3 } = this.config;

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are an expert narrative design AI. Always answer with strict JSON that conforms to the provided schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        max_output_tokens: maxOutputTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const diagnostic = await safeReadText(response);
      throw new Error(
        `Cloudflare AI request failed with status ${response.status}: ${diagnostic}`,
      );
    }

    const payload = (await response.json()) as CloudflareRunResponse;
    const raw = payload?.result?.response ?? payload?.result?.output_text;

    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new Error(
        "Cloudflare AI response missing textual payload. Ensure the target model supports text output.",
      );
    }

    try {
      const parsed = JSON.parse(raw) as StoryNode;
      return parsed;
    } catch (error) {
      throw new Error(
        `Cloudflare AI returned invalid JSON payload. ${String((error as Error).message)}`,
      );
    }
  }
}

interface CloudflareRunResponse {
  result?: {
    response?: string;
    output_text?: string;
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}

