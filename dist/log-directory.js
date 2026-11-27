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

// src/log-directory/path-validation.ts
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
function validateExistingLogPath(value, directoryName) {
  const { path, parts } = normalizePath(value);
  if (directoryName.toLocaleLowerCase() !== "log" || parts.at(-1)?.toLocaleLowerCase() !== "log") {
    throw new Error("Seleziona direttamente la cartella \u201Clog\u201D indicata nel percorso configurato.");
  }
  return path;
}
function resolveLogDirectoryPath(configuredPath) {
  return configuredPath?.trim() ?? "";
}

// src/log-directory/controller.ts
function initializeLogDirectoryPicker(view, dependencies) {
  const choose = async () => {
    const requestedPath = view.pathInput.value.trim();
    if (!requestedPath) {
      view.state.textContent = "Inserisci il percorso completo della cartella log prima di continuare.";
      return;
    }
    view.chooseButton.disabled = true;
    view.state.textContent = "Seleziona direttamente la cartella log indicata sopra\u2026";
    try {
      const logHandle = await dependencies.pickLog();
      const fullPath = validateExistingLogPath(requestedPath, logHandle.name);
      await dependencies.saveLog(logHandle);
      await dependencies.publish({
        "jspider.logDirectoryName": logHandle.name,
        "jspider.logDirectoryPath": fullPath,
        "jspider.logDirectoryDraft": fullPath,
        "jspider.logDirectoryRevision": Date.now()
      });
      view.pathInput.value = fullPath;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI \xB7 ${fullPath}. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === "AbortError" ? "Selezione annullata. JSpider non ha modificato la configurazione." : reason instanceof Error ? reason.message : "Cartella log non collegata.";
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

// src/log-directory/existing-directory.ts
function initializeExistingLogDirectory(view, dependencies) {
  const publishAlignment = async (handle, fullPath) => {
    await dependencies.publish({
      "jspider.logDirectoryName": handle.name,
      "jspider.logDirectoryPath": fullPath,
      "jspider.logDirectoryDraft": fullPath,
      "jspider.logDirectoryRevision": Date.now()
    });
  };
  const refresh = async () => {
    const handle = await dependencies.loadExisting();
    view.existingButton.hidden = !handle || handle.name.toLocaleLowerCase() !== "log";
    if (view.existingButton.hidden || !handle) return;
    const fullPath = validateExistingLogPath(view.pathInput.value, handle.name);
    const permission = await handle.queryPermission({ mode: "readwrite" }).catch(() => "prompt");
    if (permission === "granted") {
      await publishAlignment(handle, fullPath);
      view.existingButton.hidden = true;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI \xB7 ${fullPath} \xB7 autorizzazione Chromium gi\xE0 presente.`;
      return;
    }
    view.state.textContent = "Cartella log Chromium gi\xE0 presente. Conferma l\u2019autorizzazione senza riaprire il selettore.";
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
      await publishAlignment(handle, fullPath);
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
var existingDirectory = initializeExistingLogDirectory({
  pathInput,
  existingButton,
  state
}, {
  loadExisting: () => repository.load(),
  publish
});
if (typeof pickerWindow.showDirectoryPicker !== "function") {
  chooseButton.disabled = true;
  state.textContent = "Questo browser Chromium non espone il selettore di cartelle richiesto.";
} else {
  initializeLogDirectoryPicker({ chooseButton, pathInput, state }, {
    pickLog: () => pickerWindow.showDirectoryPicker({
      id: "jspider-quick-workflow-logs",
      mode: "readwrite",
      startIn: "desktop"
    }),
    saveLog: (handle) => repository.save(handle),
    publish
  });
}
void chrome.runtime.sendMessage({ target: "background", action: "settings.get" }).then(async (rawResponse) => {
  const response = rawResponse;
  const configured = response.ok ? response.data?.logDirectoryConfig ?? "" : "";
  pathInput.value = resolveLogDirectoryPath(configured);
  chooseButton.disabled = typeof pickerWindow.showDirectoryPicker !== "function" || !pathInput.value;
  if (pathInput.value) await existingDirectory.refresh();
}).catch((reason) => {
  state.textContent = reason instanceof Error ? reason.message : "Configurazione della cartella log non disponibile.";
});
