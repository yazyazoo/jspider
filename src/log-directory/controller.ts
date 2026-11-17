import type { WritableDirectoryHandle } from '../background/log-directory';

export interface LogDirectoryPickerView {
  chooseButton: HTMLButtonElement;
  state: HTMLElement;
}
export interface LogDirectoryPickerDependencies {
  pick(): Promise<WritableDirectoryHandle>;
  save(handle: WritableDirectoryHandle): Promise<void>;
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
    view.chooseButton.disabled = true;
    view.state.textContent = 'Selezione della cartella…';
    try {
      const handle = await dependencies.pick();
      await dependencies.save(handle);
      await dependencies.publish({
        'jspider.logDirectoryName': handle.name,
        'jspider.logDirectoryRevision': Date.now(),
      });
      view.state.textContent = `Cartella “${handle.name}” collegata. Puoi chiudere questa scheda.`;
    } catch (reason) {
      view.state.textContent = reason instanceof DOMException && reason.name === 'AbortError'
        ? 'Selezione annullata.'
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
