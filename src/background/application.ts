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
import { forwardPageMessage } from './page-bridge';
import { TaskFlowClient } from './taskflow-client';
import { TmdbClient } from './tmdb-client';
import { EmbyClient } from './emby-client';
import type { EmbyLookupInput } from '../domain/emby';
import type { MdbListLookupInput } from '../domain/media-ratings';
import { MdbListClient } from './mdblist-client';
import { JustWatchClient, type JustWatchLookupInput } from './justwatch-client';
import { OmdbClient } from './omdb-client';
import {
  handleQuickWorkflowLogAction,
  QuickWorkflowLogStore,
  type QuickWorkflowLogStorage,
} from './quick-workflow-log';
import {
  LogDirectoryRepository,
  FollowLogHistoryReader,
  QuickWorkflowFileWriter,
} from './log-directory';
import {
  normalizeFollowHosts,
  prepareFollowVariants,
  readProcessedFollowLinks,
  sameFollowChain,
  type FollowSeasonLogContext,
} from '../domain/follow-season';
import type { ReleaseVariant } from '../domain/models';
import type { ArchiveHost } from '../domain/archive-links';

type Message = { target?: string; action?: string; [key: string]: unknown };

const logDirectory = new LogDirectoryRepository();
const followLogHistory = new FollowLogHistoryReader(logDirectory);
const quickWorkflowLog = new QuickWorkflowLogStore({
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
  remove: (key) => chrome.storage.local.remove(key),
} satisfies QuickWorkflowLogStorage, undefined, undefined, new QuickWorkflowFileWriter(logDirectory));

export function serializeError(reason: unknown): Record<string, unknown> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireFollowContext(value: unknown): FollowSeasonLogContext {
  if (!isRecord(value) || value.mediaKind !== 'tv'
    || !Number.isSafeInteger(value.tmdbId) || Number(value.tmdbId) <= 0
    || !Number.isSafeInteger(value.season) || Number(value.season) < 0
    || typeof value.title !== 'string' || !value.title.trim()
    || !Array.isArray(value.hosts)) {
    throw new Error('Dati Segui stagione non validi.');
  }
  const rawHosts = value.hosts as unknown[];
  const hosts = normalizeFollowHosts(rawHosts as ArchiveHost[]);
  if (!hosts.length || hosts.length !== rawHosts.length) {
    throw new Error('Host Segui stagione non validi.');
  }
  return {
    mediaKind: 'tv', tmdbId: Number(value.tmdbId), season: Number(value.season),
    hosts, title: value.title.trim(),
  };
}

function requireFollowVariants(value: unknown, season: number): ReleaseVariant[] {
  if (!Array.isArray(value) || !value.length
    || value.some((variant) => !isRecord(variant) || variant.season !== season)) {
    throw new Error('Le versioni Segui devono appartenere a una sola stagione.');
  }
  return value as ReleaseVariant[];
}

function requireQuickWorkflowFollow(message: Message): FollowSeasonLogContext | undefined {
  if (message.follow === undefined) return undefined;
  const follow = requireFollowContext(message.follow);
  const variants = requireFollowVariants(message.variants, follow.season);
  if (!message.autodownload) {
    throw new Error('Segui stagione richiede Autodownload e l’avvio del workflow.');
  }
  const quickHosts = Array.isArray(message.hosts)
    ? normalizeFollowHosts(message.hosts as ArchiveHost[]) : [];
  if (!Array.isArray(message.hosts) || quickHosts.length !== message.hosts.length
    || !sameFollowChain(follow, { ...follow, hosts: quickHosts })) {
    throw new Error('Gli host Segui non corrispondono agli host Quick Workflow.');
  }
  const workflow = isRecord(message.workflow) ? message.workflow : null;
  const metadata = workflow && isRecord(workflow.metadata) ? workflow.metadata : null;
  if (!metadata || metadata.mode !== 'validated' || metadata.mediaKind !== 'tv'
    || metadata.id !== follow.tmdbId || !variants.length) {
    throw new Error('Segui stagione richiede una serie TMDB validata.');
  }
  return follow;
}

export async function handle(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
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
  if (message.action === 'taskflow.logDirectory.status') return logDirectory.status();
  if (message.action === 'taskflow.followSeason.prepare') {
    const follow = requireFollowContext(message.follow);
    const variants = requireFollowVariants(message.variants, follow.season);
    const history = await followLogHistory.read(follow);
    const processed = readProcessedFollowLinks(history.documents);
    return {
      ...prepareFollowVariants(variants, follow.hosts, processed),
      matchedFiles: history.matchedFiles,
      historicalHosts: history.historicalHosts,
    };
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
  if (message.action === 'emby.season') {
    const seriesId = typeof message.seriesId === 'string' ? message.seriesId.trim() : '';
    const seasonId = typeof message.seasonId === 'string' ? message.seasonId.trim() : '';
    if (!seriesId || !seasonId) throw new Error('Identificatore Emby non valido.');
    const emby = await loadEmbySettings();
    if (!emby.baseUrl || !emby.token) throw new Error('Emby non configurato in config.local.json.');
    return new EmbyClient(emby.baseUrl, emby.token)
      .lookupSeasonEpisodeOne(seriesId, seasonId);
  }
  if (message.action === 'justwatch.lookup') {
    return new JustWatchClient().lookup(message.input as JustWatchLookupInput);
  }
  if (message.action === 'omdb.awards') {
    const settings = await loadSettings();
    return new OmdbClient(settings.omdbApiKey)
      .lookupAwards(typeof message.imdbId === 'string' ? message.imdbId : '');
  }
  if (message.action === 'taskflow.quickWorkflow') {
    const follow = requireQuickWorkflowFollow(message);
    let logRunId: string | null = null;
    const workflowName = message.workflow !== null && typeof message.workflow === 'object'
      && typeof (message.workflow as Record<string, unknown>).workflowName === 'string'
      ? (message.workflow as Record<string, unknown>).workflowName as string
      : 'Quick Workflow';
    try { logRunId = await quickWorkflowLog.start(workflowName, follow); }
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
    } finally {
      await quickWorkflowLog.flushHistory();
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
