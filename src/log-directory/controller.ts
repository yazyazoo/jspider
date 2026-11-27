import type { WritableDirectoryHandle } from '../background/log-directory';
import { validateExistingLogPath } from './path-validation';

export interface LogDirectoryPickerView {
  pathInput: HTMLInputElement;
  chooseButton: HTMLButtonElement;
  state: HTMLElement;
}
export interface LogDirectoryPickerDependencies {
  pickLog(): Promise<WritableDirectoryHandle>;
  saveLog(handle: WritableDirectoryHandle): Promise<void>;
  publish(items: Record<string, unknown>): Promise<void>;
}
export function initializeLogDirectoryPicker(
  view: LogDirectoryPickerView,
  dependencies: LogDirectoryPickerDependencies,
): {
  choose(): Promise<void>;
  dispose(): void;
} {
  const choose = async () => {
    const requestedPath = view.pathInput.value.trim();
    if (!requestedPath) {
      view.state.textContent = 'Inserisci il percorso completo della cartella log prima di continuare.';
      return;
    }
    view.chooseButton.disabled = true;
    view.state.textContent = 'Seleziona direttamente la cartella log indicata sopra…';
    try {
      const logHandle = await dependencies.pickLog();
      const fullPath = validateExistingLogPath(requestedPath, logHandle.name);
      await dependencies.saveLog(logHandle);
      await dependencies.publish({
        'jspider.logDirectoryName': logHandle.name,
        'jspider.logDirectoryPath': fullPath,
        'jspider.logDirectoryDraft': fullPath,
        'jspider.logDirectoryRevision': Date.now(),
      });
      view.pathInput.value = fullPath;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI · ${fullPath}. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === 'AbortError'
        ? 'Selezione annullata. JSpider non ha modificato la configurazione.'
        : reason instanceof Error ? reason.message : 'Cartella log non collegata.';
    } finally {
      view.chooseButton.disabled = false;
    }
  };
  const click = () => { void choose(); };
  view.chooseButton.addEventListener('click', click);
  return {
    choose,
    dispose() { view.chooseButton.removeEventListener('click', click); },
  };
}
