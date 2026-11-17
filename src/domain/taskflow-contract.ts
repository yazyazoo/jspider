import { type ArchiveHost, selectArchiveLinks } from './archive-links';

export interface SubmissionVariant {
  key: string;
  packageName: string;
  password: string;
  links: readonly string[];
}

export interface SubmissionPackage {
  name: string;
  links: string[];
}

export interface SubmissionRequest {
  autodownload: boolean;
  packages: SubmissionPackage[];
}

export type SubmissionResult = {
  name: string;
  jd_id: string;
  taskflow_id: string | null;
} | {
  name: string | null;
  error: string;
};

export interface SubmissionOutcome {
  index: number;
  inputName: string;
  actualName: string | null;
  taskflowId?: string;
  error?: string;
}

export interface SubmissionAnalysis {
  outcomes: SubmissionOutcome[];
  taskflowIds: string[];
  failures: SubmissionOutcome[];
}

export type WorkflowMetadata = {
  mode: 'validated';
  id: number;
  mediaKind: 'movie' | 'tv';
} | {
  mode: 'fallback';
  title: string;
  year: string;
  mediaKind: 'movie' | 'tv';
};

export interface QuickWorkflowPayloadInput {
  workflowName: string;
  packageIds: readonly string[];
  preset: string;
  metadata: WorkflowMetadata;
  password: string;
  cleanupOnSuccess: boolean;
}

export function requireQuickWorkflowPreset(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error('Seleziona un preset TaskFlow valido.');
  }
  return value;
}

export function normalizeWorkflowName(value: string): string {
  const ascii = value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  return ascii.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/[_-]+/g, (separators) => separators.includes('-') ? '-' : '_')
    .replace(/^[_-]+|[_-]+$/g, '');
}

export function requireWorkflowName(value: string): string {
  const workflowName = normalizeWorkflowName(value);
  if (!workflowName) throw new Error('Inserisci un nome workflow con lettere o numeri ASCII.');
  return workflowName;
}

export function buildSubmissionBatch(
  variants: readonly SubmissionVariant[],
  hosts: readonly ArchiveHost[],
  autodownload = true,
): SubmissionRequest {
  if (!variants.length) throw new Error('Seleziona almeno una versione.');
  const packages = variants.map((variant) => {
    const name = variant.packageName.trim();
    const links = selectArchiveLinks(variant.links, hosts);
    if (!name) throw new Error(`La versione ${variant.key} non ha un nome pacchetto valido.`);
    if (!links.length) {
      throw new Error(`Nessun link disponibile per ${name} sugli host selezionati.`);
    }
    return { name, links };
  });
  return { autodownload, packages };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function analyzeSubmissionResults(
  inputs: readonly SubmissionPackage[],
  rawResults: unknown,
  requireTaskflowId = true,
): SubmissionAnalysis {
  if (!Array.isArray(rawResults) || rawResults.length !== inputs.length) {
    throw new Error('La lunghezza della risposta TaskFlow non corrisponde alla richiesta ordinata.');
  }
  const outcomes = rawResults.map((raw, index): SubmissionOutcome => {
    const input = inputs[index];
    if (!input || !isRecord(raw)) {
      throw new Error(`Risultato TaskFlow non valido in posizione ${index + 1}.`);
    }
    const actualName = typeof raw.name === 'string' ? raw.name : null;
    if (typeof raw.error === 'string' && raw.error.trim()) {
      return { index, inputName: input.name, actualName, error: raw.error };
    }
    const taskflowIdValid = raw.taskflow_id === null
      || (typeof raw.taskflow_id === 'string' && Boolean(raw.taskflow_id));
    if (typeof raw.jd_id !== 'string' || !raw.jd_id
      || !taskflowIdValid
      || (requireTaskflowId && raw.taskflow_id === null)) {
      return {
        index, inputName: input.name, actualName,
        error: 'TaskFlow non ha restituito un ID pacchetto persistito.',
      };
    }
    return {
      index,
      inputName: input.name,
      actualName,
      ...(typeof raw.taskflow_id === 'string' && raw.taskflow_id
        ? { taskflowId: raw.taskflow_id } : {}),
    };
  });
  const taskflowIds = [...new Set(outcomes.flatMap((outcome) => outcome.taskflowId ?? []))];
  const failures = outcomes.filter((outcome) => outcome.error !== undefined);
  return { outcomes, taskflowIds, failures };
}

export function composeQuickWorkflowPayload(
  input: QuickWorkflowPayloadInput,
): Record<string, unknown> {
  const workflowName = requireWorkflowName(input.workflowName);
  const preset = requireQuickWorkflowPreset(input.preset);
  const packages = [...new Set(input.packageIds)];
  if (!packages.length || packages.some((id) => typeof id !== 'string' || !id
    || id.trim() !== id || /[\u0000-\u001f\u007f]/.test(id))) {
    throw new Error('Gli ID pacchetto TaskFlow devono essere stringhe opache non vuote e senza caratteri di controllo.');
  }
  if (typeof input.cleanupOnSuccess !== 'boolean') {
    throw new Error('Il valore Cleanup deve essere booleano.');
  }
  const tmdb = input.metadata.mode === 'validated'
    ? (() => {
      if (!Number.isSafeInteger(input.metadata.id) || input.metadata.id <= 0) {
        throw new Error('Il candidato TMDB validato non è valido.');
      }
      return { tmdb_id: input.metadata.id };
    })()
    : (() => {
      const title = input.metadata.title.trim();
      if (!title || !/^\d{4}$/.test(input.metadata.year)) {
        throw new Error('Il fallback TMDB richiede titolo e anno valido.');
      }
      return { title, year: Number(input.metadata.year) };
    })();
  return {
    workflow_name: workflowName,
    packages,
    preset,
    media_kind: input.metadata.mediaKind,
    cleanup_on_success: input.cleanupOnSuccess,
    tmdb,
    ...(input.password ? { unrar: { password: input.password } } : {}),
  };
}

