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

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  const minutes = Math.floor(value / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
}

export function formatTechnicalSummary(technical: TechnicalInfo): string {
  const fileDetails = [
    technical.resolution ? `${technical.resolution}p` : 'Risoluzione —',
    technical.codec || 'Codec —',
    technical.hdr || '',
    `Durata ${formatDuration(technical.duration)}`,
    `Totale ${formatMetric(technical.overallBitrate, 1e6, 'Mb/s')}`,
    `File ${formatBytes(technical.totalBytes)}`,
  ].filter(Boolean).join(' · ');
  const videoDetails = [
    `Video ${formatMetric(technical.videoBitrate, 1e6, 'Mb/s')}`,
    `Traccia video ${formatBytes(technical.videoBytes)}`,
  ].filter(Boolean).join(' · ');
  return `${fileDetails}\n${videoDetails}`;
}

export function renderTechnicalSummary(document: Document, technical: TechnicalInfo): HTMLParagraphElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'version-technical muted small';
  const lines = formatTechnicalSummary(technical).split('\n');
  lines.forEach((line, index) => {
    if (index > 0) paragraph.append(document.createTextNode('\n'));
    const strong = document.createElement('strong');
    strong.className = 'version-technical-line';
    strong.textContent = line;
    paragraph.append(strong);
  });
  return paragraph;
}
