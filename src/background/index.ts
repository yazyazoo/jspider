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

type Message = { target?: string; action?: string; [key: string]: unknown };

chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab, {
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  });
});

function serializeError(reason: unknown): Record<string, unknown> {
  if (reason instanceof SubmissionBatchError) {
    return { name: reason.name, message: reason.message, analysis: reason.analysis };
  }
  return {
    name: reason instanceof Error ? reason.name : 'Error',
    message: reason instanceof Error ? reason.message : 'Operazione non riuscita.',
  };
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
  if (message.action === 'taskflow.quickWorkflow') {
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
    const variants = message.variants as SubmissionVariant[];
    const integrationId = await taskflow.discoverJDownloaderIntegration();
    return runQuickWorkflow({
      api: taskflow, integrationId, variants,
      hosts: message.hosts as Array<'filestore.me' | 'terabytez.org'>,
      autodownload: message.autodownload,
      ...(message.autodownload ? {
        workflow: message.workflow as never,
      } : {}),
    });
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

