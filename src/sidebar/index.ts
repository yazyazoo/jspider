import {
  normalizeWorkflowName,
  requireQuickWorkflowPreset,
  requireWorkflowName,
  type WorkflowMetadata,
} from '../domain/taskflow-contract';
import {
  initialCreateModeState,
  lockCreateMode,
  resolveArchivePassword,
  selectCreateMode,
  type CreateModeState,
} from '../domain/create-mode';
import type { PageSnapshot, RecommendationProfile, ReleaseVariant } from '../domain/models';
import { recommendVersions } from '../domain/recommendations';
import type { TmdbCandidate } from '../domain/tmdb';
import { normalizeTaskFlowBaseUrl } from '../domain/taskflow-url';
import {
  autoSearchSnapshot,
  applyCreateModeView,
  clearTmdbView,
  initializeOverlayWidthControl,
  LatestResultGate,
  loadCandidateEnrichments,
  runSidebarStartup,
} from './controller';
import { applyThankReplacements, reconcileSelection } from './state';
import {
  openTaskFlowCreate,
  type TaskFlowCreateRuntime,
  type TaskFlowCreateSeed,
  type TaskFlowUiConfiguration,
} from './taskflow-create-bridge';
import { initializeTooltips } from './tooltips';
import { initializeDismissiblePopover } from './popover';
import { renderCandidateCards } from './candidates';
import { applyPhaseValidity, resolvePhaseValidity } from './phase-validation';
import {
  fillSettingsFields,
  readSettingsFields,
  type SettingsFields,
} from './settings-form';
import type { SettingsSummary } from '../background/settings';
import { renderTechnicalSummary } from './technical-summary';
import { initializeFullWebUiToggle, type FullWebUiRuntime } from './full-webui';
import { resolvePresetCleanup, type CleanupPreset } from './preset-cleanup';
import type { EmbyLookupInput, EmbyPresenceResult } from '../domain/emby';
import { EmbyPanelController, type EmbySeasonFilesResult } from './emby-status';
import type { MediaRatings } from '../domain/media-ratings';
import {
  copyText,
  initializeQuickWorkflowLog,
} from './quick-workflow-log';
import type { QuickWorkflowLogDocument } from '../background/quick-workflow-log';
import { initializeLogDirectorySettings } from './log-directory-settings';
import type { LogDirectoryStatus } from '../background/log-directory';
import {
  initializeWebUiVersionCheck,
  type TaskFlowWebUiVersion,
} from './webui-version';

interface RuntimeResponse<T> { ok: boolean; data?: T; error?: { message?: string; [key: string]: unknown } }
interface WorkflowPreset extends CleanupPreset { name: string; tasks: string[] }
interface Catalog { presets: WorkflowPreset[] }
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const select = (id: string) => element<HTMLSelectElement>(id);
let snapshot: PageSnapshot | null = null;
let selectedKeys: string[] = [];
let explicitlyAdjusted = false;
let candidates: TmdbCandidate[] = [];
let candidateRatings = new Map<number, MediaRatings>();
let metadata: WorkflowMetadata | null = null;
let catalog: Catalog | null = null;
let settings: SettingsSummary | null = null;
let createMode: CreateModeState = initialCreateModeState();
let manualPassword: string | null = null;
const tmdbResultGate = new LatestResultGate();
const embyResultGate = new LatestResultGate();
const ratingsResultGate = new LatestResultGate();
const embyPanel = new EmbyPanelController(
  element('emby-status'),
  (seriesId, seasonId) => background<EmbySeasonFilesResult>('emby.season', { seriesId, seasonId }),
);
embyPanel.setStatus({ state: 'idle' });
initializeTooltips(document);
initializeDismissiblePopover(
  element<HTMLButtonElement>('settings-button'),
  element('settings-panel'),
  document,
);
initializeWebUiVersionCheck({
  button: element<HTMLButtonElement>('webui-version-check'),
  state: element('webui-version-state'),
}, {
  async loadEmbedded() {
    const response = await fetch(chrome.runtime.getURL('taskflow-ui-version.json'), {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`metadati incorporati HTTP ${response.status}`);
    return response.json() as Promise<TaskFlowWebUiVersion>;
  },
});
const quickLogButton = element<HTMLButtonElement>('quick-log-button');
const logDirectorySettings = initializeLogDirectorySettings({
  state: element('log-directory-state'),
  chooseButton: element<HTMLButtonElement>('log-directory-choose'),
}, {
  async loadStatus() {
    try { return await background<LogDirectoryStatus>('taskflow.logDirectory.status'); }
    catch { return { configured: false, name: null, permission: 'missing' }; }
  },
  async openPicker() {
    await chrome.tabs.create({ url: chrome.runtime.getURL('log-directory.html') });
  },
});
initializeDismissiblePopover(
  quickLogButton,
  element('quick-log-panel'),
  document,
);
const quickLog = initializeQuickWorkflowLog({
  state: element('quick-log-state'),
  entries: element('quick-log-entries'),
  copyButton: element<HTMLButtonElement>('quick-log-copy'),
  clearButton: element<HTMLButtonElement>('quick-log-clear'),
}, {
  load: () => background<QuickWorkflowLogDocument | null>('taskflow.quickWorkflowLog.get'),
  async clear() { await background('taskflow.quickWorkflowLog.clear'); },
  async copy(value) {
    if (!copyText(value)) window.prompt('Copia il log JSON Quick Workflow', value);
  },
});
const refreshQuickLog = () => void quickLog.refresh().catch((reason) => {
  element('quick-log-state').textContent = reason instanceof Error
    ? reason.message : 'Log Quick Workflow non disponibile.';
});
quickLogButton.addEventListener('click', refreshQuickLog);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['jspider.quickWorkflowLog']) refreshQuickLog();
  if (areaName === 'local'
    && (changes['jspider.logDirectoryName'] || changes['jspider.logDirectoryRevision'])) {
    void logDirectorySettings.refresh();
  }
});
initializeFullWebUiToggle({
  home: element('home-view'),
  panel: element('taskflow-full-panel'),
  button: element<HTMLButtonElement>('open-taskflow-webui'),
  status: element('status'),
}, {
  loadConfiguration: taskFlowConfiguration,
  createUi: async () => {
    await customElements.whenDefined('taskflow-ui');
    return document.createElement('taskflow-ui') as FullWebUiRuntime;
  },
});

async function background<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ target: 'background', action, ...data }) as RuntimeResponse<T>;
  if (!response.ok) {
    const error = new Error(response.error?.message ?? 'Operazione non riuscita.');
    Object.assign(error, response.error);
    throw error;
  }
  return response.data as T;
}

async function page<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  return background<T>('page.forward', { request: { action, data } });
}

function status(message: string, error = false): void {
  const node = element<HTMLParagraphElement>('status');
  node.textContent = message;
  node.classList.toggle('error', error);
}

function settingsFields(): SettingsFields {
  return {
    taskflowBaseUrl: input('taskflow-url'),
    taskflowToken: input('taskflow-token'),
    tmdbCredential: input('tmdb-token'),
    omdbApiKey: input('omdb-api-key'),
    mdblistApiKey: input('mdblist-api-key'),
  };
}

function selectedVariants(): ReleaseVariant[] {
  const selected = new Set(selectedKeys);
  return snapshot?.variants.filter((variant) => selected.has(variant.key)) ?? [];
}

function selectedHosts(): Array<'filestore.me' | 'terabytez.org'> {
  return [
    ...(input('filestore').checked ? ['filestore.me' as const] : []),
    ...(input('terabytez').checked ? ['terabytez.org' as const] : []),
  ];
}

function recommendation() {
  return recommendVersions(
    snapshot?.variants ?? [],
    select('profile').value as RecommendationProfile,
    input('limit').value === '' ? null : Number(input('limit').value),
  );
}

function renderVersions(): void {
  const container = element<HTMLDivElement>('versions');
  container.replaceChildren();
  const proposal = recommendation();
  selectedKeys = reconcileSelection(
    selectedKeys, explicitlyAdjusted, snapshot?.variants.map((variant) => variant.key) ?? [], proposal.keys,
  );
  const selected = new Set(selectedKeys);
  for (const variant of snapshot?.variants ?? []) {
    const card = document.createElement('article');
    card.className = 'version-card';
    const label = document.createElement('label');
    label.className = 'version-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(variant.key);
    checkbox.addEventListener('change', () => {
      explicitlyAdjusted = true;
      selectedKeys = checkbox.checked
        ? [...new Set([...selectedKeys, variant.key])]
        : selectedKeys.filter((key) => key !== variant.key);
      renderVersions();
    });
    const title = document.createElement('strong');
    title.textContent = variant.packageName;
    label.append(checkbox, title);
    const technical = renderTechnicalSummary(document, variant.technical);
    const reason = document.createElement('p');
    reason.className = 'version-reason small';
    reason.textContent = proposal.reasons[variant.key] ?? 'Scelta manuale.';
    if (variant.locked) reason.textContent += ' Ringrazia l’articolo per sbloccare i link.';
    if (variant.linkError) reason.textContent += ` ${variant.linkError}`;
    card.append(label, technical, reason);
    container.append(card);
  }
  element('recommendation-notes').textContent = proposal.notes.join(' ');
  input('thank-selected').disabled = !snapshot?.supportsThanks || !selectedKeys.length;
  const links = selectedVariants().flatMap((variant) => variant.links);
  element('filestore-count').textContent = `· ${links.filter((link) => new URL(link).hostname === 'filestore.me').length}`;
  element('terabytez-count').textContent = `· ${links.filter((link) => new URL(link).hostname === 'terabytez.org').length}`;
  syncPasswordField();
  renderCreateState();
}

function renderCandidates(): void {
  const results = element<HTMLDivElement>('results');
  renderCandidateCards(
    results,
    candidates,
    metadata?.mode === 'validated' ? metadata.id : null,
    {
      validate(candidate) {
        metadata = { mode: 'validated', id: candidate.id, mediaKind: candidate.mediaKind };
        element('validation-state').textContent = `Validato: ${candidate.title} · TMDB ${candidate.id}`;
        renderCandidates(); renderCreateState();
        void checkEmby({ mode: 'tmdb', tmdbId: candidate.id, mediaKind: candidate.mediaKind });
      },
      fallback(candidate) {
        metadata = {
          mode: 'fallback',
          title: candidate.title,
          year: candidate.year,
          mediaKind: candidate.mediaKind,
        };
        element('validation-state').textContent = `Fallback confermato manualmente: ${candidate.title} (${candidate.year}).`;
        renderCandidates(); renderCreateState();
        void checkEmby({
          mode: 'title',
          title: candidate.title,
          ...(candidate.year ? { year: Number(candidate.year) } : {}),
          mediaKind: candidate.mediaKind,
        });
      },
    },
    candidateRatings,
  );
}

async function enrichCandidateRatings(current: readonly TmdbCandidate[]): Promise<void> {
  const result = await ratingsResultGate.run(() => loadCandidateEnrichments(
    current,
    Boolean(settings?.mdblistConfigured),
    (lookupInput) => background('mdblist.lookup', { input: lookupInput }),
    (lookupInput) => background('justwatch.lookup', { input: lookupInput }),
    Boolean(settings?.omdbConfigured),
    (imdbId) => background('omdb.awards', { imdbId }),
  ));
  if (!result) return;
  candidateRatings = result;
  renderCandidates();
}

async function checkEmby(input: EmbyLookupInput): Promise<void> {
  embyResultGate.invalidate();
  if (!settings?.embyConfigured || !settings.embyBaseUrl) {
    embyPanel.setStatus({
      state: 'unavailable', message: 'Emby non configurato in config.local.json.',
    });
    return;
  }
  embyPanel.setStatus({ state: 'checking' });
  try {
    const result = await embyResultGate.run(async () => {
      const url = new URL(settings!.embyBaseUrl);
      const originPattern = `${url.protocol}//${url.hostname}/*`;
      const permission = chrome.permissions.request({ origins: [originPattern] });
      if (!await permission) throw new Error('Permesso di collegamento a Emby non concesso.');
      return background<EmbyPresenceResult>('emby.check', { input });
    });
    if (result) embyPanel.setStatus(result);
  } catch (reason) {
    embyPanel.setStatus({
      state: 'unavailable',
      message: reason instanceof Error ? reason.message : 'Controllo Emby non riuscito.',
    });
  }
}

function applyTmdbResult(result: { method: string; candidates: TmdbCandidate[] }): void {
  ratingsResultGate.invalidate();
  candidates = result.candidates;
  candidateRatings = new Map();
  metadata = null;
  renderCandidates();
  renderCreateState();
  element('search-status').textContent = candidates.length
    ? result.method === 'imdb'
      ? 'Corrispondenza tramite IMDb trovata · conferma manualmente il titolo.'
      : `${candidates.length} candidati trovati · valida manualmente.`
    : 'Nessun candidato trovato. Modifica titolo o anno e ripeti la ricerca.';
  void enrichCandidateRatings(candidates).catch(() => undefined);
}

function clearTmdbSelection(): void {
  embyResultGate.invalidate();
  ratingsResultGate.invalidate();
  metadata = null;
  candidates = [];
  candidateRatings = new Map();
  clearTmdbView({
    results: element('results'),
    validation: element('validation-state'),
  });
  embyPanel.setStatus({ state: 'idle' });
  renderCreateState();
}

function renderCatalog(): void {
  const preset = select('workflow-preset');
  const previous = preset.value;
  preset.replaceChildren(new Option('Seleziona un preset TaskFlow', ''));
  for (const item of catalog?.presets ?? []) preset.append(new Option(`${item.name} (${item.code})`, item.code));
  if ([...preset.options].some((option) => option.value === previous)) preset.value = previous;
  const selectedPreset = catalog?.presets.find((item) => item.code === preset.value);
  input('cleanup').checked = resolvePresetCleanup(preset.value, catalog?.presets ?? []);
  element('preset-summary').textContent = selectedPreset
    ? `Ereditato dal server: ${selectedPreset.tasks.join(' → ')}`
    : 'Seleziona un preset TaskFlow per usare Quick Workflow.';
  renderCreateState();
}

function syncPasswordField(): void {
  const resolution = resolveArchivePassword(selectedVariants(), manualPassword);
  input('rar-password').value = resolution.value;
  element('rar-password-state').textContent = resolution.conflict
    ? 'Le versioni selezionate hanno password diverse: inserisci manualmente quella da usare.'
    : resolution.source === 'detected'
      ? 'Password rilevata dalle versioni selezionate.'
      : resolution.source === 'manual'
        ? 'Password impostata manualmente.'
        : '';
  element('rar-password-state').classList.toggle('error-text', resolution.conflict);
}

function workflowPassword(): string {
  const resolution = resolveArchivePassword(selectedVariants(), manualPassword);
  if (resolution.conflict) throw new Error('Scegli manualmente la password RAR da usare.');
  return resolution.value;
}

function renderCreateState(): void {
  applyCreateModeView(createMode, {
    quickPanel: element('quick-panel'),
    taskflowPanel: element('taskflow-panel'),
    quickChoice: input('mode-quick'),
    taskflowChoice: input('mode-taskflow'),
  });
  const autodownload = input('autodownload').checked;
  const workflowNameValid = Boolean(normalizeWorkflowName(input('workflow-name').value));
  let passwordConflict = true;
  try {
    passwordConflict = resolveArchivePassword(selectedVariants(), manualPassword).conflict;
  } catch {
    passwordConflict = true;
  }
  const validity = resolvePhaseValidity({
    metadataValid: metadata !== null,
    variants: selectedVariants(),
    hosts: selectedHosts(),
    passwordConflict,
    taskflowConfigured: Boolean(settings?.taskflowConfigured),
    workflowNameValid,
    quickPresetRequired: createMode.selected === 'quick' && autodownload,
    quickPresetSelected: Boolean(select('workflow-preset').value),
  });
  applyPhaseValidity(validity, {
    phase1: element('phase-1'),
    phase2: element('phase-2'),
    phase3: element('phase-3'),
  });
  select('workflow-preset').disabled = createMode.locked || !autodownload;
  input('cleanup').disabled = createMode.locked || !autodownload;
  input('quick-workflow').disabled = createMode.locked || !snapshot || !validity.phase3;
  input('load-packages').disabled = createMode.locked || !snapshot || !validity.phase3;
}

async function readSnapshot(action = 'snapshot'): Promise<void> {
  tmdbResultGate.invalidate();
  status('Lettura della scheda e delle versioni…');
  const fresh = await page<PageSnapshot>(action);
  const previousIdentity = snapshot ? `${snapshot.siteId}:${snapshot.sourceUrl}` : '';
  snapshot = fresh;
  clearTmdbSelection();
  if (previousIdentity && previousIdentity !== `${fresh.siteId}:${fresh.sourceUrl}`) {
    selectedKeys = []; explicitlyAdjusted = false; manualPassword = null;
    createMode = initialCreateModeState();
    element('taskflow-create-slot').replaceChildren();
    element('taskflow-create-state').textContent = '';
  }
  element('source-name').textContent = fresh.siteName.toUpperCase();
  element('source').textContent = `${fresh.title}${fresh.year ? ` (${fresh.year})` : ''} · ${fresh.variants.length} versioni`;
  input('title').value = fresh.title; input('year').value = fresh.year; select('kind').value = fresh.mediaKind;
  if (!input('workflow-name').value) input('workflow-name').value = normalizeWorkflowName(`${fresh.title}_${fresh.year}`);
  element('thanks-hint').textContent = fresh.thanksHint ?? 'Le versioni già sbloccate vengono saltate.';
  renderVersions();
  status('Scheda aggiornata.');
  if (settings?.tmdbConfigured) element('search-status').textContent = 'Ricerca TMDB tramite IMDb in corso…';
  try {
    const result = await tmdbResultGate.run(() => autoSearchSnapshot(
      fresh,
      Boolean(settings?.tmdbConfigured),
      (input) => background('tmdb.search', { input }),
    ));
    if (result) applyTmdbResult(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Ricerca TMDB non riuscita.';
    element('search-status').textContent = `Ricerca automatica non riuscita: ${message}`;
  }
}

async function loadSettingsSummary(): Promise<void> {
  settings = await background<SettingsSummary>('settings.get');
  await logDirectorySettings.refresh();
  fillSettingsFields(settings, settingsFields());
  element('settings-state').textContent = `TaskFlow: ${settings.taskflowConfigured ? 'configurato' : 'token mancante'} · TMDB: ${settings.tmdbConfigured ? 'configurato' : 'token mancante'} · OMDb: ${settings.omdbConfigured ? 'configurato' : 'API key mancante'} · MDBList: ${settings.mdblistConfigured ? 'configurato' : 'API key mancante'} · Emby: ${settings.embyConfigured ? 'configurato' : 'config locale mancante'} · backend JD in produzione non verificato per commit.`;
  renderCreateState();
}

async function loadCatalog(): Promise<void> {
  if (settings?.taskflowConfigured) {
    try { catalog = await background<Catalog>('taskflow.catalog'); renderCatalog(); }
    catch (reason) { element('preset-summary').textContent = reason instanceof Error ? reason.message : 'Catalogo TaskFlow non disponibile.'; }
  }
}

async function taskFlowConfiguration(): Promise<TaskFlowUiConfiguration> {
  const auth = await background<{ token: string; baseUrl: string }>('settings.taskflowToken');
  return {
    apiUrl: auth.baseUrl,
    getAccessToken: async () => (await background<{ token: string }>('settings.taskflowToken')).token,
    theme: 'dark',
  };
}

async function initializeOverlayWidth(): Promise<void> {
  await initializeOverlayWidthControl(location.href, {
    container: element('overlay-width-control'),
    select: select('overlay-width'),
  }, () => page('overlay.status'));
}

element('refresh').addEventListener('click', () => void readSnapshot('refresh').catch((reason) => status(reason.message, true)));
select('profile').addEventListener('change', () => { explicitlyAdjusted = false; renderVersions(); });
input('limit').addEventListener('input', () => { explicitlyAdjusted = false; renderVersions(); });
for (const id of ['filestore', 'terabytez', 'workflow-name']) input(id).addEventListener('input', renderCreateState);
input('autodownload').addEventListener('change', renderCreateState);
select('workflow-preset').addEventListener('change', renderCatalog);
input('rar-password').addEventListener('input', () => {
  manualPassword = input('rar-password').value;
  syncPasswordField();
  renderCreateState();
});
for (const [id, mode] of [['mode-quick', 'quick'], ['mode-taskflow', 'taskflow']] as const) {
  input(id).addEventListener('change', () => {
    createMode = selectCreateMode(createMode, mode);
    renderCreateState();
  });
}
select('overlay-width').addEventListener('change', () => {
  void page<{ open: boolean; width: number }>('overlay.resize', {
    width: Number(select('overlay-width').value),
  }).then((result) => { select('overlay-width').value = String(result.width); })
    .catch((reason) => status(reason instanceof Error ? reason.message : 'Larghezza non aggiornata.', true));
});
for (const id of ['title', 'year', 'kind']) element<HTMLInputElement | HTMLSelectElement>(id)
  .addEventListener('input', () => {
    tmdbResultGate.invalidate();
    clearTmdbSelection();
  });

element<HTMLFormElement>('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    clearTmdbSelection();
    element('search-status').textContent = 'Ricerca TMDB in corso…';
    const result = await tmdbResultGate.run(() =>
      background<{ method: string; candidates: TmdbCandidate[] }>('tmdb.search', {
        input: { title: input('title').value, year: input('year').value, mediaKind: select('kind').value, imdbId: snapshot?.imdbId ?? '', mode: 'title' },
      }));
    if (result) applyTmdbResult(result);
  })().catch((reason) => { element('search-status').textContent = reason.message; status(reason.message, true); });
});
element('imdb-search').addEventListener('click', () => {
  void (async () => {
    clearTmdbSelection();
    element('search-status').textContent = 'Ricerca tramite IMDb, con fallback titolo…';
    const result = await tmdbResultGate.run(() =>
      background<{ method: string; candidates: TmdbCandidate[] }>('tmdb.search', {
        input: { title: input('title').value, year: input('year').value, mediaKind: select('kind').value, imdbId: snapshot?.imdbId ?? '', mode: 'auto' },
      }));
    if (result) applyTmdbResult(result);
  })().catch((reason) => status(reason.message, true));
});
element('thank-selected').addEventListener('click', () => {
  void (async () => {
    status('Ringraziamento e rilettura dei link…');
    const result = await page<{ context: PageSnapshot; thanks: { thanked: string[]; already: string[]; failed: Array<{ error: string }>; replacements?: Record<string, string[]> } }>('thank', { variantKeys: selectedKeys });
    snapshot = result.context;
    selectedKeys = applyThankReplacements(selectedKeys, result.thanks.replacements ?? {}, snapshot.variants.map((variant) => variant.key));
    explicitlyAdjusted = true; renderVersions();
    status(`Ringraziate: ${result.thanks.thanked.length} · già sbloccate: ${result.thanks.already.length} · errori: ${result.thanks.failed.length}`, Boolean(result.thanks.failed.length));
  })().catch((reason) => status(reason.message, true));
});

element<HTMLFormElement>('settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    const visibleSettings = readSettingsFields(settingsFields());
    const baseUrl = normalizeTaskFlowBaseUrl(visibleSettings.taskflowBaseUrl.trim());
    const url = new URL(baseUrl);
    const originPattern = `${url.protocol}//${url.hostname}/*`;
    if (!await chrome.permissions.contains({ origins: [originPattern] })) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) throw new Error('Permesso di collegamento a TaskFlow non concesso.');
    }
    const patch: Record<string, string> = { ...visibleSettings, taskflowBaseUrl: baseUrl };
    settings = await background<SettingsSummary>('settings.save', { settings: patch });
    await loadSettingsSummary();
    await loadCatalog();
    status('Collegamenti salvati soltanto nell’estensione.');
  })().catch((reason) => status(reason.message, true));
});
function reportSubmissionError(reason: Error & {
  analysis?: { failures?: Array<{ inputName: string; error?: string }> };
}): void {
  const detail = reason.analysis?.failures
    ?.map((failure) => `${failure.inputName}: ${failure.error ?? 'errore'}`).join('; ');
  status(`${reason.message}${detail ? ` ${detail}` : ''}`, true);
}

element('quick-workflow').addEventListener('click', () => {
  void (async () => {
    if (createMode.selected !== 'quick' || createMode.locked) return;
    const autodownload = input('autodownload').checked;
    if (autodownload && !metadata) throw new Error('Valida un candidato TMDB o conferma il fallback.');
    const variants = selectedVariants();
    const hosts = selectedHosts();
    const preset = autodownload
      ? requireQuickWorkflowPreset(select('workflow-preset').value)
      : select('workflow-preset').value;
    const workflow = autodownload ? {
      workflowName: requireWorkflowName(input('workflow-name').value),
      metadata: metadata!,
      password: workflowPassword(),
      cleanupOnSuccess: input('cleanup').checked,
      preset,
    } : undefined;
    createMode = lockCreateMode(createMode);
    renderCreateState();
    status(autodownload
      ? 'Quick Workflow: Submission → Create → Start in corso. Non ripetere l’invio.'
      : 'Submission al LinkGrabber in corso. Non ripetere l’invio.');
    const result = await background<{
      submissionOnly: boolean;
      submission: { outcomes: unknown[] };
      createdWorkflow: { id: string } | null;
      startedWorkflow: { status?: string } | null;
      startError: { message?: string } | null;
    }>('taskflow.quickWorkflow', {
      variants, hosts, autodownload,
      ...(workflow ? { workflow } : {}),
    });
    if (result.submissionOnly) {
      status(`Submission completata: ${result.submission.outcomes.length} pacchetti lasciati nel LinkGrabber.`);
      return;
    }
    if (!result.createdWorkflow) throw new Error('TaskFlow non ha restituito il workflow creato.');
    if (result.startError) {
      status(`Workflow ${result.createdWorkflow.id} creato, ma Start non riuscito: ${result.startError.message ?? 'errore'}. Aprilo nella WebUI e riprova soltanto Start, senza reinviare i package.`, true);
    } else {
      status(`Workflow ${result.createdWorkflow.id} creato e avviato · stato ${result.startedWorkflow?.status ?? 'accettato'}.`);
    }
  })().catch((reason) => reportSubmissionError(reason));
});

element('load-packages').addEventListener('click', () => {
  void (async () => {
    if (createMode.selected !== 'taskflow' || createMode.locked) return;
    if (!metadata) throw new Error('Valida un candidato TMDB o conferma il fallback.');
    const variants = selectedVariants();
    const hosts = selectedHosts();
    const workflowName = requireWorkflowName(input('workflow-name').value);
    const password = workflowPassword();
    createMode = lockCreateMode(createMode);
    renderCreateState();
    status('Caricamento package su JD in corso. Non ripetere l’invio.');
    const submission = await background<{
      taskflowIds: string[];
      outcomes: unknown[];
    }>('taskflow.loadPackages', {
      variants, hosts,
    });
    await customElements.whenDefined('taskflow-ui');
    const ui = document.createElement('taskflow-ui') as unknown as TaskFlowCreateRuntime & HTMLElement;
    element('taskflow-create-slot').replaceChildren(ui);
    const tmdb: TaskFlowCreateSeed['tmdb'] = metadata.mode === 'validated'
      ? { tmdb_id: metadata.id }
      : { title: metadata.title, year: Number(metadata.year) };
    await openTaskFlowCreate(ui, {
      packageIds: submission.taskflowIds,
      workflowName,
      mediaKind: metadata.mediaKind,
      tmdb,
      password,
    }, await taskFlowConfiguration());
    element('taskflow-create-state').textContent = `${submission.outcomes.length} package caricati su JD. Completa il workflow nella WebUI.`;
    status('Package caricati su JD. La WebUI Create è pronta.');
  })().catch((reason) => reportSubmissionError(reason));
});

void (async () => {
  await runSidebarStartup({
    loadSettings: loadSettingsSummary,
    initializeOverlayWidth,
    loadCatalog,
    readSnapshot,
  });
})().catch((reason) => status(reason instanceof Error ? reason.message : 'Avvio JSpider non riuscito.', true));

