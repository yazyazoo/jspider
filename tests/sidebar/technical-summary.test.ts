import { describe, expect, it } from 'vitest';
import type { TechnicalInfo } from '../../src/domain/models';
// @vitest-environment jsdom
import {
  formatTechnicalSummary,
  renderResolutionAmbiguity,
  renderTechnicalSummary,
} from '../../src/sidebar/technical-summary';

function technical(overrides: Partial<TechnicalInfo> = {}): TechnicalInfo {
  return {
    codec: 'H264', bitDepth: 8, resolution: 1080,
    videoBitrate: 32_000_000, overallBitrate: 37_000_000,
    videoBytes: 8.5 * 1024 ** 3, totalBytes: 10 * 1024 ** 3,
    duration: 6000, width: 1920, height: 1080, fps: 24,
    hdr: '', category: 'untouched', sourceFamily: '', provider: '',
    bitrateEstimated: false,
    ...overrides,
  };
}

describe('version technical summary', () => {
  it('shows metadata, complete file and video track on three distinct lines', () => {
    expect(formatTechnicalSummary(technical())).toBe(
      '1080p · H264 · Durata 1 h 40 min ·\nTotale File: 37 Mb/s · File 10 GiB\nTraccia Video: 32 Mb/s · Traccia video 8,5 GiB',
    );
  });

  it('keeps both size labels visible when the report does not provide them', () => {
    const [, fileLine, videoLine] = formatTechnicalSummary(
      technical({ totalBytes: null, videoBytes: null }),
    ).split('\n');
    expect(fileLine).toContain('File —');
    expect(videoLine).toContain('Traccia video —');
  });

  it('renders the complete technical summary in bold', () => {
    const node = renderTechnicalSummary(document, technical());

    expect(node.tagName).toBe('P');
    expect(node.classList.contains('version-technical')).toBe(true);
    expect(node.querySelectorAll('strong')).toHaveLength(3);
    expect([...node.querySelectorAll('strong')].map((line) => line.textContent)).toEqual([
      '1080p · H264 · Durata 1 h 40 min ·',
      'Totale File: 37 Mb/s · File 10 GiB',
      'Traccia Video: 32 Mb/s · Traccia video 8,5 GiB',
    ]);
    expect(node.textContent).toBe(formatTechnicalSummary(technical()));
  });

  it('renders a non-blocking warning when the article label conflicts with MediaInfo', () => {
    const warning = renderResolutionAmbiguity(
      document,
      'Wallace e Gromit (2024) WebDL 720p',
      technical({ resolution: 1080, width: 1920, height: 1080 }),
    );

    expect(warning?.classList.contains('version-ambiguity')).toBe(true);
    expect(warning?.textContent).toBe('1080p da MediaInfo · articolo etichettato 720p.');
    expect(renderResolutionAmbiguity(
      document,
      'Wallace e Gromit (2024) WebDL 1080p',
      technical({ resolution: 1080 }),
    )).toBeNull();
  });
});
