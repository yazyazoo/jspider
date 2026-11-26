// src/domain/follow-season.ts
var HOST_TOKENS = {
  "filestore.me": "filestore",
  "terabytez.org": "terabytez"
};
var TOKEN_HOSTS = Object.fromEntries(
  Object.entries(HOST_TOKENS).map(([host, token]) => [token, host])
);

// src/background/log-directory.ts
var DATABASE_NAME = "jspider-local-files";
var DATABASE_VERSION = 1;
var STORE_NAME = "handles";
var DIRECTORY_KEY = "quick-workflow-log-directory";
async function readDirectoryPermission(handle) {
  try {
    return await handle.queryPermission({ mode: "readwrite" });
  } catch {
    return "unknown";
  }
}
function request(operation) {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error("IndexedDB non disponibile."));
  });
}
function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    const failed = () => reject(transaction.error ?? new Error("Salvataggio IndexedDB non riuscito."));
    transaction.onerror = failed;
    transaction.onabort = failed;
  });
}
var LogDirectoryRepository = class {
  constructor(suppliedFactory) {
    this.suppliedFactory = suppliedFactory;
  }
  suppliedFactory;
  open() {
    return new Promise((resolve, reject) => {
      const operation = (this.suppliedFactory ?? indexedDB).open(DATABASE_NAME, DATABASE_VERSION);
      operation.onupgradeneeded = () => {
        if (!operation.result.objectStoreNames.contains(STORE_NAME)) {
          operation.result.createObjectStore(STORE_NAME);
        }
      };
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error ?? new Error("IndexedDB non disponibile."));
    });
  }
  async load() {
    const database = await this.open();
    try {
      const value = await request(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_KEY));
      return value && typeof value === "object" && "getFileHandle" in value ? value : null;
    } finally {
      database.close();
    }
  }
  async save(handle) {
    const database = await this.open();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const committed = waitForTransaction(transaction);
      await request(transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY));
      await committed;
    } finally {
      database.close();
    }
  }
  async status() {
    const handle = await this.load();
    if (!handle) return { configured: false, name: null, permission: "missing" };
    return {
      configured: true,
      name: handle.name,
      permission: await readDirectoryPermission(handle)
    };
  }
};

// src/log-directory/controller.ts
function initializeLogDirectoryPicker(view, dependencies) {
  const choose = async () => {
    const requestedPath = view.pathInput.value.trim();
    if (!requestedPath) {
      view.state.textContent = "Inserisci il percorso completo della cartella log prima di continuare.";
      return;
    }
    view.chooseButton.disabled = true;
    view.state.textContent = "Seleziona la cartella progetto che contiene config.local.json, dist e log\u2026";
    try {
      const project = await dependencies.pickProject();
      const result = await dependencies.align(project, requestedPath);
      await dependencies.saveLog(result.logHandle);
      await dependencies.synchronizeSettings();
      await dependencies.publish({
        "jspider.logDirectoryName": result.logHandle.name,
        "jspider.logDirectoryPath": result.fullPath,
        "jspider.logDirectoryDraft": result.fullPath,
        "jspider.logDirectoryRevision": Date.now()
      });
      view.pathInput.value = result.fullPath;
      const files = result.updatedFiles.length > 1 ? "config root e dist aggiornati" : "config aggiornato";
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI \xB7 ${result.fullPath} \xB7 ${files}. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === "AbortError" ? "Chromium ha annullato il selettore dopo la scelta (AbortError). Se la finestra di selezione copre Edge, riducila oppure usa \u201CConferma cartella gi\xE0 autorizzata\u201D." : reason instanceof Error ? reason.message : "Cartella log non collegata.";
    } finally {
      view.chooseButton.disabled = false;
    }
  };
  const click = () => {
    void choose();
  };
  view.chooseButton.addEventListener("click", click);
  return {
    choose,
    dispose() {
      view.chooseButton.removeEventListener("click", click);
    }
  };
}

// src/log-directory/project-config.ts
function normalizePath(value) {
  const input = value.trim();
  if (!input) throw new Error("Inserisci il percorso completo della cartella log.");
  if (new RegExp("\\p{Cc}", "u").test(input)) throw new Error("Il percorso completo contiene caratteri non validi.");
  if (/^[A-Za-z]:[\\/]/.test(input)) {
    const path = input.replace(/\//g, "\\").replace(/\\+/g, "\\").replace(/\\$/, "");
    return { path, parts: path.slice(3).split("\\").filter(Boolean) };
  }
  if (input.startsWith("/")) {
    const path = input.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    return { path, parts: path.split("/").filter(Boolean) };
  }
  throw new Error("Inserisci il percorso completo assoluto della cartella log.");
}
function validateProjectLogPath(value, projectName) {
  const { path, parts } = normalizePath(value);
  if (parts.at(-1)?.toLocaleLowerCase() !== "log") {
    throw new Error("Il percorso completo deve terminare con la cartella \u201Clog\u201D.");
  }
  if (parts.at(-2)?.toLocaleLowerCase() !== projectName.toLocaleLowerCase()) {
    throw new Error(`Il percorso deve appartenere alla cartella progetto selezionata \u201C${projectName}\u201D.`);
  }
  return path;
}
function validateExistingLogPath(value, directoryName) {
  const { path, parts } = normalizePath(value);
  if (directoryName.toLocaleLowerCase() !== "log" || parts.at(-1)?.toLocaleLowerCase() !== "log") {
    throw new Error("La cartella Chromium gi\xE0 autorizzata e il percorso devono terminare con \u201Clog\u201D.");
  }
  return path;
}
function isNotFound(reason) {
  return reason instanceof DOMException && reason.name === "NotFoundError";
}
async function readRootConfig(root) {
  let handle;
  try {
    handle = await root.getFileHandle("config.local.json");
  } catch (reason) {
    if (isNotFound(reason)) {
      throw new Error("CONFIG MANCANTE \xB7 config.local.json non esiste nella cartella progetto selezionata.");
    }
    throw reason;
  }
  try {
    const value = JSON.parse(await (await handle.getFile()).text());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return { handle, value };
  } catch {
    throw new Error("Il config.local.json della root non \xE8 un JSON valido.");
  }
}
async function writeJson(handle, value) {
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(value, null, 2)}
`);
  await writable.close();
}
async function alignProjectLogDirectory(root, requestedPath) {
  const fullPath = validateProjectLogPath(requestedPath, root.name);
  const rootConfig = await readRootConfig(root);
  const next = { ...rootConfig.value, _logDirectory: fullPath };
  let distConfig = null;
  try {
    const dist = await root.getDirectoryHandle("dist");
    distConfig = await dist.getFileHandle("config.local.json", { create: true });
  } catch (reason) {
    if (!isNotFound(reason)) throw reason;
  }
  const logHandle = await root.getDirectoryHandle("log", { create: true });
  await writeJson(rootConfig.handle, next);
  const updatedFiles = ["config.local.json"];
  if (distConfig) {
    await writeJson(distConfig, next);
    updatedFiles.push("dist/config.local.json");
  }
  return { logHandle, fullPath, updatedFiles };
}

// src/log-directory/existing-directory.ts
function initializeExistingLogDirectory(view, dependencies) {
  const refresh = async () => {
    const handle = await dependencies.loadExisting();
    view.existingButton.hidden = !handle || handle.name.toLocaleLowerCase() !== "log";
    if (!view.existingButton.hidden) {
      view.state.textContent = "Cartella log Chromium gi\xE0 presente. Confermala senza riaprire il selettore.";
    }
  };
  const adopt = async () => {
    view.existingButton.disabled = true;
    try {
      const handle = await dependencies.loadExisting();
      if (!handle) throw new Error("CHROMIUM NON AUTORIZZATO \xB7 nessuna cartella log gi\xE0 salvata.");
      const fullPath = validateExistingLogPath(view.pathInput.value, handle.name);
      const permission = await handle.queryPermission({ mode: "readwrite" });
      const granted = permission === "granted" ? permission : await handle.requestPermission({ mode: "readwrite" });
      if (granted !== "granted") {
        throw new Error("CHROMIUM NON AUTORIZZATO \xB7 permesso di scrittura non concesso.");
      }
      await dependencies.synchronizeSettings();
      await dependencies.publish({
        "jspider.logDirectoryName": handle.name,
        "jspider.logDirectoryPath": fullPath,
        "jspider.logDirectoryDraft": fullPath,
        "jspider.logDirectoryRevision": Date.now()
      });
      view.pathInput.value = fullPath;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI \xB7 ${fullPath} \xB7 cartella log gi\xE0 autorizzata confermata. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof Error ? reason.message : "Cartella log gi\xE0 autorizzata non confermata.";
    } finally {
      view.existingButton.disabled = false;
    }
  };
  const click = () => {
    void adopt();
  };
  view.existingButton.addEventListener("click", click);
  return {
    refresh,
    adopt,
    dispose() {
      view.existingButton.removeEventListener("click", click);
    }
  };
}

// src/log-directory/index.ts
var chooseButton = document.getElementById("choose-directory");
var existingButton = document.getElementById("confirm-existing-directory");
var pathInput = document.getElementById("directory-path");
var state = document.getElementById("directory-state");
var pickerWindow = window;
var repository = new LogDirectoryRepository();
var publish = (items) => chrome.storage.local.set(items);
var synchronizeSettings = async () => {
  const response = await chrome.runtime.sendMessage({
    target: "background",
    action: "settings.get"
  });
  if (!response.ok) throw new Error(response.error?.message ?? "Sincronizzazione impostazioni non riuscita.");
};
var existingDirectory = initializeExistingLogDirectory({
  pathInput,
  existingButton,
  state
}, {
  loadExisting: () => repository.load(),
  publish,
  synchronizeSettings
});
void existingDirectory.refresh().catch(() => void 0);
if (typeof pickerWindow.showDirectoryPicker !== "function") {
  chooseButton.disabled = true;
  state.textContent = "Questo browser Chromium non espone il selettore di cartelle richiesto.";
} else {
  initializeLogDirectoryPicker({ chooseButton, pathInput, state }, {
    pickProject: () => pickerWindow.showDirectoryPicker({
      id: "jspider-project-log-config",
      mode: "readwrite",
      startIn: "desktop"
    }),
    align: alignProjectLogDirectory,
    saveLog: (handle) => repository.save(handle),
    publish,
    synchronizeSettings
  });
  void Promise.all([
    chrome.storage.local.get(["jspider.logDirectoryDraft", "jspider.logDirectoryPath"]),
    chrome.runtime.sendMessage({ target: "background", action: "settings.get" })
  ]).then(([stored, rawResponse]) => {
    const response = rawResponse;
    const configured = response.ok ? response.data?.logDirectoryConfig ?? "" : "";
    pathInput.value = String(stored["jspider.logDirectoryDraft"] ?? stored["jspider.logDirectoryPath"] ?? configured);
  }).catch(() => void 0);
}
