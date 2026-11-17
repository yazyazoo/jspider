import type { TmdbCandidate } from '../domain/tmdb';

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

export function renderCandidateCards(
  container: HTMLElement,
  candidates: readonly TmdbCandidate[],
  validatedId: number | null,
  handlers: CandidateHandlers,
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
    card.append(poster, body);
    container.append(card);
  }
}
