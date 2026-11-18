// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { EmbyPresenceResult } from '../../src/domain/emby';
import { EmbyPanelController, renderEmbyStatus } from '../../src/sidebar/emby-status';

const seriesResult = (): EmbyPresenceResult => ({
  state: 'present',
  files: ['Show.S03E01.2160p'],
  series: {
    seriesId: 'series-1',
    seasons: [
      { id: 'season-1', number: 1, name: 'Season 1' },
      { id: 'season-2', number: 2, name: 'Season 2' },
      { id: 'season-3', number: 3, name: 'Season 3' },
    ],
    selectedSeasonId: 'season-3',
  },
});

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

  it('renders compact season buttons and selects a season through the callback', () => {
    const container = document.createElement('div');
    let selected = '';
    renderEmbyStatus(container, seriesResult(), {
      onSeasonSelect(seasonId) { selected = seasonId; },
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.emby-season-button')];
    expect(buttons.map((button) => button.textContent)).toEqual(['S01', 'S02', 'S03']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed')))
      .toEqual(['false', 'false', 'true']);
    buttons[0]!.click();
    expect(selected).toBe('season-1');
    expect(container.textContent).toContain('Show.S03E01.2160p');
    expect(container.querySelector('.emby-resolution')).toBeNull();
  });

  it('states explicitly when episode one is absent from the selected season', () => {
    const container = document.createElement('div');
    const status = seriesResult();
    status.files = [];
    renderEmbyStatus(container, status);

    expect(container.textContent).toContain('Episodio 1 non presente.');
    expect(container.querySelector('.emby-led.absent')).not.toBeNull();
  });
});

describe('Emby season selection controller', () => {
  it('ignores an older season response and renders the latest selection', async () => {
    const container = document.createElement('div');
    let finishFirst!: (value: { seasonId: string; files: string[] }) => void;
    let finishSecond!: (value: { seasonId: string; files: string[] }) => void;
    const controller = new EmbyPanelController(container, (_seriesId, seasonId) =>
      new Promise((resolve) => {
        if (seasonId === 'season-1') finishFirst = resolve;
        else finishSecond = resolve;
      }));
    controller.setStatus(seriesResult());

    const first = controller.selectSeason('season-1');
    const second = controller.selectSeason('season-2');
    finishSecond({ seasonId: 'season-2', files: ['Show.S02E01.1080p'] });
    await second;
    finishFirst({ seasonId: 'season-1', files: ['Show.S01E01.720p'] });
    await first;

    expect(container.textContent).toContain('Show.S02E01.1080p');
    expect(container.textContent).not.toContain('Show.S01E01.720p');
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe('S02');
  });

  it('caches loaded seasons for the current validated series', async () => {
    const container = document.createElement('div');
    let requests = 0;
    const controller = new EmbyPanelController(container, async (_seriesId, seasonId) => {
      requests += 1;
      return { seasonId, files: [`Show.${seasonId}.E01.1080p`] };
    });
    controller.setStatus(seriesResult());

    await controller.selectSeason('season-1');
    await controller.selectSeason('season-3');
    await controller.selectSeason('season-1');

    expect(requests).toBe(1);
    expect(container.textContent).toContain('Show.season-1.E01.1080p');
  });

  it('shows a season error without replacing the Emby presence state', async () => {
    const container = document.createElement('div');
    const controller = new EmbyPanelController(container, async () => {
      throw new Error('Timeout Emby');
    });
    controller.setStatus(seriesResult());

    await controller.selectSeason('season-1');

    expect(container.textContent).toContain('Timeout Emby');
    expect(container.querySelector('.emby-result-label')?.textContent).toBe('Presente');
  });
});
