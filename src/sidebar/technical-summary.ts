import type { TechnicalInfo } from '../domain/models';

function formatMetric(value: number | null, divisor: number, suffix: string): string {
  return value === null
    ? '—'
    : `${(value / divisor).toLocaleString('it-IT', { maximumFractionDigits: 2 })} ${suffix}`;
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  const gibibyte = 1024 ** 3;
  const mebibyte = 1024 ** 2;
  const [divisor, unit] = value >= gibibyte
    ? [gibibyte, 'GiB'] as const
    : [mebibyte, 'MiB'] as const;
  return `${(value / divisor).toLocaleString('it-IT', { maximumFractionDigits: 2 })} ${unit}`;
}

export function formatTechnicalSummary(technical: TechnicalInfo): string {
  return [
    technical.resolution ? `${technical.resolution}p` : 'Risoluzione —',
    technical.codec || 'Codec —',
    technical.hdr || '',
    `Video ${formatMetric(technical.videoBitrate, 1e6, 'Mb/s')}`,
    `Totale ${formatMetric(technical.overallBitrate, 1e6, 'Mb/s')}`,
    `File ${formatBytes(technical.totalBytes)}`,
    `Traccia video ${formatBytes(technical.videoBytes)}`,
  ].filter(Boolean).join(' · ');
}
