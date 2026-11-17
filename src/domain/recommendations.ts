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
  const totalRate = (variant: ReleaseVariant) => variant.technical.overallBitrate
    ?? (variant.technical.totalBytes !== null && variant.technical.duration !== null
      ? variant.technical.totalBytes * 8 / variant.technical.duration : 0);
  const withinLimit = (variant: ReleaseVariant) => unlimited
    || (totalRate(variant) > 0 && totalRate(variant) <= Number(limitMbps) * 1e6);
  const rateText = (rate: number) => `${(rate / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 2 })} Mb/s`;

  const choose = (list: ReleaseVariant[], group: string, resolution: number, selected: boolean) => {
    if (!list.length) {
      if (selected) result.notes.push(`${group}: nessuna versione disponibile.`);
      return;
    }
    const eligible = list.filter(withinLimit);
    for (const variant of list) {
      if (!withinLimit(variant)) {
        result.reasons[variant.key] = 'Non proposta: bitrate totale oltre soglia o non disponibile per verificare il limite.';
      }
    }
    if (!eligible.length) {
      result.notes.push(`${group}: nessuna candidata con bitrate totale verificabile entro soglia.`);
      return;
    }
    const highestTier = Math.max(...eligible.map(tier));
    const pool = eligible.filter((variant) => tier(variant) === highestTier);
    const ranked = pool.slice().sort((left, right) => videoRate(right) - videoRate(left)
      || (right.technical.bitDepth ?? 0) - (left.technical.bitDepth ?? 0)
      || left.key.localeCompare(right.key));
    const best = ranked[0];
    if (!best) return;
    const technical = pool.map((variant) => variant.technical);
    const issues: string[] = [];
    if (technical.some((item) => !item.codec || !item.bitDepth || !item.videoBitrate || !item.duration)) {
      issues.push('dati tecnici mancanti o insufficienti');
    }
    if (technical.some((item) => item.bitrateEstimated)) issues.push('bitrate video stimato');
    if (highestTier === 0) issues.push('tipo di sorgente non indicato');
    const differs = (field: keyof ReleaseVariant['technical']) => new Set(
      technical.map((item) => item[field] ?? ''),
    ).size > 1;
    if (differs('codec')) issues.push('codec diversi (H.264/HEVC o altri): bitrate non equivalente e nessun rapporto fisso');
    if (differs('bitDepth')) issues.push('profondità in bit diverse');
    if (differs('hdr')) issues.push('HDR/SDR diversi: verifica la compatibilità');
    if (differs('sourceFamily') || differs('provider')) issues.push('sorgenti o provider diversi');
    const spread = (field: 'duration' | 'width' | 'height' | 'fps') => {
      const values = technical.map((item) => item[field]).filter((value): value is number => value !== null && value > 0);
      return values.length > 1 && Math.max(...values) / Math.min(...values) > 1.02;
    };
    if (spread('duration')) issues.push('durate diverse: verifica il montaggio');
    if (spread('width') || spread('height') || spread('fps')) issues.push('dimensioni o frequenze video diverse');
    const tied = ranked.length > 1 && videoRate(ranked[0]!) === videoRate(ranked[1]!);
    if (tied) issues.push('bitrate equivalenti: profondità in bit e ordine stabile risolvono la parità');
    const uncertain = issues.length > 0;
    const categoryText = {
      untouched: 'Priorità alla traccia untouched/REMUX',
      source: 'Priorità alla sorgente WEB-DL',
      encode: 'Ricodifica proposta',
      unknown: 'Tipologia della sorgente non indicata',
    }[best.technical.category];
    let reason = `${categoryText}. ${unlimited ? 'Nessun limite di bitrate. ' : `Entro la soglia di ${limitMbps} Mb/s totali. `}`;
    if (videoRate(best) > 0) {
      reason += `${pool.length > 1 ? tied ? 'Bitrate video a parità: ' : 'Bitrate video più alto fra candidate di pari priorità: ' : 'Bitrate video: '}${rateText(videoRate(best))}. `;
    } else reason += 'Bitrate video mancante: preferenza provvisoria per profondità in bit nota e ordine stabile. ';
    if (pool.length === 1) reason += 'Unica candidata con questa priorità. ';
    reason += uncertain
      ? `Proposta indicativa, confronto incerto: ${issues.join('; ')}. Puoi cambiarla.`
      : 'Confronto fra candidate compatibili nei dati disponibili; qualità stimata dai metadati.';
    result.reasons[best.key] = `${selected ? `Proposta ${group}: ` : `Candidata ${group} (fuori dal profilo): `}${reason}`;
    for (const variant of eligible) {
      if (variant === best) continue;
      result.reasons[variant.key] = tier(variant) < highestTier
        ? `Alternativa ${group}: priorità alla sorgente/untouched proposta, entro i limiti scelti.`
        : `Alternativa ${group}: ${videoRate(variant) > 0 ? `bitrate video ${rateText(videoRate(variant))}` : 'bitrate video non disponibile'}. ${uncertain ? 'Confronto incerto; puoi selezionarla al posto della proposta.' : 'La proposta usa il bitrate video più alto, a parità di priorità.'}`;
    }
    result.comparisons.push({ resolution, key: best.key, uncertain, selected, group });
    if (selected) result.keys.push(best.key);
    if (uncertain && selected) result.notes.push(`${group}: proposta indicativa, confronto incerto (${issues.join('; ')}).`);
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

