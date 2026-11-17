import type { LogDirectoryStatus } from '../background/log-directory';

export interface LogDirectorySettingsView {
  state: HTMLElement;
  chooseButton: HTMLButtonElement;
}
export interface LogDirectorySettingsDependencies {
  loadStatus(): Promise<LogDirectoryStatus>;
  openPicker(): Promise<void>;
}
export function renderLogDirectoryStatus(
  view: LogDirectorySettingsView,
  status: LogDirectoryStatus,
): void {
  if (!status.configured || !status.name) {
    view.state.textContent = 'Nessuna cartella log configurata.';
    view.chooseButton.textContent = 'Scegli cartella log';
    return;
  }
  view.chooseButton.textContent = 'Cambia cartella';
  view.state.textContent = status.permission === 'granted'
    ? `${status.name} · scrittura autorizzata`
    : `${status.name} · autorizzazione da rinnovare`;
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
    view.state.textContent = 'Completa la scelta nella nuova scheda JSpider.';
    void dependencies.openPicker();
  };
  view.chooseButton.addEventListener('click', choose);
  return {
    refresh,
    dispose() { view.chooseButton.removeEventListener('click', choose); },
  };
}
