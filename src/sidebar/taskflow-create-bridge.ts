export interface TaskFlowCreateSeed {
  packageIds: string[];
  workflowName: string;
  mediaKind: 'movie' | 'tv';
  tmdb: { tmdb_id: number } | { title: string; year: number };
  password: string;
}

export interface TaskFlowUiConfiguration {
  apiUrl?: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  theme?: 'light' | 'dark' | 'system';
}

export interface TaskFlowCreateRuntime {
  view: string;
  createState: {
    packageIds: string[];
    taskNames: string[];
    taskJson: string;
    workflowName: string;
    cleanupOnSuccess: boolean;
    [key: string]: unknown;
  };
  store: { selectablePackages: Array<{ id: string }> } | null;
  configure(config: TaskFlowUiConfiguration): void;
  changePreset(presetCode: string): void;
  requestUpdate(): unknown;
}

type CatalogWait = (
  ui: TaskFlowCreateRuntime,
  packageIds: readonly string[],
) => Promise<void>;

const bridgedPresetChanges = new WeakSet<object>();
const commonTaskDataKeys = ['media_kind', 'tmdb', 'unrar'] as const;

export function buildTaskFlowSeedData(seed: TaskFlowCreateSeed): Record<string, unknown> {
  return {
    media_kind: seed.mediaKind,
    tmdb: seed.tmdb,
    ...(seed.password ? { unrar: { password: seed.password } } : {}),
  };
}

function selectablePackageIds(ui: TaskFlowCreateRuntime): Set<string> | null {
  if (!ui.store) return null;
  if (!Array.isArray(ui.store.selectablePackages)) {
    throw new Error('WebUI TaskFlow incompatibile: manca il catalogo dei package selezionabili.');
  }
  return new Set(ui.store.selectablePackages.map(({ id }) => id));
}

function hasPackages(ui: TaskFlowCreateRuntime, packageIds: readonly string[]): boolean {
  const available = selectablePackageIds(ui);
  if (!available) return false;
  return packageIds.every((id) => available.has(id));
}

function parseTaskData(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function preserveCommonDataAcrossPresetChanges(ui: TaskFlowCreateRuntime): void {
  if (bridgedPresetChanges.has(ui)) return;
  if (typeof ui.changePreset !== 'function') {
    throw new Error('WebUI TaskFlow incompatibile: manca il selettore preset richiesto.');
  }
  const original = ui.changePreset;
  ui.changePreset = (presetCode: string) => {
    const before = parseTaskData(ui.createState.taskJson);
    const common = Object.fromEntries(commonTaskDataKeys.flatMap((key) => (
      before && Object.hasOwn(before, key) ? [[key, before[key]]] : []
    )));
    original.call(ui, presetCode);
    const after = parseTaskData(ui.createState.taskJson) ?? {};
    ui.createState.taskJson = JSON.stringify({ ...after, ...common }, null, 2);
    ui.requestUpdate();
  };
  bridgedPresetChanges.add(ui);
}

async function waitForCatalog(
  ui: TaskFlowCreateRuntime,
  packageIds: readonly string[],
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!hasPackages(ui, packageIds) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}

export async function openTaskFlowCreate(
  ui: TaskFlowCreateRuntime,
  seed: TaskFlowCreateSeed,
  configuration: TaskFlowUiConfiguration,
  wait: CatalogWait = waitForCatalog,
): Promise<void> {
  ui.view = 'create';
  ui.configure(configuration);
  await wait(ui, seed.packageIds);
  if (!hasPackages(ui, seed.packageIds)) {
    const available = selectablePackageIds(ui) ?? new Set<string>();
    const missing = seed.packageIds.filter((id) => !available.has(id));
    throw new Error(`La WebUI non trova i package caricati: ${missing.join(', ')}.`);
  }
  preserveCommonDataAcrossPresetChanges(ui);
  ui.createState = {
    ...ui.createState,
    packageIds: [...seed.packageIds],
    workflowName: seed.workflowName,
    taskJson: JSON.stringify(buildTaskFlowSeedData(seed), null, 2),
  };
  ui.requestUpdate();
}

