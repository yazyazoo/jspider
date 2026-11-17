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
    view.chooseButton.disabled = true;
    view.state.textContent = "Selezione della cartella\u2026";
    try {
      const handle = await dependencies.pick();
      await dependencies.save(handle);
      await dependencies.publish({
        "jspider.logDirectoryName": handle.name,
        "jspider.logDirectoryRevision": Date.now()
      });
      view.state.textContent = `Cartella \u201C${handle.name}\u201D collegata. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === "AbortError" ? "Selezione annullata." : reason instanceof Error ? reason.message : "Cartella log non collegata.";
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

// src/log-directory/index.ts
var chooseButton = document.getElementById("choose-directory");
var state = document.getElementById("directory-state");
var pickerWindow = window;
var repository = new LogDirectoryRepository();
if (typeof pickerWindow.showDirectoryPicker !== "function") {
  chooseButton.disabled = true;
  state.textContent = "Questo browser Chromium non espone il selettore di cartelle richiesto.";
} else {
  initializeLogDirectoryPicker({ chooseButton, state }, {
    pick: () => pickerWindow.showDirectoryPicker({
      id: "jspider-quick-workflow-logs",
      mode: "readwrite",
      startIn: "desktop"
    }),
    save: (handle) => repository.save(handle),
    publish: (items) => chrome.storage.local.set(items)
  });
  void repository.status().then((status) => {
    if (status.configured && status.name) {
      state.textContent = status.permission === "prompt" || status.permission === "denied" ? `La cartella \u201C${status.name}\u201D richiede una nuova autorizzazione.` : `Cartella attuale: \u201C${status.name}\u201D.`;
    }
  }).catch(() => void 0);
}
