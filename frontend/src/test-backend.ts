type LogLevel = "info" | "success" | "error";

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  method: string;
  url: string;
  elapsedMs: number;
  data?: T;
  raw?: string;
  error?: string;
}

interface PanelBinding {
  requestMeta: HTMLDivElement;
  requestBody: HTMLPreElement;
  responseMeta: HTMLDivElement;
  responseBody: HTMLPreElement;
}

const selectors = {
  baseUrl: "backendBaseUrl",
  healthButton: "pingHealthButton",
  healthStatus: "healthStatus",
  hashInputs: "hashInputsTextarea",
  instructions: "instructionsTextarea",
  loadSampleButton: "loadSampleButton",
  runAgentButton: "runTextAgentButton",
  // StoryDefinition generator controls
  storyLength: "storyLength",
  storyDensity: "storyDensity",
  storyDescription: "storyDescription",
  runDefineButton: "runDefineButton",
  agentRequestMeta: "agentRequestMeta",
  agentRequestBody: "agentRequestBody",
  agentResponseMeta: "agentResponseMeta",
  agentResponseBody: "agentResponseBody",
  defineRequestMeta: "defineRequestMeta",
  defineRequestBody: "defineRequestBody",
  defineResponseMeta: "defineResponseMeta",
  defineResponseBody: "defineResponseBody",
  logArea: "logArea",
  imagePromptInput: "imagePromptInput",
  runImageAgentButton: "runImageAgentButton",
  imageAgentRequestMeta: "imageAgentRequestMeta",
  imageAgentRequestBody: "imageAgentRequestBody",
  imageAgentResponseMeta: "imageAgentResponseMeta",
  imageAgentResponseBody: "imageAgentResponseBody",
  imagePreview: "imagePreview",
} as const;

const storageKeys = {
  baseUrl: "ai-hash-text:baseUrl",
} as const;

const defaultBaseUrl = "http://localhost:3000";

const samplePayload = {
  topic: "hash-driven content planners",
  tone: "confident and concise",
  audience: "VP of Product",
  call_to_action: "Highlight the benefits of delegating to AI agents.",
};

class BackendAgentTester {
  private baseUrlInput: HTMLInputElement;
  private healthButton: HTMLButtonElement;
  private healthStatus: HTMLDivElement;
  private hashInputsTextarea: HTMLTextAreaElement;
  private instructionsTextarea: HTMLTextAreaElement;
  private loadSampleButton: HTMLButtonElement;
  private runAgentButton: HTMLButtonElement;
  private storyLengthSelect: HTMLSelectElement;
  private storyDensitySelect: HTMLSelectElement;
  private storyDescriptionTextarea: HTMLTextAreaElement;
  private runDefineButton: HTMLButtonElement;
  private imagePromptInput: HTMLInputElement;
  private runImageAgentButton: HTMLButtonElement;
  private imagePreview: HTMLImageElement;
  private logArea: HTMLDivElement;
  private panels: { agent: PanelBinding; define: PanelBinding; image: PanelBinding };

  static maybeInit(): void {
    const requiredIds = [
      selectors.baseUrl,
      selectors.healthButton,
      selectors.healthStatus,
      selectors.hashInputs,
      selectors.instructions,
      selectors.loadSampleButton,
      selectors.runAgentButton,
      selectors.storyLength,
      selectors.storyDensity,
      selectors.storyDescription,
      selectors.runDefineButton,
      selectors.agentRequestMeta,
      selectors.agentRequestBody,
      selectors.agentResponseMeta,
      selectors.agentResponseBody,
      selectors.defineRequestMeta,
      selectors.defineRequestBody,
      selectors.defineResponseMeta,
      selectors.defineResponseBody,
      selectors.imagePromptInput,
      selectors.runImageAgentButton,
      selectors.imageAgentRequestMeta,
      selectors.imageAgentRequestBody,
      selectors.imageAgentResponseMeta,
      selectors.imageAgentResponseBody,
      selectors.imagePreview,
      selectors.logArea,
    ];
    const missing = requiredIds.filter((id) => !document.getElementById(id));
    if (missing.length > 0) {
      // Not on the tester page; do nothing
      return;
    }
    new BackendAgentTester().init();
  }

  private constructor() {
    this.baseUrlInput = this.getElement<HTMLInputElement>(selectors.baseUrl);
    this.healthButton = this.getElement<HTMLButtonElement>(selectors.healthButton);
    this.healthStatus = this.getElement<HTMLDivElement>(selectors.healthStatus);
    this.hashInputsTextarea = this.getElement<HTMLTextAreaElement>(selectors.hashInputs);
    this.instructionsTextarea = this.getElement<HTMLTextAreaElement>(selectors.instructions);
    this.loadSampleButton = this.getElement<HTMLButtonElement>(selectors.loadSampleButton);
    this.runAgentButton = this.getElement<HTMLButtonElement>(selectors.runAgentButton);
    this.storyLengthSelect = this.getElement<HTMLSelectElement>(selectors.storyLength);
    this.storyDensitySelect = this.getElement<HTMLSelectElement>(selectors.storyDensity);
    this.storyDescriptionTextarea = this.getElement<HTMLTextAreaElement>(selectors.storyDescription);
    this.runDefineButton = this.getElement<HTMLButtonElement>(selectors.runDefineButton);
    this.imagePromptInput = this.getElement<HTMLInputElement>(selectors.imagePromptInput);
    this.runImageAgentButton = this.getElement<HTMLButtonElement>(selectors.runImageAgentButton);
    this.imagePreview = this.getElement<HTMLImageElement>(selectors.imagePreview);
    this.logArea = this.getElement<HTMLDivElement>(selectors.logArea);
    this.panels = {
      agent: {
        requestMeta: this.getElement<HTMLDivElement>(selectors.agentRequestMeta),
        requestBody: this.getElement<HTMLPreElement>(selectors.agentRequestBody),
        responseMeta: this.getElement<HTMLDivElement>(selectors.agentResponseMeta),
        responseBody: this.getElement<HTMLPreElement>(selectors.agentResponseBody),
      },
      define: {
        requestMeta: this.getElement<HTMLDivElement>(selectors.defineRequestMeta),
        requestBody: this.getElement<HTMLPreElement>(selectors.defineRequestBody),
        responseMeta: this.getElement<HTMLDivElement>(selectors.defineResponseMeta),
        responseBody: this.getElement<HTMLPreElement>(selectors.defineResponseBody),
      },
      image: {
        requestMeta: this.getElement<HTMLDivElement>(selectors.imageAgentRequestMeta),
        requestBody: this.getElement<HTMLPreElement>(selectors.imageAgentRequestBody),
        responseMeta: this.getElement<HTMLDivElement>(selectors.imageAgentResponseMeta),
        responseBody: this.getElement<HTMLPreElement>(selectors.imageAgentResponseBody),
      },
    };
  }

  private init(): void {
    const initialBaseUrl = BackendAgentTester.sanitiseBaseUrl(
      localStorage.getItem(storageKeys.baseUrl) ?? defaultBaseUrl,
    );
    this.baseUrlInput.value = initialBaseUrl;

    this.baseUrlInput.addEventListener("change", () => this.commitBaseUrl());
    this.baseUrlInput.addEventListener("blur", () => this.commitBaseUrl());
    this.healthButton.addEventListener("click", () => this.handleHealthCheck());
    this.loadSampleButton.addEventListener("click", () => this.handleSampleLoad());
    this.runAgentButton.addEventListener("click", async () => {
      await this.withLoading(this.runAgentButton, "Calling…", async () => {
        try {
          await this.invokeAgent();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown parsing error.";
          this.log("error", message);
          this.panels.agent.responseMeta.textContent = message;
          this.panels.agent.responseBody.textContent = "";
        }
      });
    });
    this.runDefineButton.addEventListener("click", async () => {
      await this.withLoading(this.runDefineButton, "Generating…", async () => {
        try {
          await this.invokeDefine();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error.";
          this.log("error", message);
          this.panels.define.responseMeta.textContent = message;
          this.panels.define.responseBody.textContent = "";
        }
      });
    });
    this.runImageAgentButton.addEventListener("click", async () => {
      await this.withLoading(this.runImageAgentButton, "Generating…", async () => {
        try {
          await this.invokeImageAgent();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown image error.";
          this.log("error", message);
          this.panels.image.responseMeta.textContent = message;
          this.panels.image.responseBody.textContent = "";
          this.imagePreview.removeAttribute("src");
        }
      });
    });

    this.updateRequestPanel(
      this.panels.agent,
      "POST",
      this.buildUrl("/api/text/generate"),
      { inputs: samplePayload },
    );
    this.resetResponsePanel(this.panels.agent);
    this.updateRequestPanel(
      this.panels.define,
      "POST",
      this.buildUrl("/api/story/define"),
      this.buildDefinePayload(),
    );
    this.resetResponsePanel(this.panels.define);
    this.updateHealthStatus("Awaiting health check…", "info");
    this.handleSampleLoad();

    // Seed image panel
    const imageUrl = this.buildUrl("/api/agents/image/generate");
    this.updateRequestPanel(this.panels.image, "POST", imageUrl, { prompt: "(enter prompt and click generate)" });
    this.resetResponsePanel(this.panels.image);
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id "${id}" not found`);
    }
    return element as T;
  }

  private static formatDuration(value: number): string {
    return `${value.toFixed(0)}ms`;
  }

  private static toPrettyJson(value: unknown): string {
    if (value === undefined) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private static truncate(value: string, length = 120): string {
    return value.length <= length ? value : `${value.slice(0, length)}…`;
  }

  private static resolveDetail(value?: string): string {
    const detail = value?.trim();
    if (detail && detail.length > 0) return detail;
    return "No diagnostic detail reported. Verify the backend is running, CORS is enabled, and the URL is reachable.";
  }

  private static sanitiseBaseUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return defaultBaseUrl;
    const withoutTrailing = trimmed.replace(/\/+$/, "");
    if (/^https?:\/\//i.test(withoutTrailing)) return withoutTrailing;
    return `http://${withoutTrailing}`;
  }

  private commitBaseUrl(): void {
    const next = BackendAgentTester.sanitiseBaseUrl(this.baseUrlInput.value);
    this.baseUrlInput.value = next;
    localStorage.setItem(storageKeys.baseUrl, next);
    this.log("info", `Base URL set to ${next}`);
  }

  private buildUrl(path: string): string {
    const base = BackendAgentTester.sanitiseBaseUrl(this.baseUrlInput.value || defaultBaseUrl);
    const normalisedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalisedPath}`;
  }

  private async executeRequest<T>(method: string, path: string, payload?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = { Accept: "application/json" };
    const options: RequestInit = { method, headers };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const startedAt = performance.now();
    try {
      const response = await fetch(url, options);
      const elapsedMs = performance.now() - startedAt;
      const rawText = await response.text();
      let parsed: unknown;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = undefined;
        }
      }
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        method,
        url,
        elapsedMs,
        data: parsed as T,
        raw: parsed === undefined ? rawText : undefined,
      };
    } catch (error) {
      const elapsedMs = performance.now() - startedAt;
      return {
        ok: false,
        status: 0,
        statusText: "NETWORK_ERROR",
        method,
        url,
        elapsedMs,
        error: error instanceof Error ? error.message : "Unknown network error",
      };
    }
  }

  private async withLoading(button: HTMLButtonElement, label: string, run: () => Promise<void>): Promise<void> {
    const original = button.dataset.label ?? button.textContent ?? "";
    button.dataset.label = original;
    button.disabled = true;
    button.textContent = label;
    try {
      await run();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  private parseHashInputs(): Record<string, unknown> {
    const raw = this.hashInputsTextarea.value.trim();
    if (!raw) {
      throw new Error("Please provide at least one hash input.");
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Hash inputs must be expressed as a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON payload.";
      throw new Error(message);
    }
  }

  private buildAgentPayload(): Record<string, unknown> {
    const inputs = this.parseHashInputs();
    const instructions = this.instructionsTextarea.value.trim();
    return instructions.length > 0 ? { inputs, instructions } : { inputs };
  }

  private async handleHealthCheck(): Promise<void> {
    await this.withLoading(this.healthButton, "Checking…", async () => {
      this.updateHealthStatus("Checking backend…", "info");
      const response = await this.executeRequest("GET", "/");
      if (response.ok) {
        this.updateHealthStatus(
          `Healthy (${BackendAgentTester.formatDuration(response.elapsedMs)})`,
          "success",
        );
        this.log("success", `Health check succeeded at ${response.url}`);
      } else {
        const detail = BackendAgentTester.resolveDetail(response.error ?? response.raw);
        this.updateHealthStatus(`Unreachable (${detail})`, "error");
        this.log("error", `Health check failed for ${response.url}: ${BackendAgentTester.truncate(detail)}`);
      }
    });
  }

  private async invokeAgent(): Promise<void> {
    const payload = this.buildAgentPayload();
    const url = this.buildUrl("/api/text/generate");
    this.updateRequestPanel(this.panels.agent, "POST", url, payload);
    this.resetResponsePanel(this.panels.agent, "Awaiting backend response…");
    const response = await this.executeRequest("POST", "/api/text/generate", payload);
    this.updateResponsePanel(this.panels.agent, response);
    if (response.ok) {
      this.log("success", `Text agent responded in ${BackendAgentTester.formatDuration(response.elapsedMs)}.`);
    } else {
      const detail = BackendAgentTester.resolveDetail(response.error ?? response.raw);
      this.log("error", `Text agent failed → ${response.status} ${response.statusText}: ${BackendAgentTester.truncate(detail)}`);
    }
  }

  private async invokeImageAgent(): Promise<void> {
    const prompt = this.imagePromptInput.value.trim();
    if (!prompt) {
      throw new Error("Please enter an image prompt.");
    }
    const payload = { prompt };
    const url = this.buildUrl("/api/agents/image/generate");
    this.updateRequestPanel(this.panels.image, "POST", url, payload);
    this.resetResponsePanel(this.panels.image, "Awaiting backend response…");
    const response = await this.executeRequest<{ imageBase64: string; mimeType: string; modelId: string; elapsedMs: number }>(
      "POST",
      "/api/agents/image/generate",
      payload,
    );
    this.updateResponsePanel(this.panels.image, response);
    if (response.ok && response.data) {
      const { imageBase64, mimeType } = response.data;
      if (imageBase64) {
        this.imagePreview.src = `data:${mimeType || "image/png"};base64,${imageBase64}`;
        this.log("success", `Image generated in ${BackendAgentTester.formatDuration(response.elapsedMs)}.`);
      } else {
        this.imagePreview.removeAttribute("src");
        this.log("error", "No image data returned.");
      }
    } else {
      this.imagePreview.removeAttribute("src");
      const detail = BackendAgentTester.resolveDetail(response.error ?? response.raw);
      this.log("error", `Image agent failed → ${response.status} ${response.statusText}: ${BackendAgentTester.truncate(detail)}`);
    }
  }

  private handleSampleLoad(): void {
    this.hashInputsTextarea.value = JSON.stringify(samplePayload, null, 2);
    this.instructionsTextarea.value = "Compose an executive-ready summary that blends the provided hashes.";
    // Prefill a StoryConfiguration example
    this.storyLengthSelect.value = "medium";
    this.storyDensitySelect.value = "medium";
    this.storyDescriptionTextarea.value = "A cozy mystery about a librarian in a seaside town.";
    this.log("info", "Loaded sample hash input.");
  }

  private buildDefinePayload(): { length: string; density: string; description: string } {
    const length = (this.storyLengthSelect.value || "medium").trim();
    const density = (this.storyDensitySelect.value || "medium").trim();
    const description = (this.storyDescriptionTextarea.value || "").trim();
    return { length, density, description };
  }

  private async invokeDefine(): Promise<void> {
    const payload = this.buildDefinePayload();
    const url = this.buildUrl("/api/story/define");
    this.updateRequestPanel(this.panels.define, "POST", url, payload);
    this.resetResponsePanel(this.panels.define, "Awaiting backend response…");
    const response = await this.executeRequest("POST", "/api/story/define", payload);
    this.updateResponsePanel(this.panels.define, response);
    if (response.ok) {
      this.log("success", `StoryDefinition generated in ${BackendAgentTester.formatDuration(response.elapsedMs)}.`);
    } else {
      const detail = BackendAgentTester.resolveDetail(response.error ?? response.raw);
      this.log("error", `StoryDefinition generation failed → ${response.status} ${response.statusText}: ${BackendAgentTester.truncate(detail)}`);
    }
  }

  private log(level: LogLevel, message: string): void {
    const entry = document.createElement("div");
    entry.className = `log-entry log-entry--${level}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.logArea.prepend(entry);
  }

  private updateHealthStatus(status: string, level: LogLevel = "info"): void {
    this.healthStatus.dataset.level = level;
    this.healthStatus.textContent = status;
  }

  private updateRequestPanel(panel: PanelBinding, method: string, url: string, payload?: unknown): void {
    panel.requestMeta.textContent = `${method.toUpperCase()} ${url}`;
    panel.requestBody.textContent = payload ? BackendAgentTester.toPrettyJson(payload) : "—";
  }

  private resetResponsePanel(panel: PanelBinding, message = "Awaiting request…"): void {
    panel.responseMeta.textContent = message;
    panel.responseBody.textContent = "";
  }

  private updateResponsePanel(panel: PanelBinding, response: ApiResponse): void {
    const { ok, status, statusText, method, url, elapsedMs, data, raw, error } = response;
    const outcome = ok ? "✅ Success" : "⚠️ Failure";
    panel.responseMeta.textContent = `${outcome} — ${method} ${url} → ${status} ${statusText} in ${BackendAgentTester.formatDuration(
      elapsedMs,
    )}`;
    if (ok && data !== undefined) {
      panel.responseBody.textContent = BackendAgentTester.toPrettyJson(data);
    } else if (raw) {
      panel.responseBody.textContent = raw;
    } else if (error) {
      panel.responseBody.textContent = error;
    } else {
      panel.responseBody.textContent = "No response body.";
    }
  }
}

// Auto-init only when tester elements are present on the page
BackendAgentTester.maybeInit();

