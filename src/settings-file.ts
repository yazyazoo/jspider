import { linkConfigFile, type WritableConfigFile } from './background/config-file';
import { settingsSummary } from './background/settings';

interface FilePickerWindow extends Window {
  showOpenFilePicker(options: {
    multiple: false;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }): Promise<WritableConfigFile[]>;
}
const button = document.getElementById('choose-config') as HTMLButtonElement;
const state = document.getElementById('config-state')!;
button.addEventListener('click', () => {
  // Open the picker immediately inside the user gesture, before any awaits.
  const selection = (window as unknown as FilePickerWindow).showOpenFilePicker({
    multiple: false, types: [{ description: 'Configurazione JSpider', accept: { 'application/json': ['.json'] } }],
  });
  button.disabled = true;
  void selection.then(async ([handle]) => {
    if (!handle) return;
    await linkConfigFile(handle);
    await settingsSummary();
    state.textContent = 'config.local.json collegato. Le impostazioni leggono e aggiornano questo file; Chromium riceve una copia. Torna a JSpider e apri Impostazioni.';
  }).catch((reason: unknown) => {
    state.textContent = reason instanceof DOMException && reason.name === 'AbortError'
      ? 'Selezione annullata. Nessuna modifica.'
      : reason instanceof Error ? reason.message : 'File non collegato.';
  }).finally(() => { button.disabled = false; });
});
