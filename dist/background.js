// src/domain/archive-links.ts
var ARCHIVE_HOSTS = ["filestore.me", "terabytez.org"];
function normalizeArchiveUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const knownHost = ARCHIVE_HOSTS.includes(url.hostname);
    const directArchive = /\.(?:rar|rev)$/i.test(url.pathname);
    const bareFileId = /^\/[a-z0-9]{12}\/?$/i.test(url.pathname) && !url.search && !url.hash;
    if (url.protocol !== "https:" || !knownHost || url.port || url.username || url.password) {
      return null;
    }
    return directArchive || bareFileId ? url.href : null;
  } catch {
    return null;
  }
}
function selectArchiveLinks(values, hosts) {
  const selected = new Set(hosts.filter((host) => ARCHIVE_HOSTS.includes(host)));
  return [...new Set(values.map(normalizeArchiveUrl).filter((value) => value !== null))].filter((value) => selected.has(new URL(value).hostname));
}

// src/domain/taskflow-contract.ts
function requireQuickWorkflowPreset(value) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Seleziona un preset TaskFlow valido.");
  }
  return value;
}
function normalizeWorkflowName(value) {
  const ascii = value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  return ascii.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "").replace(/[_-]+/g, (separators) => separators.includes("-") ? "-" : "_").replace(/^[_-]+|[_-]+$/g, "");
}
function requireWorkflowName(value) {
  const workflowName = normalizeWorkflowName(value);
  if (!workflowName) throw new Error("Inserisci un nome workflow con lettere o numeri ASCII.");
  return workflowName;
}
function buildSubmissionBatch(variants, hosts, autodownload = true) {
  if (!variants.length) throw new Error("Seleziona almeno una versione.");
  const packages = variants.map((variant) => {
    const name = variant.packageName.trim();
    const links = selectArchiveLinks(variant.links, hosts);
    if (!name) throw new Error(`La versione ${variant.key} non ha un nome pacchetto valido.`);
    if (!links.length) {
      throw new Error(`Nessun link disponibile per ${name} sugli host selezionati.`);
    }
    return { name, links };
  });
  return { autodownload, packages };
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function analyzeSubmissionResults(inputs, rawResults, requireTaskflowId = true) {
  if (!Array.isArray(rawResults) || rawResults.length !== inputs.length) {
    throw new Error("La lunghezza della risposta TaskFlow non corrisponde alla richiesta ordinata.");
  }
  const outcomes = rawResults.map((raw, index) => {
    const input = inputs[index];
    if (!input || !isRecord(raw)) {
      throw new Error(`Risultato TaskFlow non valido in posizione ${index + 1}.`);
    }
    const actualName = typeof raw.name === "string" ? raw.name : null;
    if (typeof raw.error === "string" && raw.error.trim()) {
      return { index, inputName: input.name, actualName, error: raw.error };
    }
    const taskflowIdValid = raw.taskflow_id === null || typeof raw.taskflow_id === "string" && Boolean(raw.taskflow_id);
    if (typeof raw.jd_id !== "string" || !raw.jd_id || !taskflowIdValid || requireTaskflowId && raw.taskflow_id === null) {
      return {
        index,
        inputName: input.name,
        actualName,
        error: "TaskFlow non ha restituito un ID pacchetto persistito."
      };
    }
    return {
      index,
      inputName: input.name,
      actualName,
      ...typeof raw.taskflow_id === "string" && raw.taskflow_id ? { taskflowId: raw.taskflow_id } : {}
    };
  });
  const taskflowIds = [...new Set(outcomes.flatMap((outcome) => outcome.taskflowId ?? []))];
  const failures = outcomes.filter((outcome) => outcome.error !== void 0);
  return { outcomes, taskflowIds, failures };
}
function composeQuickWorkflowPayload(input) {
  const workflowName = requireWorkflowName(input.workflowName);
  const preset = requireQuickWorkflowPreset(input.preset);
  const packages = [...new Set(input.packageIds)];
  if (!packages.length || packages.some((id) => typeof id !== "string" || !id || id.trim() !== id || /[\u0000-\u001f\u007f]/.test(id))) {
    throw new Error("Gli ID pacchetto TaskFlow devono essere stringhe opache non vuote e senza caratteri di controllo.");
  }
  if (typeof input.cleanupOnSuccess !== "boolean") {
    throw new Error("Il valore Cleanup deve essere booleano.");
  }
  const tmdb = input.metadata.mode === "validated" ? (() => {
    if (!Number.isSafeInteger(input.metadata.id) || input.metadata.id <= 0) {
      throw new Error("Il candidato TMDB validato non \xE8 valido.");
    }
    return { tmdb_id: input.metadata.id };
  })() : (() => {
    const title = input.metadata.title.trim();
    if (!title || !/^\d{4}$/.test(input.metadata.year)) {
      throw new Error("Il fallback TMDB richiede titolo e anno valido.");
    }
    return { title, year: Number(input.metadata.year) };
  })();
  return {
    workflow_name: workflowName,
    packages,
    preset,
    media_kind: input.metadata.mediaKind,
    cleanup_on_success: input.cleanupOnSuccess,
    tmdb,
    ...input.password ? { unrar: { password: input.password } } : {}
  };
}

// src/domain/taskflow-pipeline.ts
var SubmissionBatchError = class extends Error {
  analysis;
  constructor(analysis) {
    super("TaskFlow ha rifiutato una o pi\xF9 versioni; il workflow non \xE8 stato creato.");
    this.name = "SubmissionBatchError";
    this.analysis = analysis;
  }
};
async function emitLog(listener, event) {
  try {
    await listener?.(event);
  } catch {
  }
}
function errorPayload(reason) {
  if (!(reason instanceof Error)) return { name: "Error", message: String(reason) };
  const payload = { name: reason.name, message: reason.message };
  const record2 = reason;
  for (const key of ["status", "code", "analysis", "details", "response"]) {
    if (record2[key] !== void 0) payload[key] = record2[key];
  }
  return payload;
}
async function submitPackageBatch(input, autodownload) {
  try {
    if (!input.integrationId.trim()) throw new Error("Seleziona un\u2019integrazione JDownloader TaskFlow.");
    const request = buildSubmissionBatch(input.variants, input.hosts, autodownload);
    await emitLog(input.onLogEvent, { phase: "submission", kind: "request", payload: request });
    const rawResults = await input.api.submitPackages(input.integrationId, request);
    await emitLog(input.onLogEvent, { phase: "submission", kind: "response", payload: rawResults });
    const submission = analyzeSubmissionResults(request.packages, rawResults, autodownload);
    if (submission.failures.length) throw new SubmissionBatchError(submission);
    return submission;
  } catch (reason) {
    await emitLog(input.onLogEvent, {
      phase: "submission",
      kind: "error",
      payload: errorPayload(reason)
    });
    throw reason;
  }
}
function loadTaskFlowPackages(input) {
  return submitPackageBatch(input, true);
}
async function runQuickWorkflow(input) {
  const submission = await submitPackageBatch(input, input.autodownload);
  if (!input.autodownload) {
    return {
      submission,
      submissionOnly: true,
      createdWorkflow: null,
      startedWorkflow: null,
      startError: null
    };
  }
  let createdWorkflow;
  try {
    if (!input.workflow) throw new Error("Configura Quick Workflow quando Autodownload \xE8 attivo.");
    const payload = composeQuickWorkflowPayload({
      ...input.workflow,
      packageIds: submission.taskflowIds
    });
    await emitLog(input.onLogEvent, { phase: "create", kind: "request", payload });
    createdWorkflow = await input.api.createWorkflow(payload);
    await emitLog(input.onLogEvent, { phase: "create", kind: "response", payload: createdWorkflow });
    if (!createdWorkflow.id) throw Object.assign(
      new Error("TaskFlow ha creato un workflow senza ID valido."),
      { response: createdWorkflow }
    );
  } catch (reason) {
    await emitLog(input.onLogEvent, { phase: "create", kind: "error", payload: errorPayload(reason) });
    throw reason;
  }
  await emitLog(input.onLogEvent, {
    phase: "start",
    kind: "request",
    payload: null,
    metadata: { workflowId: createdWorkflow.id }
  });
  try {
    const startedWorkflow = await input.api.startWorkflow(createdWorkflow.id);
    await emitLog(input.onLogEvent, { phase: "start", kind: "response", payload: startedWorkflow });
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow, startError: null };
  } catch (reason) {
    const startError = reason instanceof Error ? reason : new Error("Impossibile avviare il workflow.");
    await emitLog(input.onLogEvent, { phase: "start", kind: "error", payload: errorPayload(startError) });
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow: null, startError };
  }
}

// src/domain/tmdb.ts
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function candidate(value, mediaKind, imdbUrl = "") {
  if (!isRecord2(value) || !Number.isSafeInteger(value.id) || Number(value.id) <= 0) return null;
  const title = String(value.title ?? value.name ?? "");
  const date = String(value.release_date ?? value.first_air_date ?? "");
  const posterPath = typeof value.poster_path === "string" && /^\/[A-Za-z0-9._-]+$/.test(value.poster_path) ? value.poster_path : "";
  const voteAverage = typeof value.vote_average === "number" && Number.isFinite(value.vote_average) && value.vote_average >= 0 && value.vote_average <= 10 ? value.vote_average : null;
  const voteCount = Number.isSafeInteger(value.vote_count) && Number(value.vote_count) >= 0 ? Number(value.vote_count) : 0;
  return {
    id: Number(value.id),
    mediaKind,
    title,
    year: date.slice(0, 4),
    overview: String(value.overview ?? ""),
    poster: posterPath ? `https://image.tmdb.org/t/p/w185${posterPath}` : "",
    voteAverage,
    voteCount,
    url: `https://www.themoviedb.org/${mediaKind}/${String(value.id)}`,
    imdbUrl
  };
}
function imdbSearchUrl(item2, fallbackYear) {
  const url = new URL("https://www.imdb.com/find/");
  url.searchParams.set("q", [item2.title, item2.year || fallbackYear].filter(Boolean).join(" "));
  url.searchParams.set("s", "tt");
  return url.toString();
}
function arrayField(value, key) {
  return isRecord2(value) && Array.isArray(value[key]) ? value[key] : [];
}
async function fillMissingEnglishOverviews(candidates, request) {
  return Promise.all(candidates.map(async (item2) => {
    if (item2.overview.trim()) return item2;
    try {
      const details = await request(`/${item2.mediaKind}/${item2.id}`, { language: "en-US" });
      const overview = isRecord2(details) && typeof details.overview === "string" ? details.overview.trim() : "";
      return overview ? { ...item2, overview } : item2;
    } catch {
      return item2;
    }
  }));
}
async function searchTmdb(input, request) {
  const title = input.title.trim();
  const year = input.year.trim();
  if (!title || title.length > 200) throw new Error("Inserisci un titolo di massimo 200 caratteri.");
  if (year && !/^\d{4}$/.test(year)) throw new Error("Inserisci un anno di quattro cifre oppure lascialo vuoto.");
  if (input.mode === "auto" && /^tt\d+$/.test(input.imdbId)) {
    const found2 = await request(`/find/${input.imdbId}`, {
      external_source: "imdb_id",
      language: "it-IT"
    });
    const key = input.mediaKind === "movie" ? "movie_results" : "tv_results";
    const candidates2 = arrayField(found2, key).map((item2) => candidate(
      item2,
      input.mediaKind,
      `https://www.imdb.com/title/${input.imdbId}/`
    )).filter((item2) => item2 !== null);
    if (candidates2.length === 1) {
      return { method: "imdb", candidates: await fillMissingEnglishOverviews(candidates2, request) };
    }
  }
  const params = {
    query: title,
    language: "it-IT",
    page: 1,
    include_adult: false
  };
  if (year) params[input.mediaKind === "tv" ? "first_air_date_year" : "year"] = year;
  const found = await request(`/search/${input.mediaKind}`, params);
  const candidates = arrayField(found, "results").map((item2) => candidate(item2, input.mediaKind)).filter((item2) => item2 !== null).slice(0, 10).map((item2) => ({ ...item2, imdbUrl: imdbSearchUrl(item2, year) }));
  return { method: "title", candidates: await fillMissingEnglishOverviews(candidates, request) };
}

// src/domain/taskflow-url.ts
function normalizeTaskFlowBaseUrl(value) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secureTransport = url.protocol === "https:" || url.protocol === "http:" && loopback;
  const bareOrigin = !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  if (!secureTransport || !bareOrigin) {
    throw new Error("L\u2019URL TaskFlow deve essere un\u2019origine HTTPS oppure HTTP su loopback, senza credenziali, percorsi, query o frammenti.");
  }
  return url.origin;
}

// src/background/settings.ts
var STORAGE_KEY = "jspider.settings";
var DEFAULT_BASE_URL = "https://taskflow.redprimrose.mov";
var LOCAL_CONFIG_FILE = "config.local.json";
var SETTINGS_KEYS = [
  "taskflowBaseUrl",
  "taskflowToken",
  "tmdbCredential",
  "omdbApiKey",
  "mdblistApiKey"
];
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function selectSettings(value) {
  if (!isRecord3(value)) return {};
  return Object.fromEntries(SETTINGS_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(value, key)).map((key) => [key, value[key]]));
}
async function loadLocalConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL(LOCAL_CONFIG_FILE), { cache: "no-store" });
    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(
          "JSpider: config.local.json ignorato.",
          new Error(`HTTP ${response.status}`)
        );
      }
      return {};
    }
    const value = await response.json();
    if (!isRecord3(value)) throw new TypeError("La configurazione locale deve essere un oggetto JSON.");
    return value;
  } catch (reason) {
    console.warn("JSpider: config.local.json ignorato.", reason);
    return {};
  }
}
function normalizeStoredBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_BASE_URL;
  try {
    return normalizeTaskFlowBaseUrl(value.trim());
  } catch {
    return DEFAULT_BASE_URL;
  }
}
function normalizeStored(value) {
  const raw = isRecord3(value) ? value : {};
  return {
    taskflowBaseUrl: normalizeStoredBaseUrl(raw.taskflowBaseUrl),
    taskflowToken: typeof raw.taskflowToken === "string" ? raw.taskflowToken : "",
    tmdbCredential: typeof raw.tmdbCredential === "string" ? raw.tmdbCredential : "",
    omdbApiKey: typeof raw.omdbApiKey === "string" ? raw.omdbApiKey : "",
    mdblistApiKey: typeof raw.mdblistApiKey === "string" ? raw.mdblistApiKey : ""
  };
}
async function loadSettings() {
  const [result, local] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    loadLocalConfig()
  ]);
  return normalizeStored({
    ...local,
    ...selectSettings(result[STORAGE_KEY])
  });
}
async function loadEmbySettings() {
  const local = await loadLocalConfig();
  return {
    baseUrl: typeof local.embyBaseUrl === "string" ? local.embyBaseUrl.trim().replace(/\/$/, "") : "",
    token: typeof local.embyToken === "string" ? local.embyToken.trim() : ""
  };
}
async function settingsSummary() {
  const [settings, emby] = await Promise.all([loadSettings(), loadEmbySettings()]);
  return {
    taskflowBaseUrl: settings.taskflowBaseUrl,
    taskflowToken: settings.taskflowToken,
    tmdbCredential: settings.tmdbCredential,
    omdbApiKey: settings.omdbApiKey,
    mdblistApiKey: settings.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(settings.taskflowToken),
    tmdbConfigured: Boolean(settings.tmdbCredential),
    omdbConfigured: Boolean(settings.omdbApiKey),
    mdblistConfigured: Boolean(settings.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token)
  };
}
async function updateSettings(patch) {
  const current = await loadSettings();
  const next = {
    taskflowBaseUrl: typeof patch.taskflowBaseUrl === "string" && patch.taskflowBaseUrl.trim() ? normalizeTaskFlowBaseUrl(patch.taskflowBaseUrl.trim()) : current.taskflowBaseUrl,
    taskflowToken: typeof patch.taskflowToken === "string" ? patch.taskflowToken.trim() : current.taskflowToken,
    tmdbCredential: typeof patch.tmdbCredential === "string" ? patch.tmdbCredential.trim() : current.tmdbCredential,
    omdbApiKey: typeof patch.omdbApiKey === "string" ? patch.omdbApiKey.trim() : current.omdbApiKey,
    mdblistApiKey: typeof patch.mdblistApiKey === "string" ? patch.mdblistApiKey.trim() : current.mdblistApiKey
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  const emby = await loadEmbySettings();
  return {
    taskflowBaseUrl: next.taskflowBaseUrl,
    taskflowToken: next.taskflowToken,
    tmdbCredential: next.tmdbCredential,
    omdbApiKey: next.omdbApiKey,
    mdblistApiKey: next.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(next.taskflowToken),
    tmdbConfigured: Boolean(next.tmdbCredential),
    omdbConfigured: Boolean(next.omdbApiKey),
    mdblistConfigured: Boolean(next.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token)
  };
}

// src/background/sidepanel.ts
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isSupportedOverlayUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
    if (url.hostname === "titanhd.space") return /^\/catalogo\/\d+\/?$/.test(url.pathname);
    return url.hostname === "laforestaincantata.org" && url.pathname === "/index.php" && url.searchParams.getAll("newsid").length === 1 && /^[1-9]\d*$/.test(url.searchParams.get("newsid") ?? "");
  } catch {
    return false;
  }
}
async function handleActionClick(tab, dependencies) {
  if (tab.id === void 0 || !tab.url || !isSupportedOverlayUrl(tab.url)) return false;
  try {
    const response = await dependencies.sendMessage(tab.id, {
      target: "content",
      action: "overlay.toggle"
    });
    return isRecord4(response) && response.ok === true;
  } catch {
    return false;
  }
}

// src/background/page-bridge.ts
async function forwardPageMessage(ownerTabId, request, sendMessage) {
  if (!Number.isInteger(ownerTabId)) {
    throw new Error("Impossibile individuare la scheda proprietaria di JSpider.");
  }
  if (!request || typeof request.action !== "string" || !request.action) {
    throw new Error("Azione pagina non valida.");
  }
  const message = {
    target: "content",
    action: request.action,
    ...request.data ?? {}
  };
  const response = await sendMessage(ownerTabId, message);
  if (!response || response.ok !== true) {
    throw new Error(response?.error?.message ?? "La pagina non ha risposto.");
  }
  return response.data;
}

// src/background/taskflow-client.ts
var TaskFlowHttpError = class extends Error {
  status;
  code;
  response;
  constructor(status, code, message, response = null) {
    super(message);
    this.name = "TaskFlowHttpError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
};
function isRecord5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function safeNetworkError(reason, token) {
  const message = reason instanceof Error ? reason.message : "Connessione a TaskFlow non riuscita.";
  return new Error(token ? message.split(token).join("[redacted]") : message);
}
var TaskFlowClient = class {
  baseUrl;
  #token;
  #fetcher;
  constructor(baseUrl, token, fetcher = (request) => fetch(request)) {
    this.baseUrl = normalizeTaskFlowBaseUrl(baseUrl);
    this.#token = token.trim();
    if (!this.#token) throw new Error("Configura il token amministrativo TaskFlow.");
    this.#fetcher = fetcher;
  }
  async #request(path, init = {}) {
    const request = new Request(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.#token}`,
        ...init.body ? { "content-type": "application/json" } : {},
        ...init.headers
      }
    });
    let response;
    try {
      response = await this.#fetcher(request);
    } catch (reason) {
      throw safeNetworkError(reason, this.#token);
    }
    let body = null;
    try {
      body = response.status === 204 ? null : await response.json();
    } catch {
      throw new TaskFlowHttpError(response.status, "client.invalid_json", "TaskFlow ha restituito JSON non valido.");
    }
    if (!response.ok) {
      const error = isRecord5(body) && isRecord5(body.error) ? body.error : {};
      throw new TaskFlowHttpError(
        response.status,
        typeof error.code === "string" ? error.code : "api.request_failed",
        typeof error.message === "string" ? error.message : `TaskFlow ha risposto HTTP ${response.status}.`,
        body
      );
    }
    return body;
  }
  async discoverJDownloaderIntegration() {
    const raw = await this.#request("/api/v1/integrations");
    if (!Array.isArray(raw)) throw new Error("Elenco integrazioni TaskFlow non valido.");
    const match = raw.find((item2) => isRecord5(item2) && item2.type === "jdownloader" && item2.enabled !== false && typeof item2.id === "string" && item2.id.length > 0);
    if (!isRecord5(match) || typeof match.id !== "string") {
      throw new Error("Nessuna integrazione JDownloader abilitata in TaskFlow.");
    }
    return match.id;
  }
  getPresets() {
    return this.#request("/api/v1/workflow-presets");
  }
  submitPackages(integrationId, request) {
    return this.#request(`/api/v1/integrations/${encodeURIComponent(integrationId)}/submission`, {
      method: "POST",
      body: JSON.stringify(request)
    });
  }
  async createWorkflow(payload) {
    const raw = await this.#request("/api/v1/workflows", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (!isRecord5(raw) || typeof raw.id !== "string" || !raw.id) {
      throw Object.assign(new Error("Risposta Create di TaskFlow non valida."), { response: raw });
    }
    return raw;
  }
  async startWorkflow(workflowId) {
    const raw = await this.#request(`/api/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
      method: "POST"
    });
    if (!isRecord5(raw) || typeof raw.id !== "string" || !raw.id) {
      throw Object.assign(new Error("Risposta Start di TaskFlow non valida."), { response: raw });
    }
    return raw;
  }
};

// src/background/tmdb-client.ts
var TmdbClient = class {
  #credential;
  #fetcher;
  constructor(credential, fetcher = (request) => fetch(request)) {
    this.#credential = credential.trim();
    if (!this.#credential) throw new Error("Configura il token o la API key TMDB.");
    this.#fetcher = fetcher;
  }
  async request(path, params) {
    if (!/^\/[a-z0-9/_-]+$/i.test(path)) throw new Error("Percorso TMDB non valido.");
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== void 0 && value !== null) url.searchParams.set(key, String(value));
    }
    const v3Key = /^[a-f0-9]{32}$/i.test(this.#credential);
    if (v3Key) url.searchParams.set("api_key", this.#credential);
    const request = new Request(url, {
      headers: {
        accept: "application/json",
        ...!v3Key ? { authorization: `Bearer ${this.#credential}` } : {}
      }
    });
    let response;
    try {
      response = await this.#fetcher(request);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Connessione a TMDB non riuscita.";
      throw new Error(message.split(this.#credential).join("[redacted]"));
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("TMDB ha restituito JSON non valido.");
    }
    if (!response.ok) {
      const message = body !== null && typeof body === "object" && !Array.isArray(body) && typeof body.status_message === "string" ? String(body.status_message) : `TMDB ha risposto HTTP ${response.status}.`;
      throw new Error(message.split(this.#credential).join("[redacted]"));
    }
    return body;
  }
};

// src/domain/emby.ts
function fileStem(path) {
  const file = path.trim().split(/[\\/]/).filter(Boolean).at(-1) ?? "";
  return file.replace(/\.[^.\\/]+$/, "");
}
function normalizedTitle(value) {
  return value.normalize("NFKD").replace(new RegExp("\\p{Diacritic}", "gu"), "").toLocaleLowerCase("it").replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function filenames(items) {
  const names = /* @__PURE__ */ new Set();
  for (const item2 of items) {
    const paths = [
      item2.path,
      item2.fileName ?? "",
      ...item2.mediaSources.map((source) => source.path)
    ];
    for (const path of paths) {
      const name = fileStem(path);
      if (name) names.add(name);
    }
  }
  return [...names];
}
function resolveEmbyPresence(items, input) {
  if (input.mode === "tmdb") {
    return items.length ? { state: "present", files: filenames(items) } : { state: "absent", files: [] };
  }
  const expectedTitle = normalizedTitle(input.title);
  const exact = items.filter((item2) => normalizedTitle(item2.name) === expectedTitle && (input.year === void 0 || item2.productionYear === input.year));
  if (exact.length === 0) return { state: "absent", files: [] };
  return {
    state: exact.length === 1 ? "present" : "ambiguous",
    files: filenames(exact)
  };
}

// src/background/emby-client.ts
function isRecord6(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalizeBaseUrl(value) {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("URL Emby non valido.");
  return url.toString().replace(/\/$/, "");
}
function item(value) {
  if (!isRecord6(value)) return null;
  const providerIds = isRecord6(value.ProviderIds) ? Object.fromEntries(Object.entries(value.ProviderIds).filter((entry) => typeof entry[1] === "string")) : {};
  const mediaSources = Array.isArray(value.MediaSources) ? value.MediaSources.flatMap((source) => isRecord6(source) && typeof source.Path === "string" ? [{ path: source.Path }] : []) : [];
  return {
    id: typeof value.Id === "string" ? value.Id : "",
    name: typeof value.Name === "string" ? value.Name : "",
    type: typeof value.Type === "string" ? value.Type : "",
    productionYear: typeof value.ProductionYear === "number" ? value.ProductionYear : null,
    path: typeof value.Path === "string" ? value.Path : "",
    ...typeof value.FileName === "string" ? { fileName: value.FileName } : {},
    providerIds,
    mediaSources
  };
}
function endpoint(baseUrl) {
  return new URL(`${baseUrl}${/\/emby$/i.test(new URL(baseUrl).pathname) ? "" : "/emby"}/Items`);
}
var EmbyClient = class {
  constructor(baseUrl, token, fetcher = (request) => fetch(request), timeoutMs = 1e4) {
    this.token = token;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.baseUrl = normalizeBaseUrl(baseUrl);
    if (!token.trim()) throw new Error("Token Emby non configurato.");
  }
  token;
  fetcher;
  timeoutMs;
  baseUrl;
  async lookup(input) {
    const url = endpoint(this.baseUrl);
    url.searchParams.set("Recursive", "true");
    url.searchParams.set("IncludeItemTypes", input.mediaKind === "movie" ? "Movie" : "Series");
    url.searchParams.set("Fields", "ProviderIds,Path");
    if (input.mode === "tmdb") {
      url.searchParams.set("AnyProviderIdEquals", `tmdb.${input.tmdbId}`);
    } else {
      url.searchParams.set("SearchTerm", input.title);
      if (input.year !== void 0) url.searchParams.set("Years", String(input.year));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetcher(new Request(url, {
        method: "GET",
        headers: { "X-Emby-Token": this.token },
        signal: controller.signal
      }));
    } catch (reason) {
      if (controller.signal.aborted || reason instanceof DOMException && reason.name === "AbortError") {
        throw new Error("Emby non raggiungibile entro il tempo previsto.");
      }
      throw new Error("Server Emby non raggiungibile.");
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Token Emby non valido o non autorizzato.");
    }
    if (!response.ok) throw new Error(`Controllo Emby non riuscito (HTTP ${response.status}).`);
    let value;
    try {
      value = await response.json();
    } catch {
      throw new Error("Risposta Emby non valida.");
    }
    if (!isRecord6(value) || !Array.isArray(value.Items) || typeof value.TotalRecordCount !== "number") {
      throw new Error("Risposta Emby non valida.");
    }
    const items = value.Items.map(item).filter((entry) => entry !== null);
    if (items.length !== value.Items.length) throw new Error("Risposta Emby non valida.");
    return resolveEmbyPresence(items, input.mode === "tmdb" ? { mode: "tmdb" } : {
      mode: "title",
      title: input.title,
      ...input.year === void 0 ? {} : { year: input.year }
    });
  }
};

// src/domain/media-ratings.ts
var sourceOrder = [
  "imdb",
  "tomatoes",
  "popcorn",
  "metacritic",
  "metacriticuser",
  "letterboxd",
  "trakt",
  "rogerebert",
  "myanimelist"
];
var labels = {
  imdb: "IMDb",
  tomatoes: "Rotten Tomatoes critica",
  popcorn: "Rotten Tomatoes pubblico",
  metacritic: "Metacritic",
  metacriticuser: "Metacritic utenti",
  letterboxd: "Letterboxd",
  trakt: "Trakt",
  rogerebert: "Roger Ebert",
  myanimelist: "MyAnimeList"
};
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function relativePath(value, prefix) {
  if (typeof value !== "string" || !prefix.test(value) || value.includes("..") || value.includes("\\")) return null;
  return value;
}
function finiteValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function textValue(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}
function ratingValue(source, value) {
  if (source === "tomatoes" || source === "popcorn" || source === "trakt") return `${textValue(value)}%`;
  if (source === "rogerebert") return `${textValue(value)}/4`;
  return textValue(value);
}
function sourceUrl(source, item2, ratings, ids, mediaKind) {
  const imdb = typeof ids.imdb === "string" && /^tt\d+$/.test(ids.imdb) ? ids.imdb : "";
  if (source === "imdb") return imdb ? `https://www.imdb.com/title/${imdb}/` : null;
  if (source === "trakt") {
    return Number.isSafeInteger(ids.trakt) && Number(ids.trakt) > 0 ? `https://trakt.tv/${mediaKind === "movie" ? "movies" : "shows"}/${String(ids.trakt)}` : null;
  }
  if (source === "myanimelist") {
    return Number.isSafeInteger(ids.mal) && Number(ids.mal) > 0 ? `https://myanimelist.net/anime/${String(ids.mal)}` : null;
  }
  if (source === "tomatoes" || source === "popcorn") {
    const path = relativePath(item2.url, /^\/(?:m|tv)\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://www.rottentomatoes.com${path}` : null;
  }
  if (source === "letterboxd") {
    const path = relativePath(item2.url, /^\/film\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://letterboxd.com${path}` : null;
  }
  if (source === "metacritic" || source === "metacriticuser") {
    const ownPath = relativePath(item2.url, /^\/[A-Za-z0-9._~-]+$/);
    const critic = ratings.find((rating) => rating.source === "metacritic");
    const criticPath = relativePath(critic?.url, /^\/[A-Za-z0-9._~-]+$/);
    const path = ownPath ?? criticPath;
    return path ? `https://www.metacritic.com/${mediaKind === "movie" ? "movie" : "tv"}${path}/` : null;
  }
  if (source === "rogerebert") {
    const slug = typeof item2.url === "string" && /^[A-Za-z0-9._~-]+$/.test(item2.url) ? item2.url : "";
    return slug ? `https://www.rogerebert.com/reviews/${slug}` : null;
  }
  return null;
}
function normalizeMdbListMedia(value, input) {
  const body = record(value) ?? {};
  const ids = record(body.ids) ?? {};
  const rawRatings = Array.isArray(body.ratings) ? body.ratings.map(record).filter((item2) => item2 !== null) : [];
  const ratings = [];
  for (const source of sourceOrder) {
    const item2 = rawRatings.find((candidate2) => candidate2.source === source);
    if (!item2) continue;
    const valueNumber = finiteValue(item2.value);
    const url = sourceUrl(source, item2, rawRatings, ids, input.mediaKind);
    if (valueNumber === null || !url) continue;
    const votes = Number.isSafeInteger(item2.votes) && Number(item2.votes) >= 0 ? Number(item2.votes) : null;
    ratings.push({ source, label: labels[source], value: ratingValue(source, valueNumber), votes, url });
  }
  const imdb = typeof ids.imdb === "string" && /^tt\d+$/.test(ids.imdb) ? ids.imdb : "";
  const awardsText = typeof body.awards === "string" ? body.awards.trim() : "";
  const awards = awardsText && awardsText !== "N/A" && imdb ? { text: awardsText, url: `https://www.imdb.com/title/${imdb}/awards/` } : null;
  return { ratings, awards };
}

// src/background/mdblist-client.ts
var MdbListClient = class {
  #apiKey;
  #fetcher;
  constructor(apiKey, fetcher = (request) => fetch(request)) {
    this.#apiKey = apiKey.trim();
    if (!this.#apiKey) throw new Error("Configura la API key MDBList.");
    this.#fetcher = fetcher;
  }
  async lookup(input) {
    if (!Number.isSafeInteger(input.tmdbId) || input.tmdbId <= 0) throw new Error("ID TMDB MDBList non valido.");
    const type = input.mediaKind === "movie" ? "movie" : "show";
    const url = new URL(`https://api.mdblist.com/tmdb/${type}/${input.tmdbId}/`);
    url.searchParams.set("apikey", this.#apiKey);
    let response;
    try {
      response = await this.#fetcher(new Request(url, { headers: { accept: "application/json" } }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Connessione a MDBList non riuscita.";
      throw new Error(message.split(this.#apiKey).join("[redacted]"));
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("MDBList ha restituito JSON non valido.");
    }
    if (!response.ok) {
      const data = body !== null && typeof body === "object" && !Array.isArray(body) ? body : {};
      const message = typeof data.error === "string" ? data.error : `MDBList ha risposto HTTP ${response.status}.`;
      throw new Error(message.split(this.#apiKey).join("[redacted]"));
    }
    return normalizeMdbListMedia(body, input);
  }
};

// src/background/quick-workflow-log.ts
var STORAGE_KEY2 = "jspider.quickWorkflowLog";
function serializable(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const json = JSON.stringify(value, (_key, candidate2) => {
    if (typeof candidate2 === "bigint") return candidate2.toString();
    if (candidate2 !== null && typeof candidate2 === "object") {
      if (seen.has(candidate2)) return "[Circular]";
      seen.add(candidate2);
    }
    return candidate2;
  });
  return json === void 0 ? null : JSON.parse(json);
}
function isDocument(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate2 = value;
  return typeof candidate2.startedAt === "string" && typeof candidate2.updatedAt === "string" && typeof candidate2.runId === "string" && Array.isArray(candidate2.entries);
}
var QuickWorkflowLogStore = class {
  constructor(storage, now = () => (/* @__PURE__ */ new Date()).toISOString(), createRunId = () => crypto.randomUUID()) {
    this.storage = storage;
    this.now = now;
    this.createRunId = createRunId;
  }
  storage;
  now;
  createRunId;
  operations = Promise.resolve();
  serialize(operation) {
    const result = this.operations.then(operation, operation);
    this.operations = result.then(() => void 0, () => void 0);
    return result;
  }
  async readDirect() {
    const result = await this.storage.get(STORAGE_KEY2);
    return isDocument(result[STORAGE_KEY2]) ? result[STORAGE_KEY2] : null;
  }
  start() {
    const runId = this.createRunId();
    return this.serialize(async () => {
      const timestamp = this.now();
      await this.storage.set({
        [STORAGE_KEY2]: { runId, startedAt: timestamp, updatedAt: timestamp, entries: [] }
      });
      return runId;
    });
  }
  append(event, runId) {
    return this.serialize(async () => {
      const timestamp = this.now();
      const current = await this.readDirect();
      if (!current || runId !== void 0 && current.runId !== runId) return;
      const entry = {
        timestamp,
        phase: event.phase,
        kind: event.kind,
        payload: serializable(event.payload),
        ...event.metadata ? { metadata: serializable(event.metadata) } : {}
      };
      await this.storage.set({
        [STORAGE_KEY2]: {
          ...current,
          updatedAt: timestamp,
          entries: [...current.entries, entry]
        }
      });
    });
  }
  async read() {
    await this.operations;
    return this.readDirect();
  }
  clear() {
    return this.serialize(() => this.storage.remove(STORAGE_KEY2));
  }
};
async function handleQuickWorkflowLogAction(action, store) {
  if (action === "taskflow.quickWorkflowLog.get") return store.read();
  if (action === "taskflow.quickWorkflowLog.clear") {
    await store.clear();
    return { cleared: true };
  }
  return void 0;
}

// src/background/index.ts
var quickWorkflowLog = new QuickWorkflowLogStore({
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
  remove: (key) => chrome.storage.local.remove(key)
});
chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab, {
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message)
  });
});
function serializeError(reason) {
  if (reason instanceof SubmissionBatchError) {
    return { name: reason.name, message: reason.message, analysis: reason.analysis };
  }
  const serialized = {
    name: reason instanceof Error ? reason.name : "Error",
    message: reason instanceof Error ? reason.message : "Operazione non riuscita."
  };
  if (reason !== null && typeof reason === "object") {
    const record2 = reason;
    for (const key of ["status", "code", "details"]) {
      if (record2[key] !== void 0) serialized[key] = record2[key];
    }
  }
  return serialized;
}
async function handle(message, sender) {
  if (message.target !== "background") throw new Error("Destinazione messaggio non valida.");
  if (message.action === "page.forward") {
    const request = message.request && typeof message.request === "object" ? message.request : { action: "" };
    return forwardPageMessage(
      sender.tab?.id,
      request,
      (tabId, pageMessage) => chrome.tabs.sendMessage(tabId, pageMessage)
    );
  }
  if (message.action === "taskflow.quickWorkflowLog.get" || message.action === "taskflow.quickWorkflowLog.clear") {
    return handleQuickWorkflowLogAction(message.action, quickWorkflowLog);
  }
  if (message.action === "settings.get") return settingsSummary();
  if (message.action === "settings.save") {
    return updateSettings(message.settings && typeof message.settings === "object" ? message.settings : {});
  }
  if (message.action === "settings.taskflowToken") {
    const settings2 = await loadSettings();
    if (!settings2.taskflowToken) throw new Error("Token TaskFlow non configurato.");
    return { token: settings2.taskflowToken, baseUrl: settings2.taskflowBaseUrl };
  }
  if (message.action === "emby.check") {
    const emby = await loadEmbySettings();
    if (!emby.baseUrl || !emby.token) throw new Error("Emby non configurato in config.local.json.");
    return new EmbyClient(emby.baseUrl, emby.token).lookup(message.input);
  }
  if (message.action === "taskflow.quickWorkflow") {
    let logRunId = null;
    try {
      logRunId = await quickWorkflowLog.start();
    } catch {
    }
    const appendLog = async (event) => {
      if (!logRunId) return;
      try {
        await quickWorkflowLog.append(event, logRunId);
      } catch {
      }
    };
    let pipelineStarted = false;
    try {
      if (!Array.isArray(message.variants) || !Array.isArray(message.hosts) || typeof message.autodownload !== "boolean" || message.autodownload && (!message.workflow || typeof message.workflow !== "object")) {
        throw new Error("Dati Quick Workflow non validi.");
      }
      if (message.autodownload) {
        requireQuickWorkflowPreset(
          message.workflow.preset
        );
      }
      const settings2 = await loadSettings();
      const taskflow2 = new TaskFlowClient(settings2.taskflowBaseUrl, settings2.taskflowToken);
      const integrationId = await taskflow2.discoverJDownloaderIntegration();
      pipelineStarted = true;
      return await runQuickWorkflow({
        api: taskflow2,
        integrationId,
        variants: message.variants,
        hosts: message.hosts,
        autodownload: message.autodownload,
        onLogEvent: appendLog,
        ...message.autodownload ? {
          workflow: message.workflow
        } : {}
      });
    } catch (reason) {
      if (!pipelineStarted) {
        await appendLog({
          phase: "submission",
          kind: "error",
          payload: serializeError(reason)
        });
      }
      throw reason;
    }
  }
  const settings = await loadSettings();
  if (message.action === "tmdb.search") {
    const client = new TmdbClient(settings.tmdbCredential);
    return searchTmdb(message.input, (path, params) => client.request(path, params));
  }
  if (message.action === "mdblist.lookup") {
    return new MdbListClient(settings.mdblistApiKey).lookup(message.input);
  }
  const taskflow = new TaskFlowClient(settings.taskflowBaseUrl, settings.taskflowToken);
  if (message.action === "taskflow.catalog") {
    return { presets: await taskflow.getPresets() };
  }
  if (message.action === "taskflow.loadPackages") {
    if (!Array.isArray(message.variants) || !Array.isArray(message.hosts)) {
      throw new Error("Dati package TaskFlow non validi.");
    }
    const integrationId = await taskflow.discoverJDownloaderIntegration();
    return loadTaskFlowPackages({
      api: taskflow,
      integrationId,
      variants: message.variants,
      hosts: message.hosts
    });
  }
  throw new Error("Azione background non supportata.");
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "background") return void 0;
  void handle(message, sender).then(
    (data) => sendResponse({ ok: true, data }),
    (reason) => sendResponse({ ok: false, error: serializeError(reason) })
  );
  return true;
});
