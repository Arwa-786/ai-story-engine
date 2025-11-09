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
  requestBody?: unknown;
}

interface PanelBinding {
  requestMeta: HTMLDivElement;
  requestBody: HTMLPreElement;
  responseMeta: HTMLDivElement;
  responseBody: HTMLPreElement;
}

interface StoryChoicePayload {
  text?: string;
  nextNodeId?: string;
  [key: string]: unknown;
}

interface StoryNodePayload {
  id?: string;
  text?: string;
  is_ending?: boolean;
  choices?: StoryChoicePayload[];
  children?: StoryNodePayload[];
  [key: string]: unknown;
}

const selectors = {
  baseUrl: "backendBaseUrl",
  healthButton: "pingHealthButton",
  healthStatus: "healthStatus",
  topHealthStatus: "topHealthStatus",
  genreInput: "genreInput",
  generateButton: "generateStoryButton",
  requestMeta: "requestMeta",
  requestBody: "requestBody",
  responseMeta: "responseMeta",
  responseBody: "responseBody",
  logArea: "logArea",
  textGenreInput: "textGenreInput",
  textNodeIdInput: "textNodeIdInput",
  textNodeTextInput: "textNodeTextInput",
  textNodeIsEndingInput: "textNodeIsEndingInput",
  textNodeChoicesInput: "textNodeChoicesInput",
  textNodeDepthInput: "textNodeDepthInput",
  textNodeParentPathInput: "textNodeParentPathInput",
  textEnrichButton: "textEnrichButton",
  textRequestMeta: "textRequestMeta",
  textRequestBody: "textRequestBody",
  textResponseMeta: "textResponseMeta",
  textResponseBody: "textResponseBody",
  imagePromptInput: "imagePromptInput",
  imageGenerateButton: "imageGenerateButton",
  imageRequestMeta: "imageRequestMeta",
  imageRequestBody: "imageRequestBody",
  imageResponseMeta: "imageResponseMeta",
  imageResponseBody: "imageResponseBody",
  imagePreview: "imagePreview",
  audioTextInput: "audioTextInput",
  audioGenerateButton: "audioGenerateButton",
  audioRequestMeta: "audioRequestMeta",
  audioRequestBody: "audioRequestBody",
  audioResponseMeta: "audioResponseMeta",
  audioResponseBody: "audioResponseBody",
  audioPlayer: "audioPlayer",
};

const storageKeys = {
  baseUrl: "ai-story-engine:test-backend:baseUrl",
  genre: "ai-story-engine:test-backend:lastGenre",
};

const defaultBaseUrl = "http://localhost:3000";

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element as T;
};

const formatDuration = (value: number) => `${value.toFixed(0)}ms`;

const toPrettyJson = (value: unknown) => {
  if (value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const truncate = (value: string, length = 120) =>
  value.length <= length ? value : `${value.slice(0, length)}…`;

const resolveDetail = (value?: string) => {
  const detail = value?.trim();
  if (detail && detail.length > 0) {
    return detail;
  }
  return "No diagnostic detail reported. Verify the backend is running, CORS is enabled, and the URL is reachable.";
};

const sanitiseBaseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return defaultBaseUrl;
  }
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(withoutTrailing)) {
    return withoutTrailing;
  }
  return `http://${withoutTrailing}`;
};

const initialiseState = () => {
  const storedBaseUrl = localStorage.getItem(storageKeys.baseUrl);
  const storedGenre = localStorage.getItem(storageKeys.genre);
  return {
    baseUrl: sanitiseBaseUrl(storedBaseUrl ?? defaultBaseUrl),
    genre: storedGenre ?? "",
  };
};

const state = initialiseState();

const baseUrlInput = getElement<HTMLInputElement>(selectors.baseUrl);
const healthButton = getElement<HTMLButtonElement>(selectors.healthButton);
const healthStatus = getElement<HTMLDivElement>(selectors.healthStatus);
const topHealthStatus = document.getElementById(selectors.topHealthStatus) as HTMLDivElement | null;
const genreInput = getElement<HTMLInputElement>(selectors.genreInput);
const generateButton = getElement<HTMLButtonElement>(selectors.generateButton);
const textGenreInput = getElement<HTMLInputElement>(selectors.textGenreInput);
const textEnrichButton = getElement<HTMLButtonElement>(selectors.textEnrichButton);
const textNodeIdInput = getElement<HTMLInputElement>(selectors.textNodeIdInput);
const textNodeTextInput = getElement<HTMLTextAreaElement>(selectors.textNodeTextInput);
const textNodeIsEndingInput = getElement<HTMLInputElement>(selectors.textNodeIsEndingInput);
const textNodeChoicesInput = getElement<HTMLTextAreaElement>(selectors.textNodeChoicesInput);
const textNodeDepthInput = getElement<HTMLInputElement>(selectors.textNodeDepthInput);
const textNodeParentPathInput = getElement<HTMLInputElement>(selectors.textNodeParentPathInput);
const imagePromptInput = getElement<HTMLInputElement>(selectors.imagePromptInput);
const imageGenerateButton = getElement<HTMLButtonElement>(selectors.imageGenerateButton);
const imagePreview = getElement<HTMLImageElement>(selectors.imagePreview);
const audioTextInput = getElement<HTMLTextAreaElement>(selectors.audioTextInput);
const audioGenerateButton = getElement<HTMLButtonElement>(selectors.audioGenerateButton);
const audioPlayer = getElement<HTMLAudioElement>(selectors.audioPlayer);
const logArea = getElement<HTMLDivElement>(selectors.logArea);

const panels = {
  story: {
    requestMeta: getElement<HTMLDivElement>(selectors.requestMeta),
    requestBody: getElement<HTMLPreElement>(selectors.requestBody),
    responseMeta: getElement<HTMLDivElement>(selectors.responseMeta),
    responseBody: getElement<HTMLPreElement>(selectors.responseBody),
  },
  text: {
    requestMeta: getElement<HTMLDivElement>(selectors.textRequestMeta),
    requestBody: getElement<HTMLPreElement>(selectors.textRequestBody),
    responseMeta: getElement<HTMLDivElement>(selectors.textResponseMeta),
    responseBody: getElement<HTMLPreElement>(selectors.textResponseBody),
  },
  image: {
    requestMeta: getElement<HTMLDivElement>(selectors.imageRequestMeta),
    requestBody: getElement<HTMLPreElement>(selectors.imageRequestBody),
    responseMeta: getElement<HTMLDivElement>(selectors.imageResponseMeta),
    responseBody: getElement<HTMLPreElement>(selectors.imageResponseBody),
  },
  audio: {
    requestMeta: getElement<HTMLDivElement>(selectors.audioRequestMeta),
    requestBody: getElement<HTMLPreElement>(selectors.audioRequestBody),
    responseMeta: getElement<HTMLDivElement>(selectors.audioResponseMeta),
    responseBody: getElement<HTMLPreElement>(selectors.audioResponseBody),
  },
} satisfies Record<string, PanelBinding>;

baseUrlInput.value = state.baseUrl;
genreInput.value = state.genre;
textGenreInput.value = state.genre;

const log = (level: LogLevel, message: string) => {
  const entry = document.createElement("div");
  entry.className = `log-entry log-entry--${level}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.prepend(entry);
};

const parseChoicesInput = (raw: string): StoryChoicePayload[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.includes("|") ? "|" : line.includes("->") ? "->" : null;
      if (separator) {
        const [text, nextNodeId] = line.split(separator).map((part) => part.trim());
        return {
          text,
          nextNodeId: nextNodeId || undefined,
        };
      }
      return { text: line };
    });
};

const parseParentPathInput = (raw: string): string[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,>\n]/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const buildStoryNodePayload = (): StoryNodePayload => {
  const id = textNodeIdInput.value.trim();
  const text = textNodeTextInput.value;
  const isEnding = textNodeIsEndingInput.checked;
  const choices = parseChoicesInput(textNodeChoicesInput.value);
  return {
    id: id || "node",
    text,
    is_ending: isEnding,
    choices,
  };
};

const updateHealthStatus = (status: string, level: LogLevel = "info") => {
  healthStatus.dataset.level = level;
  healthStatus.textContent = status;
  if (topHealthStatus) {
    topHealthStatus.dataset.level = level;
    topHealthStatus.textContent = status;
  }
};

const updateRequestPanel = (panel: PanelBinding, method: string, url: string, payload?: unknown) => {
  panel.requestMeta.textContent = `${method.toUpperCase()} ${url}`;
  panel.requestBody.textContent = payload ? toPrettyJson(payload) : "—";
};

const resetResponsePanel = (panel: PanelBinding, message = "Awaiting request…") => {
  panel.responseMeta.textContent = message;
  panel.responseBody.textContent = "";
};

const updateResponsePanel = (panel: PanelBinding, response: ApiResponse) => {
  const { ok, status, statusText, method, url, elapsedMs, data, raw, error } = response;
  const outcome = ok ? "✅ Success" : "⚠️ Failure";
  panel.responseMeta.textContent = `${outcome} — ${method} ${url} → ${status} ${statusText} in ${formatDuration(
    elapsedMs,
  )}`;
  if (ok && data !== undefined) {
    panel.responseBody.textContent = toPrettyJson(data);
  } else if (raw) {
    panel.responseBody.textContent = raw;
  } else if (error) {
    panel.responseBody.textContent = error;
  } else {
    panel.responseBody.textContent = "No response body.";
  }
};

const buildUrl = (path: string) => {
  const base = sanitiseBaseUrl(baseUrlInput.value || state.baseUrl);
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalisedPath}`;
};

const executeRequest = async <T>(
  method: string,
  path: string,
  payload?: unknown,
): Promise<ApiResponse<T>> => {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
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
      requestBody: payload,
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
      requestBody: payload,
    };
  }
};

const withLoading = async (button: HTMLButtonElement, label: string, run: () => Promise<void>) => {
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
};

const handleBaseUrlCommit = () => {
  const next = sanitiseBaseUrl(baseUrlInput.value);
  state.baseUrl = next;
  localStorage.setItem(storageKeys.baseUrl, next);
  log("info", `Base URL set to ${next}`);
};

const handleHealthCheck = async () => {
  await withLoading(healthButton, "Checking…", async () => {
    updateHealthStatus("Checking backend…", "info");
    const response = await executeRequest("GET", "/");
    if (response.ok) {
      updateHealthStatus(`Healthy (${formatDuration(response.elapsedMs)})`, "success");
      log("success", `Health check succeeded at ${response.url}`);
    } else {
      const detail = resolveDetail(response.error ?? response.raw);
      updateHealthStatus(`Unreachable (${detail})`, "error");
      log("error", `Health check failed for ${response.url}: ${truncate(detail)}`);
    }
  });
};

const handleGenerateStory = async () => {
  await withLoading(generateButton, "Requesting…", async () => {
    const genre = genreInput.value.trim();
    if (!genre) {
      log("error", "Genre input is required before generating a story.");
      panels.story.responseMeta.textContent = "Missing genre input.";
      panels.story.responseBody.textContent = "";
      return;
    }

    const payload = { genre };
    const url = buildUrl("/api/story/start");

    updateRequestPanel(panels.story, "POST", url, payload);
    resetResponsePanel(panels.story, "Awaiting backend response…");

    localStorage.setItem(storageKeys.genre, genre);
    state.genre = genre;
    textGenreInput.value = genre;

    const response = await executeRequest("POST", "/api/story/start", payload);
    updateResponsePanel(panels.story, response);

    if (response.ok) {
      const nodeCount = Array.isArray((response.data as any)?.children)
        ? ((response.data as any).children as unknown[]).length
        : "unknown";
      log(
        "success",
        `Story generated for "${genre}" in ${formatDuration(response.elapsedMs)} (children: ${nodeCount}).`,
      );
    } else {
      const detail = resolveDetail(response.error ?? response.raw);
      log(
        "error",
        `Story generation failed for "${genre}" → ${response.status} ${response.statusText}: ${truncate(
          detail,
        )}`,
      );
    }
  });
};

const handleTextEnrich = async () => {
  await withLoading(textEnrichButton, "Enriching…", async () => {
    const genre = textGenreInput.value.trim() || genreInput.value.trim() || state.genre.trim();
    const nodePayload = buildStoryNodePayload();

    const finalGenre = genre || "unspecified";
    const requestPayload: Record<string, unknown> = {
      genre: finalGenre,
      node: nodePayload,
    };
    const depthRaw = textNodeDepthInput.value.trim();
    if (depthRaw.length > 0) {
      const depthValue = Number(depthRaw);
      if (!Number.isNaN(depthValue)) {
        requestPayload.depth = depthValue;
      }
    }
    const parentPath = parseParentPathInput(textNodeParentPathInput.value);
    if (parentPath.length > 0) {
      requestPayload.parentPath = parentPath;
    }

    const url = buildUrl("/api/agents/text");
    updateRequestPanel(panels.text, "POST", url, requestPayload);
    resetResponsePanel(panels.text, "Awaiting backend response…");

    const response = await executeRequest<{ text?: string; node?: StoryNodePayload }>(
      "POST",
      "/api/agents/text",
      requestPayload,
    );
    updateResponsePanel(panels.text, response);

    if (response.ok) {
      const enrichedText = (response.data?.text ?? "").trim();
      if (enrichedText.length > 0) {
        textNodeTextInput.value = enrichedText;
      }
      const updatedNode = response.data?.node as StoryNodePayload | undefined;
      if (updatedNode) {
        if (typeof updatedNode.id === "string") {
          textNodeIdInput.value = updatedNode.id;
        }
        if (typeof updatedNode.is_ending === "boolean") {
          textNodeIsEndingInput.checked = updatedNode.is_ending;
        }
        if (Array.isArray(updatedNode.choices)) {
          textNodeChoicesInput.value = updatedNode.choices
            .map((choice) => {
              const choiceText = (choice.text ?? "").trim();
              const pointer = (choice.nextNodeId ?? "").trim();
              return pointer.length > 0 ? `${choiceText} | ${pointer}` : choiceText;
            })
            .join("\n");
        }
      }
      const metadata = (response.data as { metadata?: { depth?: number; parentPath?: string[] } })?.metadata;
      if (metadata?.depth !== undefined && Number.isFinite(metadata.depth)) {
        textNodeDepthInput.value = String(metadata.depth);
      }
      if (Array.isArray(metadata?.parentPath)) {
        textNodeParentPathInput.value = metadata!.parentPath.join(",");
      }
      if (!textGenreInput.value.trim()) {
        textGenreInput.value = finalGenre;
      }
      log("success", `Text agent responded in ${formatDuration(response.elapsedMs)}.`);
    } else {
      const detail = resolveDetail(response.error ?? response.raw);
      log("error", `Text agent failed → ${response.status} ${response.statusText}: ${truncate(detail)}`);
    }
  });
};

const handleImageGenerate = async () => {
  await withLoading(imageGenerateButton, "Generating…", async () => {
    const prompt = imagePromptInput.value.trim();
    if (!prompt) {
      panels.image.responseMeta.textContent = "Image prompt is required.";
      panels.image.responseBody.textContent = "";
      log("error", "Image generation aborted: prompt is required.");
      return;
    }

    const payload = { prompt };
    const url = buildUrl("/api/agents/image");
    updateRequestPanel(panels.image, "POST", url, payload);
    resetResponsePanel(panels.image, "Awaiting backend response…");

    const response = await executeRequest<{ imageUrl?: string; prompt?: string }>(
      "POST",
      "/api/agents/image",
      payload,
    );
    updateResponsePanel(panels.image, response);

    if (response.ok) {
      const imageUrl = (response.data?.imageUrl ?? "") || (response.data as any)?.image;
      if (typeof imageUrl === "string" && imageUrl.length > 0) {
        imagePreview.src = imageUrl;
        imagePreview.alt = `Generated image for prompt "${prompt}"`;
      }
      log("success", `Image agent responded in ${formatDuration(response.elapsedMs)}.`);
    } else {
      imagePreview.removeAttribute("src");
      const detail = resolveDetail(response.error ?? response.raw);
      log("error", `Image agent failed → ${response.status} ${response.statusText}: ${truncate(detail)}`);
    }
  });
};

const handleAudioGenerate = async () => {
  await withLoading(audioGenerateButton, "Creating…", async () => {
    const text = audioTextInput.value.trim();
    if (!text) {
      panels.audio.responseMeta.textContent = "Narration text is required.";
      panels.audio.responseBody.textContent = "";
      log("error", "Audio generation aborted: narration text is required.");
      return;
    }

    const payload = { text };
    const url = buildUrl("/api/agents/audio");
    updateRequestPanel(panels.audio, "POST", url, payload);
    resetResponsePanel(panels.audio, "Awaiting backend response…");

    const response = await executeRequest<{ audioUrl?: string; text?: string }>(
      "POST",
      "/api/agents/audio",
      payload,
    );
    updateResponsePanel(panels.audio, response);

    if (response.ok) {
      const audioUrl = (response.data?.audioUrl ?? "") || (response.data as any)?.url;
      if (typeof audioUrl === "string" && audioUrl.length > 0) {
        audioPlayer.src = audioUrl;
        audioPlayer.load();
      }
      log("success", `Audio agent responded in ${formatDuration(response.elapsedMs)}.`);
    } else {
      audioPlayer.removeAttribute("src");
      audioPlayer.load();
      const detail = resolveDetail(response.error ?? response.raw);
      log("error", `Audio agent failed → ${response.status} ${response.statusText}: ${truncate(detail)}`);
    }
  });
};

baseUrlInput.addEventListener("change", handleBaseUrlCommit);
baseUrlInput.addEventListener("blur", handleBaseUrlCommit);
healthButton.addEventListener("click", handleHealthCheck);
generateButton.addEventListener("click", handleGenerateStory);
textEnrichButton.addEventListener("click", handleTextEnrich);
imageGenerateButton.addEventListener("click", handleImageGenerate);
audioGenerateButton.addEventListener("click", handleAudioGenerate);

updateRequestPanel(panels.story, "POST", buildUrl("/api/story/start"), { genre: state.genre || "fantasy" });
resetResponsePanel(panels.story);
updateHealthStatus("Awaiting health check…");

