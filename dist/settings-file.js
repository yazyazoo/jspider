// src/background/config-file.ts
function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Archivio file non disponibile."));
  });
}
var ConfigFileRepository = class {
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("jspider-config-file", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("handles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Archivio file non disponibile."));
    });
  }
  async load() {
    if (typeof indexedDB === "undefined") return null;
    const db = await this.open();
    try {
      return await result(db.transaction("handles").objectStore("handles").get("config")) ?? null;
    } finally {
      db.close();
    }
  }
  async save(handle) {
    const db = await this.open();
    try {
      const transaction = db.transaction("handles", "readwrite");
      const done = new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Collegamento file non salvato."));
      });
      await result(transaction.objectStore("handles").put(handle, "config"));
      await done;
    } finally {
      db.close();
    }
  }
};
function parseLocalConfig(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("config.local.json non \xE8 un JSON valido. Correggi il file prima di continuare.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("config.local.json deve contenere un oggetto JSON.");
  }
  return value;
}
async function linkConfigFile(handle) {
  if (handle.name !== "config.local.json") throw new Error("Seleziona il file config.local.json.");
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("Permesso di scrittura sul file non concesso.");
  parseLocalConfig(await (await handle.getFile()).text());
  await new ConfigFileRepository().save(handle);
  await chrome.storage.local.set({ "jspider.configFileRevision": Date.now() });
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
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
async function loadLocalConfig() {
  const handle = await new ConfigFileRepository().load();
  if (handle) {
    try {
      return parseLocalConfig(await (await handle.getFile()).text());
    } catch (reason) {
      if (reason instanceof DOMException) {
        throw new Error("File config non accessibile. Riautorizza config.local.json nelle impostazioni.");
      }
      throw reason;
    }
  }
  const response = await fetch(chrome.runtime.getURL(LOCAL_CONFIG_FILE), { cache: "no-store" });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Lettura config.local.json: HTTP ${response.status}.`);
  const value = await response.json();
  if (!isRecord(value)) throw new Error("config.local.json deve contenere un oggetto JSON.");
  return value;
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
  const raw = isRecord(value) ? value : {};
  return {
    protectedExecution: typeof raw.protectedExecution === "boolean" ? raw.protectedExecution : true,
    taskflowBaseUrl: normalizeStoredBaseUrl(raw.taskflowBaseUrl),
    taskflowToken: typeof raw.taskflowToken === "string" ? raw.taskflowToken : "",
    tmdbCredential: typeof raw.tmdbCredential === "string" ? raw.tmdbCredential : "",
    omdbApiKey: typeof raw.omdbApiKey === "string" ? raw.omdbApiKey : "",
    mdblistApiKey: typeof raw.mdblistApiKey === "string" ? raw.mdblistApiKey : ""
  };
}
async function settingsSummary() {
  const local = await loadLocalConfig();
  const settings = normalizeStored(local);
  const emby = {
    baseUrl: typeof local.embyBaseUrl === "string" ? local.embyBaseUrl.trim().replace(/\/$/, "") : "",
    token: typeof local.embyToken === "string" ? local.embyToken.trim() : ""
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...local, ...settings } });
  return {
    protectedExecution: settings.protectedExecution,
    configFileLinked: Boolean(await new ConfigFileRepository().load()),
    taskflowBaseUrl: settings.taskflowBaseUrl,
    taskflowToken: settings.taskflowToken,
    tmdbCredential: settings.tmdbCredential,
    omdbApiKey: settings.omdbApiKey,
    mdblistApiKey: settings.mdblistApiKey,
    embyBaseUrl: emby.baseUrl,
    embyToken: emby.token,
    logDirectoryConfig: typeof local._logDirectory === "string" ? local._logDirectory.trim() : "",
    taskflowConfigured: Boolean(settings.taskflowToken),
    tmdbConfigured: Boolean(settings.tmdbCredential),
    omdbConfigured: Boolean(settings.omdbApiKey),
    mdblistConfigured: Boolean(settings.mdblistApiKey),
    embyConfigured: Boolean(emby.baseUrl && emby.token)
  };
}

// src/settings-file.ts
var button = document.getElementById("choose-config");
var state = document.getElementById("config-state");
button.addEventListener("click", () => {
  const selection = window.showOpenFilePicker({
    multiple: false,
    types: [{ description: "Configurazione JSpider", accept: { "application/json": [".json"] } }]
  });
  button.disabled = true;
  void selection.then(async ([handle]) => {
    if (!handle) return;
    await linkConfigFile(handle);
    await settingsSummary();
    state.textContent = "config.local.json collegato. Le impostazioni leggono e aggiornano questo file; Chromium riceve una copia. Torna a JSpider e apri Impostazioni.";
  }).catch((reason) => {
    state.textContent = reason instanceof DOMException && reason.name === "AbortError" ? "Selezione annullata. Nessuna modifica." : reason instanceof Error ? reason.message : "File non collegato.";
  }).finally(() => {
    button.disabled = false;
  });
});
