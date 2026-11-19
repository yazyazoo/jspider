// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { TmdbCandidate } from '../../src/domain/tmdb';
import type { MediaRatings } from '../../src/domain/media-ratings';
import { renderCandidateCards } from '../../src/sidebar/candidates';

const candidate: TmdbCandidate = {
  id: 42,
  mediaKind: 'movie',
  title: 'A Story of Derry',
  year: '2026',
  overview: 'Trama',
  poster: 'https://image.tmdb.org/t/p/w185/poster.jpg',
  voteAverage: 8.023,
  voteCount: 12928,
  url: 'https://www.themoviedb.org/movie/42',
  imdbUrl: 'https://www.imdb.com/title/tt1234567/',
};

describe('candidate cards', () => {
  it('keeps only the two workflow actions and removes duplicate external buttons', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [candidate], 42, { validate() {}, fallback() {} });
    const card = container.querySelector('.candidate');
    const actions = [...container.querySelectorAll('.candidate-actions > *')];
    expect(card?.classList.contains('validated')).toBe(true);
    expect(actions.map((item) => item.textContent)).toEqual([
      'Valida questo titolo',
      'Usa esplicitamente titolo e anno senza TMDB ID',
    ]);
    expect(container.querySelector('.candidate-actions a')).toBeNull();
  });

  it('renders only available ratings and awards as safe new-tab links', () => {
    const container = document.createElement('div');
    const enrichment: MediaRatings = {
      ratings: [
        { source: 'imdb', label: 'IMDb', value: '8.2', votes: 1112537, url: 'https://www.imdb.com/title/tt15398776/' },
        { source: 'tomatoes', label: 'Rotten Tomatoes critica', value: '93%', votes: 510, url: 'https://www.rottentomatoes.com/m/oppenheimer_2023' },
        { source: 'popcorn', label: 'Rotten Tomatoes pubblico', value: '91%', votes: 10000, url: 'https://www.rottentomatoes.com/m/oppenheimer_2023' },
      ],
      awards: { text: 'Won 7 Oscars', url: 'https://www.imdb.com/title/tt15398776/awards/' },
      imdbId: 'tt15398776',
    };

    renderCandidateCards(
      container, [candidate], null, { validate() {}, fallback() {} }, new Map([[42, enrichment]]),
    );

    const links = [...container.querySelectorAll<HTMLAnchorElement>('.candidate-ratings a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      '8.0', '8.2', '93%', '91%', '🏆Won 7 Oscars',
    ]);
    expect(links.slice(0, 4).map((link) => link.querySelector('img')?.getAttribute('src'))).toEqual([
      'assets/ratings/tmdb.png',
      'assets/ratings/imdb.png',
      'assets/ratings/rotten-tomatoes.png',
      'assets/ratings/rotten-audience.png',
    ]);
    expect(links.slice(0, 4).every((link) => link.querySelector('img')?.alt)).toBe(true);
    expect(links[0]?.href).toBe(candidate.url);
    expect(links.every((link) => link.target === '_blank')).toBe(true);
    expect(links.every((link) => link.rel === 'noopener noreferrer')).toBe(true);
    expect(links[0]?.title).toContain('12.928 voti');
    expect(container.querySelector('.candidate-overview')?.nextElementSibling)
      .toBe(container.querySelector('.candidate-ratings'));
    expect(container.querySelector('.candidate-ratings')?.nextElementSibling)
      .toBe(container.querySelector('.candidate-actions'));
  });

  it('keeps provider links visible and hides only their missing values', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [{ ...candidate, voteAverage: null, voteCount: 0 }], null, {
      validate() {}, fallback() {},
    }, new Map([[42, {
      ratings: [
        { source: 'imdb', label: 'IMDb', value: null, votes: null, url: 'https://www.imdb.com/find/?q=A+Story+of+Derry+2026&s=tt' },
        { source: 'justwatch', label: 'JustWatch', value: null, votes: null, url: 'https://www.justwatch.com/it/cerca?q=A+Story+of+Derry+2026' },
      ],
      awards: null,
      imdbId: null,
    }]]));

    const links = [...container.querySelectorAll<HTMLAnchorElement>('.candidate-ratings a')];
    expect(links.map((link) => link.title)).toEqual([
      'Apri su TMDB',
      'Apri IMDb',
      'Apri JustWatch',
    ]);
    expect(links.map((link) => link.querySelector('.rating-value')?.textContent ?? null))
      .toEqual([null, null, null]);
    expect(links.map((link) => link.querySelector('img')?.getAttribute('src'))).toEqual([
      'assets/ratings/tmdb.png',
      'assets/ratings/imdb.png',
      'assets/ratings/justwatch.svg',
    ]);
  });

  it('uses distinct rotten source and audience logos below sixty percent', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [candidate], null, { validate() {}, fallback() {} }, new Map([[42, {
      ratings: [
        { source: 'tomatoes', label: 'Rotten Tomatoes critica', value: '42%', votes: null, url: 'https://www.rottentomatoes.com/m/example' },
        { source: 'popcorn', label: 'Rotten Tomatoes pubblico', value: '55%', votes: null, url: 'https://www.rottentomatoes.com/m/example' },
      ],
      awards: null,
      imdbId: null,
    }]]));

    expect([...container.querySelectorAll<HTMLImageElement>('.rating-logo')].slice(-2)
      .map((image) => image.getAttribute('src'))).toEqual([
      'assets/ratings/rotten-tomatoes-rotten.png',
      'assets/ratings/rotten-audience-rotten.png',
    ]);
  });

  it('expands a long three-line overview and lets the operator collapse it again', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [{
      ...candidate,
      overview: 'Una trama molto lunga. '.repeat(20),
    }], null, { validate() {}, fallback() {} });

    const overview = container.querySelector<HTMLElement>('.candidate-overview')!;
    const toggle = container.querySelector<HTMLButtonElement>('.overview-toggle')!;
    expect(toggle.hidden).toBe(false);
    expect(toggle.textContent).toBe('Leggi tutto');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(overview.id);

    toggle.click();
    expect(overview.classList.contains('expanded')).toBe(true);
    expect(toggle.textContent).toBe('Mostra meno');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    expect(overview.classList.contains('expanded')).toBe(false);
    expect(toggle.textContent).toBe('Leggi tutto');
  });

  it('does not add a read-more control to a short overview', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [candidate], null, { validate() {}, fallback() {} });

    expect(container.querySelector('.overview-toggle')).toBeNull();
  });

  it('passes the exact candidate to validation and title/year fallback actions', () => {
    const container = document.createElement('div');
    const validated: TmdbCandidate[] = [];
    const fallback: TmdbCandidate[] = [];
    renderCandidateCards(container, [candidate], null, {
      validate(item) { validated.push(item); },
      fallback(item) { fallback.push(item); },
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.candidate-actions button');
    buttons[0]?.click();
    buttons[1]?.click();
    expect(validated).toEqual([candidate]);
    expect(fallback).toEqual([candidate]);
  });

  it('breaks the fallback label immediately after titolo', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [candidate], null, { validate() {}, fallback() {} });

    const button = container.querySelector<HTMLButtonElement>('.candidate-fallback')!;
    const breakNode = button.querySelector('br');
    expect(breakNode?.previousSibling?.textContent).toBe('Usa esplicitamente titolo');
    expect(breakNode?.nextSibling?.textContent).toBe(' e anno senza TMDB ID');
  });
});
