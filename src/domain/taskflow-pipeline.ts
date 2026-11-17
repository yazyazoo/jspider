import type { ArchiveHost } from './archive-links';
import {
  analyzeSubmissionResults,
  buildSubmissionBatch,
  composeQuickWorkflowPayload,
  type QuickWorkflowPayloadInput,
  type SubmissionAnalysis,
  type SubmissionRequest,
  type SubmissionVariant,
} from './taskflow-contract';

export interface WorkflowRecord extends Record<string, unknown> {
  id: string;
}

export interface TaskFlowPipelineApi {
  submitPackages(integrationId: string, request: SubmissionRequest): Promise<unknown>;
  createWorkflow(payload: Record<string, unknown>): Promise<WorkflowRecord>;
  startWorkflow(workflowId: string): Promise<WorkflowRecord>;
}

interface SubmissionInput {
  api: TaskFlowPipelineApi;
  integrationId: string;
  variants: readonly SubmissionVariant[];
  hosts: readonly ArchiveHost[];
  onLogEvent?: QuickWorkflowLogListener;
}

export type QuickWorkflowLogPhase = 'submission' | 'create' | 'start';
export type QuickWorkflowLogKind = 'request' | 'response' | 'error';

export interface QuickWorkflowLogEvent {
  phase: QuickWorkflowLogPhase;
  kind: QuickWorkflowLogKind;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export type QuickWorkflowLogListener = (
  event: QuickWorkflowLogEvent,
) => void | Promise<void>;

export interface QuickWorkflowInput extends SubmissionInput {
  autodownload: boolean;
  workflow?: Omit<QuickWorkflowPayloadInput, 'packageIds'>;
}

export interface QuickWorkflowResult {
  submission: SubmissionAnalysis;
  submissionOnly: boolean;
  createdWorkflow: WorkflowRecord | null;
  startedWorkflow: WorkflowRecord | null;
  startError: Error | null;
}

export class SubmissionBatchError extends Error {
  readonly analysis: SubmissionAnalysis;

  constructor(analysis: SubmissionAnalysis) {
    super('TaskFlow ha rifiutato una o più versioni; il workflow non è stato creato.');
    this.name = 'SubmissionBatchError';
    this.analysis = analysis;
  }
}

async function emitLog(
  listener: QuickWorkflowLogListener | undefined,
  event: QuickWorkflowLogEvent,
): Promise<void> {
  try { await listener?.(event); }
  catch { /* Diagnostics must never interrupt Quick Workflow. */ }
}

function errorPayload(reason: unknown): Record<string, unknown> {
  if (!(reason instanceof Error)) return { name: 'Error', message: String(reason) };
  const payload: Record<string, unknown> = { name: reason.name, message: reason.message };
  const record = reason as unknown as Record<string, unknown>;
  for (const key of ['status', 'code', 'analysis', 'details', 'response']) {
    if (record[key] !== undefined) payload[key] = record[key];
  }
  return payload;
}

export async function submitPackageBatch(
  input: SubmissionInput,
  autodownload: boolean,
): Promise<SubmissionAnalysis> {
  try {
    if (!input.integrationId.trim()) throw new Error('Seleziona un’integrazione JDownloader TaskFlow.');
    const request = buildSubmissionBatch(input.variants, input.hosts, autodownload);
    await emitLog(input.onLogEvent, { phase: 'submission', kind: 'request', payload: request });
    const rawResults = await input.api.submitPackages(input.integrationId, request);
    await emitLog(input.onLogEvent, { phase: 'submission', kind: 'response', payload: rawResults });
    const submission = analyzeSubmissionResults(request.packages, rawResults, autodownload);
    if (submission.failures.length) throw new SubmissionBatchError(submission);
    return submission;
  } catch (reason) {
    await emitLog(input.onLogEvent, {
      phase: 'submission', kind: 'error', payload: errorPayload(reason),
    });
    throw reason;
  }
}

export function loadTaskFlowPackages(input: SubmissionInput): Promise<SubmissionAnalysis> {
  return submitPackageBatch(input, true);
}

export async function runQuickWorkflow(
  input: QuickWorkflowInput,
): Promise<QuickWorkflowResult> {
  const submission = await submitPackageBatch(input, input.autodownload);
  if (!input.autodownload) {
    return {
      submission,
      submissionOnly: true,
      createdWorkflow: null,
      startedWorkflow: null,
      startError: null,
    };
  }
  let createdWorkflow!: WorkflowRecord;
  try {
    if (!input.workflow) throw new Error('Configura Quick Workflow quando Autodownload è attivo.');
    const payload = composeQuickWorkflowPayload({
      ...input.workflow,
      packageIds: submission.taskflowIds,
    });
    await emitLog(input.onLogEvent, { phase: 'create', kind: 'request', payload });
    createdWorkflow = await input.api.createWorkflow(payload);
    await emitLog(input.onLogEvent, { phase: 'create', kind: 'response', payload: createdWorkflow });
    if (!createdWorkflow.id) throw Object.assign(
      new Error('TaskFlow ha creato un workflow senza ID valido.'),
      { response: createdWorkflow },
    );
  } catch (reason) {
    await emitLog(input.onLogEvent, { phase: 'create', kind: 'error', payload: errorPayload(reason) });
    throw reason;
  }
  await emitLog(input.onLogEvent, {
    phase: 'start', kind: 'request', payload: null,
    metadata: { workflowId: createdWorkflow.id },
  });
  try {
    const startedWorkflow = await input.api.startWorkflow(createdWorkflow.id);
    await emitLog(input.onLogEvent, { phase: 'start', kind: 'response', payload: startedWorkflow });
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow, startError: null };
  } catch (reason) {
    const startError = reason instanceof Error ? reason : new Error('Impossibile avviare il workflow.');
    await emitLog(input.onLogEvent, { phase: 'start', kind: 'error', payload: errorPayload(startError) });
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow: null, startError };
  }
}
