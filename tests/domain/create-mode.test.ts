import { describe, expect, it } from 'vitest';
import {
  initialCreateModeState,
  lockCreateMode,
  resolveArchivePassword,
  selectCreateMode,
} from '../../src/domain/create-mode';

const variants = [
  { password: 'detected' },
  { password: 'detected' },
];

describe('exclusive create mode', () => {
  it('starts in Quick Workflow and allows exactly one selected mode', () => {
    const initial = initialCreateModeState();
    expect(initial).toEqual({ selected: 'quick', locked: false });
    expect(selectCreateMode(initial, 'taskflow')).toEqual({ selected: 'taskflow', locked: false });
  });

  it('does not switch mode after a submission has locked the batch', () => {
    const locked = lockCreateMode(selectCreateMode(initialCreateModeState(), 'taskflow'));
    expect(selectCreateMode(locked, 'quick')).toEqual({ selected: 'taskflow', locked: true });
  });
});

describe('RAR password resolution', () => {
  it('prefills one password shared by all selected versions', () => {
    expect(resolveArchivePassword(variants, null)).toEqual({
      value: 'detected', source: 'detected', conflict: false,
    });
  });

  it('keeps an explicit manual value when detected versions change', () => {
    expect(resolveArchivePassword([{ password: 'new' }], 'manual')).toEqual({
      value: 'manual', source: 'manual', conflict: false,
    });
  });

  it('requires a manual choice when selected versions disagree', () => {
    expect(resolveArchivePassword([{ password: 'first' }, { password: 'second' }], null))
      .toEqual({ value: '', source: 'conflict', conflict: true });
  });

  it('rejects control characters in detected and manual passwords', () => {
    expect(() => resolveArchivePassword([{ password: 'bad\nvalue' }], null)).toThrow('non supportati');
    expect(() => resolveArchivePassword([], 'bad\0value')).toThrow('non supportati');
  });
});

