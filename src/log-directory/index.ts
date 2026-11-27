import {
  LogDirectoryRepository,
  type WritableDirectoryHandle,
} from '../background/log-directory';
import { initializeLogDirectoryPicker } from './controller';
import { initializeExistingLogDirectory } from './existing-directory';
import { resolveLogDirectoryPath } from './path-validation';

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options: {
    id: string;
    mode: 'readwrite';
    startIn: 'desktop';
  }): Promise<WritableDirectoryHandle>;
}
interface RuntimeResponse { ok: boolean; error?: { message?: string } }
const chooseButton = document.getElementById('choose-directory') as HTMLButtonElement;
const existingButton = document.getElementById('confirm-existing-directory') as HTMLButtonElement;
const pathInput = document.getElementById('directory-path') as HTMLInputElement;
const state = document.getElementById('directory-state') as HTMLElement;
const pickerWindow = window as unknown as Partial<DirectoryPickerWindow>;
const repository = new LogDirectoryRepository();
const publish = (items: Record<string, unknown>) => chrome.storage.local.set(items);
const existingDirectory = initializeExistingLogDirectory({
  pathInput, existingButton, state,
}, {
  loadExisting: () => repository.load(),
  publish,
});

if (typeof pickerWindow.showDirectoryPicker !== 'function') {
  chooseButton.disabled = true;
  state.textContent = 'Questo browser Chromium non espone il selettore di cartelle richiesto.';
} else {
  initializeLogDirectoryPicker({ chooseButton, pathInput, state }, {
    pickLog: () => pickerWindow.showDirectoryPicker!({
      id: 'jspider-quick-workflow-logs', mode: 'readwrite', startIn: 'desktop',
    }),
    saveLog: (handle) => repository.save(handle),
    publish,
  });
}

void chrome.runtime.sendMessage({ target: 'background', action: 'settings.get' })
  .then(async (rawResponse) => {
    const response = rawResponse as RuntimeResponse & { data?: { logDirectoryConfig?: string } };
    const configured = response.ok ? response.data?.logDirectoryConfig ?? '' : '';
    pathInput.value = resolveLogDirectoryPath(configured);
    chooseButton.disabled = typeof pickerWindow.showDirectoryPicker !== 'function' || !pathInput.value;
    if (pathInput.value) await existingDirectory.refresh();
  }).catch((reason: unknown) => {
    state.textContent = reason instanceof Error
      ? reason.message : 'Configurazione della cartella log non disponibile.';
  });
