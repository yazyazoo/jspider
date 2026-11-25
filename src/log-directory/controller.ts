import type { WritableDirectoryHandle } from '../background/log-directory';
import type {
  ProjectDirectoryHandle,
  ProjectLogAlignment,
} from './project-config';

export interface LogDirectoryPickerView {
  pathInput: HTMLInputElement;
  chooseButton: HTMLButtonElement;
  state: HTMLElement;
}
export interface LogDirectoryPickerDependencies {
  pickProject(): Promise<ProjectDirectoryHandle>;
  align(project: ProjectDirectoryHandle, path: string): Promise<ProjectLogAlignment>;
  saveLog(handle: WritableDirectoryHandle): Promise<void>;
  publish(items: Record<string, unknown>): Promise<void>;
  synchronizeSettings(): Promise<void>;
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
    view.state.textContent = 'Seleziona la cartella progetto che contiene config.local.json, dist e log…';
    try {
      const project = await dependencies.pickProject();
      const result = await dependencies.align(project, requestedPath);
      await dependencies.saveLog(result.logHandle as WritableDirectoryHandle);
      await dependencies.synchronizeSettings();
      await dependencies.publish({
        'jspider.logDirectoryName': result.logHandle.name,
        'jspider.logDirectoryPath': result.fullPath,
        'jspider.logDirectoryDraft': result.fullPath,
        'jspider.logDirectoryRevision': Date.now(),
      });
      view.pathInput.value = result.fullPath;
      const files = result.updatedFiles.length > 1 ? 'config root e dist aggiornati' : 'config aggiornato';
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI · ${result.fullPath} · ${files}. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === 'AbortError'
        ? 'Chromium ha annullato il selettore dopo la scelta (AbortError). Se la finestra di selezione copre Edge, riducila oppure usa “Conferma cartella già autorizzata”.'
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
