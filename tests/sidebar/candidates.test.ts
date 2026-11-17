// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { TmdbCandidate } from '../../src/domain/tmdb';
import { renderCandidateCards } from '../../src/sidebar/candidates';

const candidate: TmdbCandidate = {
  id: 42,
  mediaKind: 'movie',
  title: 'A Story of Derry',
  year: '2026',
  overview: 'Trama',
  poster: 'https://image.tmdb.org/t/p/w185/poster.jpg',
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
