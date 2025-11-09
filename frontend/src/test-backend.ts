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

const selectors = {
  baseUrl: "backendBaseUrl",
  healthButton: "pingHealthButton",
  healthStatus: "healthStatus",
  topHealthStatus: "topHealthStatus",
  hashInputs: "hashInputsTextarea",
  instructions: "instructionsTextarea",
  loadSampleButton: "loadSampleButton",
  runAgentButton: "runTextAgentButton",
  agentRequestMeta: "agentRequestMeta",
  agentRequestBody: "agentRequestBody",
  agentResponseMeta: "agentResponseMeta",
  agentResponseBody: "agentResponseBody",
  logArea: "logArea",
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

const initialBaseUrl =
  sanitiseBaseUrl(localStorage.getItem(storageKeys.baseUrl) ?? defaultBaseUrl);

const baseUrlInput = getElement<HTMLInputElement>(selectors.baseUrl);
const healthButton = getElement<HTMLButtonElement>(selectors.healthButton);
const healthStatus = getElement<HTMLDivElement>(selectors.healthStatus);
const topHealthStatus = document.getElementById(
  selectors.topHealthStatus,
) as HTMLDivElement | null;
const hashInputsTextarea = getElement<HTMLTextAreaElement>(
  selectors.hashInputs,
);
const instructionsTextarea = getElement<HTMLTextAreaElement>(
  selectors.instructions,
);
const loadSampleButton = getElement<HTMLButtonElement>(
  selectors.loadSampleButton,
);
const runAgentButton = getElement<HTMLButtonElement>(selectors.runAgentButton);
const logArea = getElement<HTMLDivElement>(selectors.logArea);

const panels = {
  agent: {
    requestMeta: getElement<HTMLDivElement>(selectors.agentRequestMeta),
    requestBody: getElement<HTMLPreElement>(selectors.agentRequestBody),
    responseMeta: getElement<HTMLDivElement>(selectors.agentResponseMeta),
    responseBody: getElement<HTMLPreElement>(selectors.agentResponseBody),
  },
} satisfies Record<string, PanelBinding>;

baseUrlInput.value = initialBaseUrl;

const log = (level: LogLevel, message: string) => {
  const entry = document.createElement("div");
  entry.className = `log-entry log-entry--${level}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.prepend(entry);
};

const updateHealthStatus = (status: string, level: LogLevel = "info") => {
  healthStatus.dataset.level = level;
  healthStatus.textContent = status;
  if (topHealthStatus) {
    topHealthStatus.dataset.level = level;
    topHealthStatus.textContent = status;
  }
};

const updateRequestPanel = (
  panel: PanelBinding,
  method: string,
  url: string,
  payload?: unknown,
) => {
  panel.requestMeta.textContent = `${method.toUpperCase()} ${url}`;
  panel.requestBody.textContent = payload ? toPrettyJson(payload) : "—";
};

const resetResponsePanel = (
  panel: PanelBinding,
  message = "Awaiting request…",
) => {
  panel.responseMeta.textContent = message;
  panel.responseBody.textContent = "";
};

const updateResponsePanel = (panel: PanelBinding, response: ApiResponse) => {
  const { ok, status, statusText, method, url, elapsedMs, data, raw, error } =
    response;
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
  const base = sanitiseBaseUrl(baseUrlInput.value || initialBaseUrl);
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

const withLoading = async (
  button: HTMLButtonElement,
  label: string,
  run: () => Promise<void>,
) => {
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

const commitBaseUrl = () => {
  const next = sanitiseBaseUrl(baseUrlInput.value);
  baseUrlInput.value = next;
  localStorage.setItem(storageKeys.baseUrl, next);
  log("info", `Base URL set to ${next}`);
};

const parseHashInputs = (): Record<string, unknown> => {
  const raw = hashInputsTextarea.value.trim();
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
    const message =
      error instanceof Error ? error.message : "Invalid JSON payload.";
    throw new Error(message);
  }
};

const buildAgentPayload = () => {
  const inputs = parseHashInputs();
  const instructions = instructionsTextarea.value.trim();
  return instructions.length > 0
    ? { inputs, instructions }
    : { inputs };
};

const handleHealthCheck = async () => {
  await withLoading(healthButton, "Checking…", async () => {
    updateHealthStatus("Checking backend…", "info");
    const response = await executeRequest("GET", "/");
    if (response.ok) {
      updateHealthStatus(
        `Healthy (${formatDuration(response.elapsedMs)})`,
        "success",
      );
      log("success", `Health check succeeded at ${response.url}`);
    } else {
      const detail = resolveDetail(response.error ?? response.raw);
      updateHealthStatus(`Unreachable (${detail})`, "error");
      log(
        "error",
        `Health check failed for ${response.url}: ${truncate(detail)}`,
      );
    }
  });
};

const invokeAgent = async () => {
  const payload = buildAgentPayload();
  const url = buildUrl("/api/text/generate");

  updateRequestPanel(panels.agent, "POST", url, payload);
  resetResponsePanel(panels.agent, "Awaiting backend response…");

  const response = await executeRequest("POST", "/api/text/generate", payload);
  updateResponsePanel(panels.agent, response);

  if (response.ok) {
    log(
      "success",
      `Text agent responded in ${formatDuration(response.elapsedMs)}.`,
    );
  } else {
    const detail = resolveDetail(response.error ?? response.raw);
    log(
      "error",
      `Text agent failed → ${response.status} ${response.statusText}: ${truncate(
        detail,
      )}`,
    );
  }
};

const handleSampleLoad = () => {
  hashInputsTextarea.value = JSON.stringify(samplePayload, null, 2);
  instructionsTextarea.value =
    "Compose an executive-ready summary that blends the provided hashes.";
  log("info", "Loaded sample hash input.");
};

baseUrlInput.addEventListener("change", commitBaseUrl);
baseUrlInput.addEventListener("blur", commitBaseUrl);
healthButton.addEventListener("click", () => handleHealthCheck());
loadSampleButton.addEventListener("click", () => handleSampleLoad());

runAgentButton.addEventListener("click", async () => {
  await withLoading(runAgentButton, "Calling…", async () => {
    try {
      await invokeAgent();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parsing error.";
      log("error", message);
      panels.agent.responseMeta.textContent = message;
      panels.agent.responseBody.textContent = "";
    }
  });
});

updateRequestPanel(
  panels.agent,
  "POST",
  buildUrl("/api/text/generate"),
  { inputs: samplePayload },
);
resetResponsePanel(panels.agent);
updateHealthStatus("Awaiting health check…");
handleSampleLoad();

