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
}

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

export async function submitPackageBatch(
  input: SubmissionInput,
  autodownload: boolean,
): Promise<SubmissionAnalysis> {
  if (!input.integrationId.trim()) throw new Error('Seleziona un’integrazione JDownloader TaskFlow.');
  const request = buildSubmissionBatch(input.variants, input.hosts, autodownload);
  const rawResults = await input.api.submitPackages(input.integrationId, request);
  const submission = analyzeSubmissionResults(request.packages, rawResults, autodownload);
  if (submission.failures.length) throw new SubmissionBatchError(submission);
  return submission;
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
  if (!input.workflow) throw new Error('Configura Quick Workflow quando Autodownload è attivo.');
  const payload = composeQuickWorkflowPayload({
    ...input.workflow,
    packageIds: submission.taskflowIds,
  });
  const createdWorkflow = await input.api.createWorkflow(payload);
  if (!createdWorkflow.id) throw new Error('TaskFlow ha creato un workflow senza ID valido.');
  try {
    const startedWorkflow = await input.api.startWorkflow(createdWorkflow.id);
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow, startError: null };
  } catch (reason) {
    const startError = reason instanceof Error ? reason : new Error('Impossibile avviare il workflow.');
    return { submission, submissionOnly: false, createdWorkflow, startedWorkflow: null, startError };
  }
}
