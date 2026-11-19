import type { Recommendation, RecommendationProfile, ReleaseVariant } from './models';

const priority = { untouched: 3, source: 2, encode: 1, unknown: 0 } as const;

function emptyRecommendation(): Recommendation {
  return { keys: [], reasons: {}, notes: [], comparisons: [] };
}

export function recommendVersions(
  variants: readonly ReleaseVariant[],
  profile: RecommendationProfile = '4k1080',
  limitMbps: number | string | null = 0,
): Recommendation {
  const result = emptyRecommendation();
  if (profile === 'manual') return result;

  if (variants.some((variant) => Number.isInteger(variant.season))) {
    const seasons = [...new Set(variants.map((variant) => variant.season ?? null))];
    for (const season of seasons) {
      const group = variants.filter((variant) => (variant.season ?? null) === season)
        .map((variant) => {
          const { season: _season, ...withoutSeason } = variant;
          return withoutSeason;
        });
      const proposal = recommendVersions(group, profile, limitMbps);
      result.keys.push(...proposal.keys);
      Object.assign(result.reasons, proposal.reasons);
      result.comparisons.push(...proposal.comparisons.map((comparison) => ({ ...comparison, season })));
      result.notes.push(...proposal.notes.map((note) => `${season === null ? '' : `Stagione ${season} · `}${note}`));
    }
    return result;
  }

  const unlimited = limitMbps === null || String(limitMbps).trim() === '' || Number(limitMbps) === 0;
  const tier = (variant: ReleaseVariant) => priority[variant.technical.category];
  const videoRate = (variant: ReleaseVariant) => variant.technical.videoBitrate
    ?? (variant.technical.videoBytes !== null && variant.technical.duration !== null
      ? variant.technical.videoBytes * 8 / variant.technical.duration : 0);
  const codecFamily = (codec: string) => {
    if (/^(?:HEVC|H\.?265)$/i.test(codec.trim())) return 'hevc';
    if (/^(?:AVC|H\.?264)$/i.test(codec.trim())) return 'avc';
    return 'other';
  };
  const equivalentVideoRate = (variant: ReleaseVariant) => videoRate(variant)
    * (codecFamily(variant.technical.codec) === 'hevc' ? 2 : 1);
  const totalRate = (variant: ReleaseVariant) => variant.technical.overallBitrate
    ?? (variant.technical.totalBytes !== null && variant.technical.duration !== null
      ? variant.technical.totalBytes * 8 / variant.technical.duration : 0);
  const withinLimit = (variant: ReleaseVariant) => unlimited
    || (totalRate(variant) > 0 && totalRate(variant) <= Number(limitMbps) * 1e6);
  const rateText = (rate: number) => `${(rate / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 2 })} Mb/s`;
  const comparisonText = (variant: ReleaseVariant) => {
    const rate = videoRate(variant);
    const family = codecFamily(variant.technical.codec);
    if (family === 'hevc') return `HEVC ${rateText(rate)} · equiv. AVC ${rateText(equivalentVideoRate(variant))}`;
    if (family === 'avc') return `AVC ${rateText(rate)}`;
    return `${variant.technical.codec || 'Codec —'} ${rateText(rate)}`;
  };

  const choose = (list: ReleaseVariant[], group: string, resolution: number, selected: boolean) => {
    if (!list.length) {
      if (selected) result.notes.push(`${group}: nessuna versione disponibile.`);
      return;
    }
    const eligible = list.filter(withinLimit);
    for (const variant of list) {
      if (!withinLimit(variant)) {
        result.reasons[variant.key] = totalRate(variant) > 0
          ? 'Esclusa: bitrate totale oltre il limite.'
          : 'Esclusa: bitrate totale non disponibile.';
      }
    }
    if (!eligible.length) {
      result.notes.push(`${group}: nessuna candidata con bitrate totale verificabile entro soglia.`);
      return;
    }
    const highestTier = Math.max(...eligible.map(tier));
    const pool = eligible.filter((variant) => tier(variant) === highestTier);
    const ranked = pool.slice().sort((left, right) => equivalentVideoRate(right) - equivalentVideoRate(left)
      || (right.technical.bitDepth ?? 0) - (left.technical.bitDepth ?? 0)
      || videoRate(left) - videoRate(right)
      || left.key.localeCompare(right.key));
    const best = ranked[0];
    if (!best) return;
    const technical = pool.map((variant) => variant.technical);
    const issues: string[] = [];
    if (technical.some((item) => !item.codec || !item.bitDepth || !item.videoBitrate || !item.duration)) {
      issues.push('dati incompleti');
    }
    if (technical.some((item) => item.bitrateEstimated)) issues.push('bitrate stimato');
    if (highestTier === 0) issues.push('sorgente non riconosciuta');
    const differs = (field: keyof ReleaseVariant['technical']) => new Set(
      technical.map((item) => item[field] ?? ''),
    ).size > 1;
    if (differs('codec') && technical.some((item) => codecFamily(item.codec) === 'other')) {
      issues.push('codec non confrontabili');
    }
    if (differs('bitDepth')) issues.push('bit depth diversa');
    if (differs('hdr')) issues.push('HDR/SDR');
    if (differs('sourceFamily') || differs('provider')) issues.push('sorgenti diverse');
    const spread = (field: 'duration' | 'width' | 'height' | 'fps') => {
      const values = technical.map((item) => item[field]).filter((value): value is number => value !== null && value > 0);
      return values.length > 1 && Math.max(...values) / Math.min(...values) > 1.02;
    };
    if (spread('duration')) issues.push('durata diversa');
    if (spread('width') || spread('height') || spread('fps')) issues.push('dimensioni/FPS diversi');
    const uncertain = issues.length > 0;
    const singleText = {
      untouched: 'priorità REMUX',
      source: 'unica versione WEB-DL',
      encode: 'unica versione codificata',
      unknown: 'unica candidata',
    }[best.technical.category];
    const prefix = selected ? 'Proposta' : `Candidata ${group}`;
    const decision = pool.length > 1
      ? videoRate(best) > 0 ? comparisonText(best) : 'bitrate video non disponibile'
      : singleText;
    let reason = `${prefix}: ${decision}.`;
    if (uncertain) reason += ` Indicativa: ${issues.join(' · ')}.`;
    result.reasons[best.key] = reason;
    for (const variant of eligible) {
      if (variant === best) continue;
      result.reasons[variant.key] = tier(variant) < highestTier
        ? highestTier >= priority.source
          ? 'Alternativa: priorità inferiore alla sorgente/REMUX.'
          : 'Alternativa: priorità inferiore.'
        : videoRate(variant) > 0
          ? `Alternativa: ${comparisonText(variant)}.`
          : 'Alternativa: bitrate video non disponibile.';
    }
    result.comparisons.push({ resolution, key: best.key, uncertain, selected, group });
    if (selected) result.keys.push(best.key);
  };

  const profileResolutions = profile === '4k1080' ? [2160, 1080] : [1080];
  const resolutions = [...new Set([
    ...variants.map((variant) => variant.technical.resolution).filter((value): value is number => value !== null && value > 0),
    ...profileResolutions,
  ])].sort((left, right) => right - left);
  for (const resolution of resolutions) {
    const list = variants.filter((variant) => variant.technical.resolution === resolution);
    const group = resolution === 2160 ? '4K' : `${resolution}p`;
    if (profile === '1080dual' && resolution === 1080) {
      choose(list.filter((variant) => ['source', 'untouched'].includes(variant.technical.category)), '1080 sorgente/untouched', resolution, true);
      choose(list.filter((variant) => variant.technical.category === 'encode'), '1080 codifica', resolution, true);
    } else {
      choose(list, group, resolution, profile === '4k1080' && [2160, 1080].includes(resolution));
    }
  }
  return result;
}

