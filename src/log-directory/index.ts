import {
  LogDirectoryRepository,
  type WritableDirectoryHandle,
} from '../background/log-directory';
import { initializeLogDirectoryPicker } from './controller';
import { initializeExistingLogDirectory } from './existing-directory';
import {
  alignProjectLogDirectory,
  type ProjectDirectoryHandle,
} from './project-config';

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options: {
    id: string;
    mode: 'readwrite';
    startIn: 'desktop';
  }): Promise<ProjectDirectoryHandle>;
}
interface RuntimeResponse { ok: boolean; error?: { message?: string } }
const chooseButton = document.getElementById('choose-directory') as HTMLButtonElement;
const existingButton = document.getElementById('confirm-existing-directory') as HTMLButtonElement;
const pathInput = document.getElementById('directory-path') as HTMLInputElement;
const state = document.getElementById('directory-state') as HTMLElement;
const pickerWindow = window as unknown as Partial<DirectoryPickerWindow>;
const repository = new LogDirectoryRepository();
const publish = (items: Record<string, unknown>) => chrome.storage.local.set(items);
const synchronizeSettings = async () => {
  const response = await chrome.runtime.sendMessage({
    target: 'background', action: 'settings.get',
  }) as RuntimeResponse;
  if (!response.ok) throw new Error(response.error?.message ?? 'Sincronizzazione impostazioni non riuscita.');
};

const existingDirectory = initializeExistingLogDirectory({
  pathInput, existingButton, state,
}, {
  loadExisting: () => repository.load(),
  publish,
  synchronizeSettings,
});
void existingDirectory.refresh().catch(() => undefined);

if (typeof pickerWindow.showDirectoryPicker !== 'function') {
  chooseButton.disabled = true;
  state.textContent = 'Questo browser Chromium non espone il selettore di cartelle richiesto.';
} else {
  initializeLogDirectoryPicker({ chooseButton, pathInput, state }, {
    pickProject: () => pickerWindow.showDirectoryPicker!({
      id: 'jspider-project-log-config', mode: 'readwrite', startIn: 'desktop',
    }),
    align: alignProjectLogDirectory,
    saveLog: (handle) => repository.save(handle),
    publish,
    synchronizeSettings,
  });
  void Promise.all([
    chrome.storage.local.get(['jspider.logDirectoryDraft', 'jspider.logDirectoryPath']),
    chrome.runtime.sendMessage({ target: 'background', action: 'settings.get' }),
  ]).then(([stored, rawResponse]) => {
    const response = rawResponse as RuntimeResponse & { data?: { logDirectoryConfig?: string } };
    const configured = response.ok ? response.data?.logDirectoryConfig ?? '' : '';
    pathInput.value = String(stored['jspider.logDirectoryDraft']
      ?? stored['jspider.logDirectoryPath'] ?? configured);
  }).catch(() => undefined);
}
