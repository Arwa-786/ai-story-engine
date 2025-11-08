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

const selectors = {
  baseUrl: "backendBaseUrl",
  healthButton: "pingHealthButton",
  healthStatus: "healthStatus",
  genreInput: "genreInput",
  generateButton: "generateStoryButton",
  requestMeta: "requestMeta",
  requestBody: "requestBody",
  responseMeta: "responseMeta",
  responseBody: "responseBody",
  logArea: "logArea",
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
  return trimmed.replace(/\/+$/, "");
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
const genreInput = getElement<HTMLInputElement>(selectors.genreInput);
const generateButton = getElement<HTMLButtonElement>(selectors.generateButton);
const requestMeta = getElement<HTMLDivElement>(selectors.requestMeta);
const requestBody = getElement<HTMLPreElement>(selectors.requestBody);
const responseMeta = getElement<HTMLDivElement>(selectors.responseMeta);
const responseBody = getElement<HTMLPreElement>(selectors.responseBody);
const logArea = getElement<HTMLDivElement>(selectors.logArea);

baseUrlInput.value = state.baseUrl;
genreInput.value = state.genre;

const log = (level: LogLevel, message: string) => {
  const entry = document.createElement("div");
  entry.className = `log-entry log-entry--${level}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.prepend(entry);
};

const updateHealthStatus = (status: string, level: LogLevel = "info") => {
  healthStatus.dataset.level = level;
  healthStatus.textContent = status;
};

const updateRequestPanel = (method: string, url: string, payload?: unknown) => {
  requestMeta.textContent = `${method.toUpperCase()} ${url}`;
  requestBody.textContent = payload ? toPrettyJson(payload) : "—";
};

const resetResponsePanel = (message = "Awaiting request…") => {
  responseMeta.textContent = message;
  responseBody.textContent = "";
};

const updateResponsePanel = (response: ApiResponse) => {
  const { ok, status, statusText, method, url, elapsedMs, data, raw, error } = response;
  const outcome = ok ? "✅ Success" : "⚠️ Failure";
  responseMeta.textContent = `${outcome} — ${method} ${url} → ${status} ${statusText} in ${formatDuration(
    elapsedMs,
  )}`;
  if (ok && data !== undefined) {
    responseBody.textContent = toPrettyJson(data);
  } else if (raw) {
    responseBody.textContent = raw;
  } else if (error) {
    responseBody.textContent = error;
  } else {
    responseBody.textContent = "No response body.";
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
  await withLoading(healthButton, "Pinging…", async () => {
    updateHealthStatus("Pinging backend…", "info");
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
      responseMeta.textContent = "Missing genre input.";
      responseBody.textContent = "";
      return;
    }

    const payload = { genre };
    const url = buildUrl("/api/story/start");

    updateRequestPanel("POST", url, payload);
    resetResponsePanel("Awaiting backend response…");

    localStorage.setItem(storageKeys.genre, genre);
    state.genre = genre;

    const response = await executeRequest("POST", "/api/story/start", payload);
    updateResponsePanel(response);

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

baseUrlInput.addEventListener("change", handleBaseUrlCommit);
baseUrlInput.addEventListener("blur", handleBaseUrlCommit);
healthButton.addEventListener("click", handleHealthCheck);
generateButton.addEventListener("click", handleGenerateStory);

updateRequestPanel("POST", buildUrl("/api/story/start"), { genre: state.genre || "fantasy" });
resetResponsePanel();
updateHealthStatus("Awaiting health check…");

