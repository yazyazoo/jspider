import type { SourceCategory, TechnicalInfo } from './models';

export function parseQuantity(text: unknown, type: 'bytes' | 'bitrate'): number | null {
  const match = String(text ?? '').match(
    /([\d][\d\s.,]*)\s*(kb\/s|Mb\/s|Gb\/s|b\/s|kbps|Mbps|Gbps|bps|GiB|MiB|GB|MB)\b/i,
  );
  if (!match?.[1] || !match[2]) return null;
  const unit = match[2].toLowerCase().replace(/^(k|m|g)?bps$/, (_all, prefix: string) => `${prefix || ''}b/s`);
  let digits = match[1].replace(/\s/g, '');
  if (digits.includes(',')) digits = digits.replace(/\./g, '').replace(',', '.');
  else if (type === 'bitrate' && ['kb/s', 'b/s'].includes(unit)
    && /^\d{1,3}(?:\.\d{3})+$/.test(digits)) digits = digits.replace(/\./g, '');
  const value = Number(digits);
  const units = type === 'bytes'
    ? { gib: 1024 ** 3, mib: 1024 ** 2, gb: 1e9, mb: 1e6 }
    : { 'b/s': 1, 'kb/s': 1e3, 'mb/s': 1e6, 'gb/s': 1e9 };
  const multiplier = units[unit as keyof typeof units];
  return value > 0 && multiplier ? value * multiplier : null;
}

function parseDuration(text: unknown): number | null {
  let total = 0;
  const pattern = /(\d+(?:[.,]\d+)?)\s*(hours?|ore|ora|h|o|minut[oi]|minutes?|min|m|second[oi]|seconds?|sec|s)(?=\s|\d|$)/gi;
  for (const match of String(text ?? '').matchAll(pattern)) {
    const amount = Number(match[1]?.replace(',', '.'));
    const unit = match[2]?.toLowerCase() ?? '';
    total += amount * (/^(?:h|o)/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1);
  }
  return total || null;
}

function classifySource(label: string): SourceCategory {
  if (/\b(?:untouched|remux|bdremux)\b/i.test(label)) return 'untouched';
  if (/\bweb[ .-]?dl\b/i.test(label)) return 'source';
  if (/\b(?:re-?encode|encode|codifica|web-?rip|bd-?rip|br-?rip|x264|x265)\b/i.test(label)) return 'encode';
  return 'unknown';
}

export function parseTechnicalReport(report: unknown, label = '', summary = ''): TechnicalInfo {
  const sections: Record<'general' | 'video', Record<string, string>> = { general: {}, video: {} };
  let section: 'general' | 'video' | 'other' = 'general';
  const aliases: Record<string, string> = {
    formato: 'format', 'dimensione file': 'file size', durata: 'duration',
    'bitrate totale': 'overall bit rate', bitrate: 'bit rate',
    'bitrate nominale': 'nominal bit rate', larghezza: 'width', altezza: 'height',
    'profondità bit': 'bit depth', 'dimensione traccia': 'stream size',
    'frequenza fotogrammi': 'frame rate', 'formato hdr': 'hdr format',
  };
  for (const line of String(report ?? '').split(/\r?\n/)) {
    const heading = line.trim();
    if (/^Video(?: #\d+)?$/i.test(heading)) { section = 'video'; continue; }
    if (/^(?:General|Generale)$/i.test(heading)) { section = 'general'; continue; }
    if (/^(?:Audio|Text|Testo|Menu|Image|Immagine|Other|Altro)(?: #\d+)?$/i.test(heading)) {
      section = 'other'; continue;
    }
    const pair = line.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
    if (pair?.[1] && pair[2] && section !== 'other') {
      const key = pair[1].trim().toLowerCase();
      sections[section][aliases[key] ?? key] = pair[2].trim();
    }
  }

  const general = sections.general;
  const video = sections.video;
  const hint = `${video.format ?? ''} ${label} ${summary}`;
  const codec = /\b(?:HEVC|H[. ]?265|x265)\b/i.test(hint) ? 'HEVC'
    : /\b(?:AVC|H[. ]?264|x264)\b/i.test(hint) ? 'H264'
      : /\bAV1\b/i.test(hint) ? 'AV1' : '';
  const depth = String(video['bit depth'] ?? summary).match(/\b(8|10|12)\s*bits?\b/i);
  const width = Number((video.width ?? '').replace(/\D/g, '')) || null;
  const height = Number((video.height ?? '').replace(/\D/g, '')) || null;
  const namedResolution = Number(label.match(/\b(2160|1080|720|576|480)p\b/i)?.[1]);
  const resolution = namedResolution || (/\b4K\b/i.test(label) ? 2160
    : width !== null && width >= 3800 ? 2160
      : width !== null && width >= 1900 ? 1080
        : width !== null && width >= 1200 ? 720 : null);
  const videoBytes = parseQuantity(video['stream size'], 'bytes');
  const duration = parseDuration(video.duration ?? general.duration);
  const explicitVideoBitrate = parseQuantity(video['bit rate'] ?? video['nominal bit rate'], 'bitrate')
    ?? parseQuantity(summary, 'bitrate');
  const videoBitrate = explicitVideoBitrate
    ?? (videoBytes !== null && duration !== null ? videoBytes * 8 / duration : null);
  const totalBytes = parseQuantity(general['file size'], 'bytes');
  const overallBitrate = parseQuantity(general['overall bit rate'], 'bitrate')
    ?? (totalBytes !== null && duration !== null ? totalBytes * 8 / duration : null);
  const hdrHint = [video['hdr format'], label, summary].filter(Boolean).join(' ');
  const hdr = [
    /Dolby Vision|\bDV\b/i.test(hdrHint) ? 'DV' : '',
    /HDR10\+|HDR10 Plus/i.test(hdrHint) ? 'HDR10+' : '',
    /\bHDR10\b/i.test(hdrHint) ? 'HDR10' : '',
    /\bHLG\b/i.test(hdrHint) ? 'HLG' : '',
  ].filter(Boolean).join(' / ') || (/\bHDR\b/i.test(hdrHint) ? 'HDR' : /\bSDR\b/i.test(hdrHint) ? 'SDR' : '');
  const sourceFamily = /blu[ .-]?ray|bdremux|bdrip|br-?rip/i.test(label) ? 'bluray'
    : /\bweb[ .-]?(?:dl|rip)\b/i.test(label) ? 'web' : '';
  const provider = /\b(?:AMZN|Amazon)\b/i.test(label) ? 'amazon'
    : /\b(?:Netflix|NF)\b/i.test(label) ? 'netflix'
      : /\b(?:iTunes|iT[ .-]WEB)\b/i.test(label) ? 'itunes'
        : /\b(?:Movies Anywhere|MA[ .-]WEB)\b/i.test(label) ? 'movies-anywhere'
          : /\b(?:DSNP|Disney)\b/i.test(label) ? 'disney'
            : /\b(?:ATVP|Apple TV)\b/i.test(label) ? 'apple' : '';
  const fpsMatch = video['frame rate']?.match(/\d+(?:[.,]\d+)?/);

  return {
    codec, bitDepth: depth?.[1] ? Number(depth[1]) : null, resolution,
    width, height, videoBitrate, overallBitrate, videoBytes, totalBytes, duration,
    fps: fpsMatch?.[0] ? Number(fpsMatch[0].replace(',', '.')) : null,
    hdr, category: classifySource(label), sourceFamily, provider,
    bitrateEstimated: explicitVideoBitrate === null && videoBitrate !== null,
  };
}

