import { selectArchiveLinks, type ArchiveHost } from '../domain/archive-links';

export interface PhaseValidityInput {
  metadataValid: boolean;
  variants: readonly { links: readonly string[] }[];
  hosts: readonly ArchiveHost[];
  passwordConflict: boolean;
  taskflowConfigured: boolean;
  workflowNameValid: boolean;
  quickPresetRequired: boolean;
  quickPresetSelected: boolean;
}

export interface PhaseValidity {
  phase1: boolean;
  phase2: boolean;
  phase3: boolean;
}

export function resolvePhaseValidity(input: PhaseValidityInput): PhaseValidity {
  const phase1 = input.metadataValid;
  const phase2 = input.variants.length > 0
    && input.variants.every((variant) => selectArchiveLinks(variant.links, input.hosts).length > 0)
    && !input.passwordConflict;
  const phase3 = phase1
    && phase2
    && input.taskflowConfigured
    && input.workflowNameValid
    && (!input.quickPresetRequired || input.quickPresetSelected);
  return { phase1, phase2, phase3 };
}

export function applyPhaseValidity(
  validity: PhaseValidity,
  sections: Record<keyof PhaseValidity, HTMLElement>,
): void {
  for (const key of ['phase1', 'phase2', 'phase3'] as const) {
    sections[key].classList.toggle('validated-phase', validity[key]);
  }
}
