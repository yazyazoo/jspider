import {
  requireQuickWorkflowPreset,
  type SubmissionVariant,
} from '../domain/taskflow-contract';
import {
  loadTaskFlowPackages,
  runQuickWorkflow,
  SubmissionBatchError,
} from '../domain/taskflow-pipeline';
import { searchTmdb, type TmdbSearchInput } from '../domain/tmdb';
import { loadEmbySettings, loadSettings, settingsSummary, updateSettings } from './settings';
import { handleActionClick } from './sidepanel';
import { forwardPageMessage } from './page-bridge';
import { TaskFlowClient } from './taskflow-client';
import { TmdbClient } from './tmdb-client';
import { EmbyClient } from './emby-client';
import type { EmbyLookupInput } from '../domain/emby';
import type { MdbListLookupInput } from '../domain/media-ratings';
import { MdbListClient } from './mdblist-client';
import {
  handleQuickWorkflowLogAction,
  QuickWorkflowLogStore,
  type QuickWorkflowLogStorage,
} from './quick-workflow-log';

type Message = { target?: string; action?: string; [key: string]: unknown };

const quickWorkflowLog = new QuickWorkflowLogStore({
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
  remove: (key) => chrome.storage.local.remove(key),
} satisfies QuickWorkflowLogStorage);

chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab, {
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  });
});

function serializeError(reason: unknown): Record<string, unknown> {
  if (reason instanceof SubmissionBatchError) {
    return { name: reason.name, message: reason.message, analysis: reason.analysis };
  }
  const serialized: Record<string, unknown> = {
    name: reason instanceof Error ? reason.name : 'Error',
    message: reason instanceof Error ? reason.message : 'Operazione non riuscita.',
  };
  if (reason !== null && typeof reason === 'object') {
    const record = reason as Record<string, unknown>;
    for (const key of ['status', 'code', 'details']) {
      if (record[key] !== undefined) serialized[key] = record[key];
    }
  }
  return serialized;
}

async function handle(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (message.target !== 'background') throw new Error('Destinazione messaggio non valida.');
  if (message.action === 'page.forward') {
    const request = message.request && typeof message.request === 'object'
      ? message.request as { action: string; data?: Record<string, unknown> }
      : { action: '' };
    return forwardPageMessage(
      sender.tab?.id,
      request,
      (tabId, pageMessage) => chrome.tabs.sendMessage(tabId, pageMessage),
    );
  }
  if (message.action === 'taskflow.quickWorkflowLog.get'
    || message.action === 'taskflow.quickWorkflowLog.clear') {
    return handleQuickWorkflowLogAction(message.action, quickWorkflowLog);
  }
  if (message.action === 'settings.get') return settingsSummary();
  if (message.action === 'settings.save') {
    return updateSettings(message.settings && typeof message.settings === 'object'
      ? message.settings as Record<string, unknown> : {});
  }
  if (message.action === 'settings.taskflowToken') {
    const settings = await loadSettings();
    if (!settings.taskflowToken) throw new Error('Token TaskFlow non configurato.');
    return { token: settings.taskflowToken, baseUrl: settings.taskflowBaseUrl };
  }
  if (message.action === 'emby.check') {
    const emby = await loadEmbySettings();
    if (!emby.baseUrl || !emby.token) throw new Error('Emby non configurato in config.local.json.');
    return new EmbyClient(emby.baseUrl, emby.token).lookup(message.input as EmbyLookupInput);
  }
  if (message.action === 'taskflow.quickWorkflow') {
    let logRunId: string | null = null;
    try { logRunId = await quickWorkflowLog.start(); }
    catch { /* Diagnostics must never interrupt Quick Workflow. */ }
    const appendLog = async (event: Parameters<typeof quickWorkflowLog.append>[0]) => {
      if (!logRunId) return;
      try { await quickWorkflowLog.append(event, logRunId); }
      catch { /* Diagnostics must never replace the TaskFlow result. */ }
    };
    let pipelineStarted = false;
    try {
      if (!Array.isArray(message.variants) || !Array.isArray(message.hosts)
        || typeof message.autodownload !== 'boolean'
        || (message.autodownload && (!message.workflow || typeof message.workflow !== 'object'))) {
        throw new Error('Dati Quick Workflow non validi.');
      }
      if (message.autodownload) {
        requireQuickWorkflowPreset(
          (message.workflow as Record<string, unknown>).preset,
        );
      }
      const settings = await loadSettings();
      const taskflow = new TaskFlowClient(settings.taskflowBaseUrl, settings.taskflowToken);
      const integrationId = await taskflow.discoverJDownloaderIntegration();
      pipelineStarted = true;
      return await runQuickWorkflow({
        api: taskflow, integrationId,
        variants: message.variants as SubmissionVariant[],
        hosts: message.hosts as Array<'filestore.me' | 'terabytez.org'>,
        autodownload: message.autodownload,
        onLogEvent: appendLog,
        ...(message.autodownload ? {
          workflow: message.workflow as never,
        } : {}),
      });
    } catch (reason) {
      if (!pipelineStarted) {
        await appendLog({
          phase: 'submission', kind: 'error', payload: serializeError(reason),
        });
      }
      throw reason;
    }
  }
  const settings = await loadSettings();
  if (message.action === 'tmdb.search') {
    const client = new TmdbClient(settings.tmdbCredential);
    return searchTmdb(message.input as TmdbSearchInput, (path, params) => client.request(path, params));
  }
  if (message.action === 'mdblist.lookup') {
    return new MdbListClient(settings.mdblistApiKey).lookup(message.input as MdbListLookupInput);
  }
  const taskflow = new TaskFlowClient(settings.taskflowBaseUrl, settings.taskflowToken);
  if (message.action === 'taskflow.catalog') {
    return { presets: await taskflow.getPresets() };
  }
  if (message.action === 'taskflow.loadPackages') {
    if (!Array.isArray(message.variants) || !Array.isArray(message.hosts)) {
      throw new Error('Dati package TaskFlow non validi.');
    }
    const integrationId = await taskflow.discoverJDownloaderIntegration();
    return loadTaskFlowPackages({
      api: taskflow,
      integrationId,
      variants: message.variants as SubmissionVariant[],
      hosts: message.hosts as Array<'filestore.me' | 'terabytez.org'>,
    });
  }
  throw new Error('Azione background non supportata.');
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.target !== 'background') return undefined;
  void handle(message, sender).then(
    (data) => sendResponse({ ok: true, data }),
    (reason) => sendResponse({ ok: false, error: serializeError(reason) }),
  );
  return true;
});

