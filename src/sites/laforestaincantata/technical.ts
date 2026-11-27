import type { TechnicalInfo } from '../../domain/models';
import { parseQuantity, parseTechnicalReport, resolutionFromDimensions } from '../../domain/technical';

export function domText(node: Node | null): string {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  const element = node as Element;
  if (/^(?:SCRIPT|STYLE|NOSCRIPT)$/.test(element.nodeName)) return '';
  if (element.nodeName === 'BR') return '\n';
  const value = [...node.childNodes].map(domText).join('');
  return /^(?:DIV|P|PRE|LI|TR|SECTION|ARTICLE|H[1-6])$/.test(element.nodeName)
    ? `\n${value}\n` : value;
}

function bytes(value: unknown): number | null {
  const match = String(value ?? '').match(/([\d][\d\s.,]*)\s*bytes\b/i);
  return match?.[1] ? Number(match[1].replace(/\D/g, '')) || null : null;
}

function seconds(value: unknown): number | null {
  const text = String(value ?? '');
  const explicit = text.match(/\(([\d.,]+)\s*s\)/i);
  const clock = text.match(/\b(\d{1,3}):(\d{2}):(\d{2}(?:[.,]\d+)?)\b/);
  if (explicit?.[1]) return Number(explicit[1].replace(',', '.')) || null;
  return clock?.[1] && clock[2] && clock[3]
    ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3].replace(',', '.'))
    : null;
}

export function parseLfiTechnical(report: string, label: string): TechnicalInfo {
  const hint = /\bVU\b/i.test(label) ? `${label} untouched` : label;
  const base = parseTechnicalReport(report, hint);
  if (!/\[\s*(?:Info sul file|About file|Traccia video|Video track)\s*\]/i.test(report)) {
    return base;
  }
  const sections: Record<'general' | 'video' | 'relevant', Record<string, string>> = {
    general: {}, video: {}, relevant: {},
  };
  let current: keyof typeof sections | 'other' = 'general';
  for (const line of report.split(/\r?\n/)) {
    const header = line.match(/^\s*\[\s*(.*?)\s*\]\s*$/);
    if (header?.[1]) {
      current = /^(?:Info sul file|About file|Info generiche|Generic infos)$/i.test(header[1]) ? 'general'
        : /^(?:Traccia video|Video track)$/i.test(header[1]) ? 'video'
          : /^(?:Dati rilevanti|Relevant data)$/i.test(header[1]) ? 'relevant' : 'other';
      continue;
    }
    const pair = line.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
    if (pair?.[1] && pair[2] && current !== 'other') sections[current][pair[1].trim().toLowerCase()] = pair[2].trim();
  }
  const general = sections.general;
  const video = sections.video;
  const relevant = sections.relevant;
  const duration = seconds(general.durata ?? general.duration)
    ?? seconds(video.durata ?? video['duration (bs)']);
  const videoBytes = bytes(video['dimensione stream'] ?? video['stream size']);
  const totalBytes = bytes(general.dimensione ?? general.size);
  const explicitVideoBitrate = parseQuantity(video['bitrate (bs)'] ?? video.bitrate, 'bitrate');
  const resolutionText = String(video.risoluzione ?? video.resolution ?? relevant.risoluzione ?? relevant.resolution ?? '');
  const resolutionMatch = resolutionText.match(/(\d+)\s*x\s*(\d+)/i);
  const width = resolutionMatch?.[1] ? Number(resolutionMatch[1]) : null;
  const height = resolutionMatch?.[2] ? Number(resolutionMatch[2]) : null;
  const codec = parseTechnicalReport('', String(video['codec id'] ?? '')).codec || base.codec;
  const fpsMatch = String(video.framerate ?? '').match(/\d+(?:[.,]\d+)?/);
  return {
    ...base, codec, width, height, resolution: resolutionFromDimensions(width, height) ?? base.resolution,
    duration, totalBytes, videoBytes,
    videoBitrate: explicitVideoBitrate
      ?? (videoBytes !== null && duration !== null ? videoBytes * 8 / duration : null),
    bitrateEstimated: explicitVideoBitrate === null && videoBytes !== null && duration !== null,
    overallBitrate: totalBytes !== null && duration !== null ? totalBytes * 8 / duration : null,
    fps: fpsMatch?.[0] ? Number(fpsMatch[0].replace(',', '.')) : null,
  };
}

