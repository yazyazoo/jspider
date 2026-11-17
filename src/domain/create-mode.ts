export type CreateMode = 'quick' | 'taskflow';

export interface CreateModeState {
  selected: CreateMode;
  locked: boolean;
}

export type PasswordResolution = {
  value: string;
  source: 'detected' | 'manual' | 'empty' | 'conflict';
  conflict: boolean;
};

export function initialCreateModeState(): CreateModeState {
  return { selected: 'quick', locked: false };
}

export function selectCreateMode(state: CreateModeState, selected: CreateMode): CreateModeState {
  return state.locked ? state : { selected, locked: false };
}

export function lockCreateMode(state: CreateModeState): CreateModeState {
  return { ...state, locked: true };
}

function validatePassword(value: string): void {
  if (/[\r\n\0]/.test(value)) {
    throw new Error('La password RAR contiene caratteri non supportati.');
  }
}

export function resolveArchivePassword(
  variants: readonly Pick<{ password: string }, 'password'>[],
  manualValue: string | null,
): PasswordResolution {
  if (manualValue !== null) {
    validatePassword(manualValue);
    return {
      value: manualValue,
      source: manualValue ? 'manual' : 'empty',
      conflict: false,
    };
  }
  const passwords = [...new Set(variants.map(({ password }) => password).filter(Boolean))];
  for (const password of passwords) validatePassword(password);
  if (passwords.length > 1) return { value: '', source: 'conflict', conflict: true };
  if (passwords.length === 1) return { value: passwords[0]!, source: 'detected', conflict: false };
  return { value: '', source: 'empty', conflict: false };
}

