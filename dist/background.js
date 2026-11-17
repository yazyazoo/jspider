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
async function submitPackageBatch(input, autodownload) {
  if (!input.integrationId.trim()) throw new Error("Seleziona un\u2019integrazione JDownloader TaskFlow.");
  const request = buildSubmissionBatch(input.variants, input.hosts, autodownload);
  const rawResults = await input.api.submitPackages(input.integrationId, request);
  const submission = analyzeSubmissionResults(request.packages, rawResults, autodownload);
  if (submission.failures.length) throw new SubmissionBatchError(submission);
  return submission;
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
  if (!input.workflow) throw new Error("Configura Quick Workflow quando Autodownload \xE8 attivo.");
  const payload = composeQuickWorkflowPayload({
    ...input.workflow,
    packageIds: submission.taskflowIds
  });
  const createdWorkflow = await input.api.createWorkflow(payload);
  if (!createdWorkflow.id) throw new Error("TaskFlow ha creato un workflow senza ID valido.");
  try {
    const startedWorkflow = await input.api.startWorkflow(createdWorkflow.id);
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow, startError: null };
  } catch (reason) {
    const startError = reason instanceof Error ? reason : new Error("Impossibile avviare il workflow.");
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
  return {
    id: Number(value.id),
    mediaKind,
    title,
    year: date.slice(0, 4),
    overview: String(value.overview ?? ""),
    poster: posterPath ? `https://image.tmdb.org/t/p/w185${posterPath}` : "",
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
  "omdbApiKey"
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
    omdbApiKey: typeof raw.omdbApiKey === "string" ? raw.omdbApiKey : ""
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
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(settings.taskflowToken),
    tmdbConfigured: Boolean(settings.tmdbCredential),
    omdbConfigured: Boolean(settings.omdbApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token)
  };
}
async function updateSettings(patch) {
  const current = await loadSettings();
  const next = {
    taskflowBaseUrl: typeof patch.taskflowBaseUrl === "string" && patch.taskflowBaseUrl.trim() ? normalizeTaskFlowBaseUrl(patch.taskflowBaseUrl.trim()) : current.taskflowBaseUrl,
    taskflowToken: typeof patch.taskflowToken === "string" ? patch.taskflowToken.trim() : current.taskflowToken,
    tmdbCredential: typeof patch.tmdbCredential === "string" ? patch.tmdbCredential.trim() : current.tmdbCredential,
    omdbApiKey: typeof patch.omdbApiKey === "string" ? patch.omdbApiKey.trim() : current.omdbApiKey
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  const emby = await loadEmbySettings();
  return {
    taskflowBaseUrl: next.taskflowBaseUrl,
    taskflowToken: next.taskflowToken,
    tmdbCredential: next.tmdbCredential,
    omdbApiKey: next.omdbApiKey,
    embyBaseUrl: emby.baseUrl,
    taskflowConfigured: Boolean(next.taskflowToken),
    tmdbConfigured: Boolean(next.tmdbCredential),
    omdbConfigured: Boolean(next.omdbApiKey),
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
  constructor(status, code, message) {
    super(message);
    this.name = "TaskFlowHttpError";
    this.status = status;
    this.code = code;
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
        typeof error.message === "string" ? error.message : `TaskFlow ha risposto HTTP ${response.status}.`
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
      throw new Error("Risposta Create di TaskFlow non valida.");
    }
    return raw;
  }
  async startWorkflow(workflowId) {
    const raw = await this.#request(`/api/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
      method: "POST"
    });
    if (!isRecord5(raw) || typeof raw.id !== "string" || !raw.id) {
      throw new Error("Risposta Start di TaskFlow non valida.");
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

// src/background/index.ts
chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab, {
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message)
  });
});
function serializeError(reason) {
  if (reason instanceof SubmissionBatchError) {
    return { name: reason.name, message: reason.message, analysis: reason.analysis };
  }
  return {
    name: reason instanceof Error ? reason.name : "Error",
    message: reason instanceof Error ? reason.message : "Operazione non riuscita."
  };
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
  const settings = await loadSettings();
  if (message.action === "tmdb.search") {
    const client = new TmdbClient(settings.tmdbCredential);
    return searchTmdb(message.input, (path, params) => client.request(path, params));
  }
  const taskflow = new TaskFlowClient(settings.taskflowBaseUrl, settings.taskflowToken);
  if (message.action === "taskflow.catalog") {
    return { presets: await taskflow.getPresets() };
  }
  if (message.action === "taskflow.quickWorkflow") {
    if (!Array.isArray(message.variants) || !Array.isArray(message.hosts) || typeof message.autodownload !== "boolean" || message.autodownload && (!message.workflow || typeof message.workflow !== "object")) {
      throw new Error("Dati Quick Workflow non validi.");
    }
    if (message.autodownload) {
      requireQuickWorkflowPreset(
        message.workflow.preset
      );
    }
    const variants = message.variants;
    const integrationId = await taskflow.discoverJDownloaderIntegration();
    return runQuickWorkflow({
      api: taskflow,
      integrationId,
      variants,
      hosts: message.hosts,
      autodownload: message.autodownload,
      ...message.autodownload ? {
        workflow: message.workflow
      } : {}
    });
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
