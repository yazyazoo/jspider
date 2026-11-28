import { handle, serializeError } from '../background/application';
import { executeJob, JOB_PREFIX } from './jobs';

const state = document.getElementById('runner-state')!;
void navigator.locks.request(`jspider-workflow-${location.hash.slice(1)}`, async () => {
  const job = await executeJob(
    location.hash.slice(1), chrome.storage.local,
    (request) => {
      if (request.action !== 'taskflow.quickWorkflow' && request.action !== 'taskflow.loadPackages') {
        throw new Error('Operazione di esecuzione non valida.');
      }
      return handle(request, {});
    }, serializeError,
  );
  if (job.state === 'running') {
    state.textContent = 'Questa esecuzione era già iniziata. Non viene reinviata. Verifica package e workflow nella WebUI TaskFlow prima di riprovare.';
    await chrome.storage.local.set({ [JOB_PREFIX + job.id]: {
      ...job, state: 'failed', error: { message: state.textContent },
    } });
  } else if (job.state === 'failed') {
    state.textContent = `Errore: ${String(job.error?.message ?? 'operazione non riuscita')}. Verifica nella WebUI prima di ripetere l’invio.`;
  } else {
    const result = job.result as { createdWorkflow?: { id: string }; startError?: { message?: string } };
    state.textContent = result.startError
      ? `Workflow ${result.createdWorkflow?.id} creato; Start non riuscito: ${result.startError.message}. Riprova soltanto Start dalla WebUI.`
      : `Operazione completata${result.createdWorkflow ? ` · Workflow ${result.createdWorkflow.id}` : ''}. Chiusura della scheda…`;
    if (!result.startError) {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
    }
  }
}).catch((reason: unknown) => {
  state.textContent = reason instanceof Error ? reason.message : 'Esecuzione non disponibile.';
});
