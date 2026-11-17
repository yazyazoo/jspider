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
  it('renders four inline actions as controls and a rounded-ready validated card', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [candidate], 42, { validate() {}, fallback() {} });
    const card = container.querySelector('.candidate');
    const actions = [...container.querySelectorAll('.candidate-actions > *')];
    expect(card?.classList.contains('validated')).toBe(true);
    expect(actions.map((item) => item.textContent)).toEqual([
      'Valida questo titolo',
      'Apri su TMDB',
      'Apri su IMDb',
      'Usa esplicitamente titolo e anno senza TMDB ID',
    ]);
    expect((actions[1] as HTMLAnchorElement).href).toBe(candidate.url);
    expect((actions[2] as HTMLAnchorElement).href).toBe(candidate.imdbUrl);
    expect(actions[1]?.classList.contains('button-link')).toBe(true);
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
    };

    renderCandidateCards(
      container, [candidate], null, { validate() {}, fallback() {} }, new Map([[42, enrichment]]),
    );

    const links = [...container.querySelectorAll<HTMLAnchorElement>('.candidate-ratings a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'TMDB8.0', 'IMDb8.2', '🍅93%', '🍿91%', '🏆Won 7 Oscars',
    ]);
    expect(links[0]?.href).toBe(candidate.url);
    expect(links.every((link) => link.target === '_blank')).toBe(true);
    expect(links.every((link) => link.rel === 'noopener noreferrer')).toBe(true);
    expect(links[0]?.title).toContain('12.928 voti');
  });

  it('omits the whole rating row when every value is missing', () => {
    const container = document.createElement('div');
    renderCandidateCards(container, [{ ...candidate, voteAverage: null, voteCount: 0 }], null, {
      validate() {}, fallback() {},
    });

    expect(container.querySelector('.candidate-ratings')).toBeNull();
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
