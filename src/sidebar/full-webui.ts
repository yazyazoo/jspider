import type { TaskFlowUiConfiguration } from './taskflow-create-bridge';

export interface FullWebUiRuntime extends HTMLElement {
  view: string;
  configure(configuration: TaskFlowUiConfiguration): void;
}

export interface FullWebUiView {
  home: HTMLElement;
  panel: HTMLElement;
  button: HTMLButtonElement;
  status: HTMLElement;
}

export interface FullWebUiDependencies {
  loadConfiguration(): Promise<TaskFlowUiConfiguration>;
  createUi(): Promise<FullWebUiRuntime>;
}

export function initializeFullWebUiToggle(
  view: FullWebUiView,
  dependencies: FullWebUiDependencies,
): () => void {
  let ui: FullWebUiRuntime | null = null;
  const toggle = () => {
    if (!view.panel.hidden) {
      view.home.hidden = false;
      view.panel.hidden = true;
      view.button.textContent = 'Apri WebUI TaskFlow';
      return;
    }
    view.button.disabled = true;
    void (async () => {
      try {
        const configuration = await dependencies.loadConfiguration();
        if (!ui) {
          const candidate = await dependencies.createUi();
          candidate.view = 'dashboard';
          candidate.configure(configuration);
          view.panel.replaceChildren(candidate);
          ui = candidate;
        } else {
          ui.configure(configuration);
        }
        view.status.textContent = '';
        view.home.hidden = true;
        view.panel.hidden = false;
        view.button.textContent = 'Torna a JSpider';
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Configurazione non disponibile.';
        view.status.textContent = `WebUI TaskFlow non disponibile: ${message}`;
        view.home.hidden = false;
        view.panel.hidden = true;
      } finally {
        view.button.disabled = false;
      }
    })();
  };
  view.button.addEventListener('click', toggle);
  return () => view.button.removeEventListener('click', toggle);
}
