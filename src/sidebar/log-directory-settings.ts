import type { LogDirectoryStatus } from '../background/log-directory';

export interface LogDirectorySettingsStatus extends LogDirectoryStatus {
  configuredPath: string;
  authorizedPath: string | null;
}
export interface LogDirectorySettingsView {
  pathInput: HTMLInputElement;
  state: HTMLElement;
  chooseButton: HTMLButtonElement;
}
export interface LogDirectorySettingsDependencies {
  loadStatus(): Promise<LogDirectorySettingsStatus>;
  openPicker(path: string): Promise<void>;
}
export function renderLogDirectoryStatus(
  view: LogDirectorySettingsView,
  status: LogDirectorySettingsStatus,
): void {
  view.pathInput.value = status.configuredPath;
  view.chooseButton.textContent = 'Autorizza cartella log';
  if (!status.configuredPath) {
    view.state.textContent = 'CONFIG MANCANTE · inserisci il percorso completo della cartella log.';
    return;
  }
  if (!status.configured || !status.name || status.permission === 'prompt'
      || status.permission === 'denied' || status.permission === 'missing') {
    view.state.textContent = `CHROMIUM NON AUTORIZZATO · config: ${status.configuredPath}.`;
    return;
  }
  if (!status.authorizedPath) {
    view.state.textContent = `NON ALLINEATI · config: ${status.configuredPath} · Chromium: percorso completo non verificato.`;
    return;
  }
  if (status.configuredPath !== status.authorizedPath) {
    view.state.textContent = `NON ALLINEATI · config: ${status.configuredPath} · Chromium: ${status.authorizedPath}.`;
    return;
  }
  view.chooseButton.textContent = 'Riautorizza cartella log';
  view.state.textContent = `CONFIG E CHROMIUM ALLINEATI · ${status.configuredPath}.`;
}
export function initializeLogDirectorySettings(
  view: LogDirectorySettingsView,
  dependencies: LogDirectorySettingsDependencies,
): {
  refresh(): Promise<void>;
  dispose(): void;
} {
  const refresh = async () => {
    renderLogDirectoryStatus(view, await dependencies.loadStatus());
  };
  const choose = () => {
    const path = view.pathInput.value.trim();
    if (!path) {
      view.state.textContent = 'CONFIG MANCANTE · inserisci il percorso completo della cartella log.';
      return;
    }
    view.state.textContent = 'Seleziona direttamente la cartella log nella nuova scheda JSpider.';
    void dependencies.openPicker(path);
  };
  view.chooseButton.addEventListener('click', choose);
  return {
    refresh,
    dispose() { view.chooseButton.removeEventListener('click', choose); },
  };
}
