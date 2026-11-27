import type { WritableDirectoryHandle } from '../background/log-directory';
import { validateExistingLogPath } from './path-validation';

export interface ExistingLogDirectoryView {
  pathInput: HTMLInputElement;
  existingButton: HTMLButtonElement;
  state: HTMLElement;
}

export interface ExistingLogDirectoryDependencies {
  loadExisting(): Promise<WritableDirectoryHandle | null>;
  publish(items: Record<string, unknown>): Promise<void>;
}

export function initializeExistingLogDirectory(
  view: ExistingLogDirectoryView,
  dependencies: ExistingLogDirectoryDependencies,
): {
  refresh(): Promise<void>;
  adopt(): Promise<void>;
  dispose(): void;
} {
  const publishAlignment = async (handle: WritableDirectoryHandle, fullPath: string) => {
    await dependencies.publish({
      'jspider.logDirectoryName': handle.name,
      'jspider.logDirectoryPath': fullPath,
      'jspider.logDirectoryDraft': fullPath,
      'jspider.logDirectoryRevision': Date.now(),
    });
  };

  const refresh = async () => {
    const handle = await dependencies.loadExisting();
    view.existingButton.hidden = !handle || handle.name.toLocaleLowerCase() !== 'log';
    if (view.existingButton.hidden || !handle) return;
    const fullPath = validateExistingLogPath(view.pathInput.value, handle.name);
    const permission = await handle.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as const);
    if (permission === 'granted') {
      await publishAlignment(handle, fullPath);
      view.existingButton.hidden = true;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI · ${fullPath} · autorizzazione Chromium già presente.`;
      return;
    }
    view.state.textContent = 'Cartella log Chromium già presente. Conferma l’autorizzazione senza riaprire il selettore.';
  };

  const adopt = async () => {
    view.existingButton.disabled = true;
    try {
      const handle = await dependencies.loadExisting();
      if (!handle) throw new Error('CHROMIUM NON AUTORIZZATO · nessuna cartella log già salvata.');
      const fullPath = validateExistingLogPath(view.pathInput.value, handle.name);
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      const granted = permission === 'granted'
        ? permission : await handle.requestPermission({ mode: 'readwrite' });
      if (granted !== 'granted') {
        throw new Error('CHROMIUM NON AUTORIZZATO · permesso di scrittura non concesso.');
      }
      await publishAlignment(handle, fullPath);
      view.pathInput.value = fullPath;
      view.state.textContent = `CONFIG E CHROMIUM ALLINEATI · ${fullPath} · cartella log già autorizzata confermata. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof Error
        ? reason.message : 'Cartella log già autorizzata non confermata.';
    } finally {
      view.existingButton.disabled = false;
    }
  };

  const click = () => { void adopt(); };
  view.existingButton.addEventListener('click', click);
  return {
    refresh,
    adopt,
    dispose() { view.existingButton.removeEventListener('click', click); },
  };
}
