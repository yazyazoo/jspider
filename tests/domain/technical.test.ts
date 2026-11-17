import { describe, expect, it } from 'vitest';
import { parseTechnicalReport } from '../../src/domain/technical';
import { recommendVersions } from '../../src/domain/recommendations';
import type { ReleaseVariant } from '../../src/domain/models';

const report = (codec = 'HEVC', rate = '5 000 kb/s', depth = 10) => `General
File size : 8.5 GiB
Duration : 1 h 40 min
Overall bit rate : 12 Mb/s

Video
Format : ${codec}
Duration : 1 h 40 min
Bit rate : ${rate}
Width : 1 920 pixels
Height : 1 080 pixels
Bit depth : ${depth} bits
Stream size : 3.49 GiB (80%)

Audio #1
Bit rate : 640 kb/s`;

const variant = (
  key: string, resolution: number, codec: string, videoBitrate: number | null,
  category: 'source' | 'untouched' | 'encode' | 'unknown' = 'unknown',
): ReleaseVariant => ({
  key, packageName: key, password: '', links: [], linksLoaded: false,
  technical: {
    resolution, codec, bitDepth: codec === 'HEVC' ? 10 : 8, videoBitrate,
    overallBitrate: null, totalBytes: 10e9, videoBytes: null, duration: 6000,
    width: resolution === 2160 ? 3840 : 1920, height: resolution,
    fps: 24, hdr: '', category, sourceFamily: '', provider: '', bitrateEstimated: false,
  },
});

describe('parseTechnicalReport', () => {
  it('keeps video bitrate, stream size, total size and duration distinct', () => {
    expect(parseTechnicalReport(report(), 'Film 1080p WEB-DL')).toMatchObject({
      codec: 'HEVC', bitDepth: 10, resolution: 1080, videoBitrate: 5_000_000,
      overallBitrate: 12_000_000, duration: 6000,
      videoBytes: 3.49 * 1024 ** 3, totalBytes: 8.5 * 1024 ** 3,
      category: 'source',
    });
  });

  it('parses Italian grouped bitrates and compact hour notation', () => {
    const parsed = parseTechnicalReport(
      'Generale\nDimensione file : 10 GB\nDurata : 1o 36min\nBitrate totale : 9.017 kb/s\n\nVideo\nFormato : AVC\nBitrate : 7.500 kb/s\nLarghezza : 1.920 pixel\nAltezza : 1.080 pixel',
      '1080p WEB-DL',
    );
    expect(parsed).toMatchObject({
      codec: 'H264', duration: 5760, overallBitrate: 9_017_000,
      videoBitrate: 7_500_000, width: 1920, height: 1080,
    });
  });
});

describe('recommendVersions', () => {
  it('preselects 4K and 1080p while flagging cross-codec comparisons as uncertain', () => {
    const result = recommendVersions([
      variant('4k', 2160, 'HEVC', 20_000_000),
      variant('avc', 1080, 'H264', 9_000_000),
      variant('hevc', 1080, 'HEVC', 5_000_000),
    ], '4k1080', 0);
    expect(result.keys).toEqual(['4k', 'avc']);
    expect(result.notes.join(' ')).toMatch(/incert|indicativ/i);
  });

  it('prefers source preservation over an encode without a codec multiplier', () => {
    expect(recommendVersions([
      variant('source', 1080, 'H264', 10_000_000, 'source'),
      variant('encode', 1080, 'HEVC', 12_000_000, 'encode'),
    ], '4k1080', 0).keys).toEqual(['source']);
  });

  it('uses zero or blank as no bitrate ceiling and applies a positive total-bitrate ceiling', () => {
    const source = variant('source', 1080, 'H264', 20_000_000, 'untouched');
    source.technical.overallBitrate = 40_000_000;
    const encode = variant('encode', 1080, 'HEVC', 7_000_000, 'encode');
    encode.technical.overallBitrate = 10_000_000;
    expect(recommendVersions([source, encode], '4k1080', 0).keys).toEqual(['source']);
    expect(recommendVersions([source, encode], '4k1080', 35).keys).toEqual(['encode']);
  });

  it('compares each season independently and manual mode never preselects', () => {
    const seasonal = [1, 2].flatMap((season) => [
      { ...variant(`s${season}-avc`, 1080, 'H264', 9_000_000, 'encode'), season },
      { ...variant(`s${season}-hevc`, 1080, 'HEVC', 5_000_000, 'encode'), season },
    ]);
    expect(recommendVersions(seasonal, '4k1080', 0).keys).toEqual(['s1-avc', 's2-avc']);
    expect(recommendVersions(seasonal, 'manual', 0).keys).toEqual([]);
  });
});

