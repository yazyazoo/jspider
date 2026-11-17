import { describe, expect, it } from 'vitest';
import type { TechnicalInfo } from '../../src/domain/models';
import { formatTechnicalSummary } from '../../src/sidebar/technical-summary';

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
  it('shows both the complete file size and video-track size', () => {
    expect(formatTechnicalSummary(technical())).toBe(
      '1080p · H264 · Video 32 Mb/s · Totale 37 Mb/s · File 10 GiB · Traccia video 8,5 GiB',
    );
  });

  it('keeps both size labels visible when the report does not provide them', () => {
    expect(formatTechnicalSummary(technical({ totalBytes: null, videoBytes: null }))).toContain(
      'File — · Traccia video —',
    );
  });
});
