// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderEmbyStatus } from '../../src/sidebar/emby-status';

describe('Emby status panel', () => {
  it('renders present filenames in a column with a red led and final label', () => {
    const container = document.createElement('div');
    renderEmbyStatus(container, {
      state: 'present',
      files: ['Colony.2026.2160p.REMUX', 'Colony.2026.1080p.WEB-DL'],
    });
    const rows = [...container.querySelectorAll('.emby-file-row')];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelector('.emby-file-name')?.textContent))
      .toEqual(['Colony.2026.2160p.REMUX', 'Colony.2026.1080p.WEB-DL']);
    expect(rows.every((row) => row.querySelector('.emby-led')?.classList.contains('present'))).toBe(true);
    expect(container.querySelector('.emby-result-label')?.textContent).toBe('Presente');
  });

  it('renders absence with a green led and no invented filename', () => {
    const container = document.createElement('div');
    renderEmbyStatus(container, { state: 'absent', files: [] });
    expect(container.querySelector('.emby-led')?.classList.contains('absent')).toBe(true);
    expect(container.querySelector('.emby-file-name')).toBeNull();
    expect(container.querySelector('.emby-result-label')?.textContent).toBe('Assente');
  });

  it('keeps failures distinct from absence', () => {
    const container = document.createElement('div');
    renderEmbyStatus(container, { state: 'unavailable', message: 'Timeout Emby' });
    expect(container.querySelector('.emby-led')?.classList.contains('unavailable')).toBe(true);
    expect(container.textContent).toContain('Non verificabile');
    expect(container.textContent).not.toContain('Assente');
  });
});
