// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyPhaseValidity,
  resolvePhaseValidity,
  type PhaseValidityInput,
} from '../../src/sidebar/phase-validation';

const valid: PhaseValidityInput = {
  metadataValid: true,
  variants: [{ links: ['https://terabytez.org/a/film.part01.rar'] }],
  hosts: ['terabytez.org'],
  passwordConflict: false,
  taskflowConfigured: true,
  workflowNameValid: true,
  quickPresetRequired: true,
  quickPresetSelected: true,
};

describe('phase validity', () => {
  it('marks all phases valid only when metadata, selected links and create data are ready', () => {
    expect(resolvePhaseValidity(valid)).toEqual({ phase1: true, phase2: true, phase3: true });
  });

  it('rejects phase 2 for unavailable selected-host links or a password conflict', () => {
    expect(resolvePhaseValidity({ ...valid, hosts: ['filestore.me'] }))
      .toEqual({ phase1: true, phase2: false, phase3: false });
    expect(resolvePhaseValidity({ ...valid, passwordConflict: true }))
      .toEqual({ phase1: true, phase2: false, phase3: false });
  });

  it('requires selected-host links for every selected version', () => {
    expect(resolvePhaseValidity({
      ...valid,
      variants: [
        { links: ['https://terabytez.org/a/film.part01.rar'] },
        { links: ['https://filestore.me/123456789abc'] },
      ],
    })).toEqual({ phase1: true, phase2: false, phase3: false });
  });

  it('blocks Quick Workflow Create until a preset is selected', () => {
    expect(resolvePhaseValidity({ ...valid, quickPresetSelected: false }).phase3).toBe(false);
  });

  it('does not require a Quick preset outside the Create path', () => {
    expect(resolvePhaseValidity({
      ...valid, quickPresetRequired: false, quickPresetSelected: false,
    }).phase3).toBe(true);
  });

  it('toggles the rounded validation class independently on all three sections', () => {
    const phase1 = document.createElement('section');
    const phase2 = document.createElement('section');
    const phase3 = document.createElement('section');
    applyPhaseValidity(
      { phase1: true, phase2: false, phase3: true },
      { phase1, phase2, phase3 },
    );
    expect([
      phase1.classList.contains('validated-phase'),
      phase2.classList.contains('validated-phase'),
      phase3.classList.contains('validated-phase'),
    ]).toEqual([true, false, true]);
  });
});
