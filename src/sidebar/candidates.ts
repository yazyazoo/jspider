import type { TmdbCandidate } from '../domain/tmdb';
import type { MediaRating, MediaRatings } from '../domain/media-ratings';

export interface CandidateHandlers {
  validate(candidate: TmdbCandidate): void;
  fallback(candidate: TmdbCandidate): void;
}

function externalButton(document: Document, href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'button-link secondary';
  link.textContent = label;
  return link;
}

const ratingIcons: Record<MediaRating['source'], string> = {
  imdb: 'IMDb',
  tomatoes: '🍅',
  popcorn: '🍿',
  metacritic: 'M',
  metacriticuser: 'MU',
  letterboxd: 'LB',
  trakt: 'Trakt',
  rogerebert: 'Ebert',
  myanimelist: 'MAL',
};

function ratingLink(
  document: Document,
  source: string,
  iconText: string,
  value: string,
  href: string,
  title: string,
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = `rating-badge rating-${source}`;
  link.title = title;
  link.setAttribute('aria-label', title);
  const icon = document.createElement('span');
  icon.className = 'rating-icon';
  icon.textContent = iconText;
  icon.setAttribute('aria-hidden', 'true');
  const score = document.createElement('span');
  score.className = 'rating-value';
  score.textContent = value;
  link.append(icon, score);
  return link;
}

function renderRatings(
  document: Document,
  candidate: TmdbCandidate,
  enrichment: MediaRatings | undefined,
): HTMLElement | null {
  const container = document.createElement('div');
  container.className = 'candidate-ratings';
  if (candidate.voteAverage !== null && candidate.voteCount > 0) {
    const value = candidate.voteAverage.toFixed(1);
    const votes = new Intl.NumberFormat('it-IT').format(candidate.voteCount);
    container.append(ratingLink(
      document, 'tmdb', 'TMDB', value, candidate.url, `TMDB: ${value} · ${votes} voti`,
    ));
  }
  for (const rating of enrichment?.ratings ?? []) {
    const votes = rating.votes === null ? '' : ` · ${new Intl.NumberFormat('it-IT').format(rating.votes)} voti`;
    container.append(ratingLink(
      document,
      rating.source,
      ratingIcons[rating.source],
      rating.value,
      rating.url,
      `${rating.label}: ${rating.value}${votes}`,
    ));
  }
  if (enrichment?.awards) {
    const awards = ratingLink(
      document, 'awards', '🏆', enrichment.awards.text, enrichment.awards.url, enrichment.awards.text,
    );
    awards.classList.add('rating-awards');
    container.append(awards);
  }
  return container.childElementCount ? container : null;
}

export function renderCandidateCards(
  container: HTMLElement,
  candidates: readonly TmdbCandidate[],
  validatedId: number | null,
  handlers: CandidateHandlers,
  ratingsById: ReadonlyMap<number, MediaRatings> = new Map(),
): void {
  const document = container.ownerDocument;
  container.replaceChildren();
  for (const candidate of candidates) {
    const card = document.createElement('article');
    card.className = `candidate${validatedId === candidate.id ? ' validated' : ''}`;
    const poster = candidate.poster
      ? document.createElement('img')
      : document.createElement('div');
    poster.className = 'poster';
    if (poster instanceof HTMLImageElement) {
      poster.src = candidate.poster;
      poster.alt = '';
    } else {
      poster.textContent = 'Nessuna locandina';
    }
    const body = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${candidate.title}${candidate.year ? ` (${candidate.year})` : ''}`;
    const overview = document.createElement('p');
    overview.textContent = candidate.overview || 'Trama non disponibile.';
    const actions = document.createElement('div');
    actions.className = 'candidate-actions';
    const validate = document.createElement('button');
    validate.type = 'button';
    validate.textContent = 'Valida questo titolo';
    validate.addEventListener('click', () => handlers.validate(candidate));
    const fallback = document.createElement('button');
    fallback.type = 'button';
    fallback.className = 'secondary candidate-fallback';
    fallback.append(
      'Usa esplicitamente titolo',
      document.createElement('br'),
      ' e anno senza TMDB ID',
    );
    fallback.disabled = !/^\d{4}$/.test(candidate.year);
    fallback.addEventListener('click', () => handlers.fallback(candidate));
    actions.append(
      validate,
      externalButton(document, candidate.url, 'Apri su TMDB'),
      externalButton(document, candidate.imdbUrl, 'Apri su IMDb'),
      fallback,
    );
    body.append(title, overview, actions);
    const ratings = renderRatings(document, candidate, ratingsById.get(candidate.id));
    if (ratings) body.append(ratings);
    card.append(poster, body);
    container.append(card);
  }
}
