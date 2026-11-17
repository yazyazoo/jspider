import { describe, expect, it } from 'vitest';
import {
  analyzeSubmissionResults,
  buildSubmissionBatch,
  composeQuickWorkflowPayload,
  normalizeWorkflowName,
  requireWorkflowName,
} from '../../src/domain/taskflow-contract';

const variants = [
  {
    key: '4k', packageName: 'Film — 4K', password: 'secret',
    links: ['https://terabytez.org/a/film.part01.rar', 'https://filestore.me/2e34fudfmqcr'],
  },
  {
    key: '1080', packageName: 'Film — 1080p', password: 'secret',
    links: ['https://terabytez.org/b/film.part01.rar'],
  },
];

describe('normalizeWorkflowName', () => {
  it('matches the canonical TaskFlow filesystem-name contract', () => {
    expect(normalizeWorkflowName('È un Film: 2026 / 4K')).toBe('E_un_Film_2026_4K');
    expect(normalizeWorkflowName('___')).toBe('');
  });

  it('rejects an empty normalized name before any package submission', () => {
    expect(() => requireWorkflowName('___')).toThrow('nome workflow');
    expect(requireWorkflowName('È un Film 2026')).toBe('E_un_Film_2026');
  });
});

describe('buildSubmissionBatch', () => {
  it('builds an ordered autodownload request with only documented package fields', () => {
    expect(buildSubmissionBatch(variants, ['terabytez.org'])).toEqual({
      autodownload: true,
      packages: [
        { name: 'Film — 4K', links: ['https://terabytez.org/a/film.part01.rar'] },
        { name: 'Film — 1080p', links: ['https://terabytez.org/b/film.part01.rar'] },
      ],
    });
  });

  it('uses the explicit autodownload flag selected in JSpider', () => {
    expect(buildSubmissionBatch(variants, ['terabytez.org'], false).autodownload).toBe(false);
  });
});

describe('analyzeSubmissionResults', () => {
  it('associates mixed results by position before collecting failures', () => {
    const request = buildSubmissionBatch(variants, ['terabytez.org']);
    const analysis = analyzeSubmissionResults(request.packages, [
      { name: 'JD 4K', jd_id: 'opaque-jd-a', taskflow_id: '1234567' },
      { name: 'Film — 1080p', error: 'No downloadable links found' },
    ]);

    expect(analysis.outcomes[0]).toMatchObject({ inputName: 'Film — 4K', taskflowId: '1234567' });
    expect(analysis.outcomes[1]).toMatchObject({
      inputName: 'Film — 1080p', error: 'No downloadable links found',
    });
    expect(analysis.taskflowIds).toEqual(['1234567']);
    expect(analysis.failures).toHaveLength(1);
  });

  it('rejects a response whose length does not match the ordered request', () => {
    const request = buildSubmissionBatch(variants, ['terabytez.org']);
    expect(() => analyzeSubmissionResults(request.packages, [
      { name: 'only one', jd_id: '1', taskflow_id: '1234567' },
    ])).toThrow('non corrisponde');
  });

  it('deduplicates opaque TaskFlow package identifiers without converting them to numbers', () => {
    const request = buildSubmissionBatch(variants, ['terabytez.org']);
    const analysis = analyzeSubmissionResults(request.packages, [
      { name: 'A', jd_id: '9007199254740993', taskflow_id: '1234567' },
      { name: 'B', jd_id: '9007199254740994', taskflow_id: '1234567' },
    ]);
    expect(analysis.taskflowIds).toEqual(['1234567']);
  });

  it('accepts a null taskflow_id only for a submission-only LinkGrabber result', () => {
    const request = buildSubmissionBatch(variants.slice(0, 1), ['terabytez.org'], false);
    expect(analyzeSubmissionResults(request.packages, [
      { name: 'Film — 4K', jd_id: 'opaque-jd-a', taskflow_id: null },
    ], false)).toMatchObject({ taskflowIds: [], failures: [] });
  });

  it('rejects a malformed taskflow_id even in submission-only mode', () => {
    const request = buildSubmissionBatch(variants.slice(0, 1), ['terabytez.org'], false);
    expect(analyzeSubmissionResults(request.packages, [
      { name: 'Film — 4K', jd_id: 'opaque-jd-a', taskflow_id: { invalid: true } },
    ], false).failures).toHaveLength(1);
  });
});

describe('composeQuickWorkflowPayload', () => {
  it('creates a preset-only workflow with validated TMDB metadata', () => {
    expect(composeQuickWorkflowPayload({
      workflowName: 'Film 2026',
      packageIds: ['1234567', '1234567', '1234568'],
      preset: 'movie-standard',
      metadata: { mode: 'validated', id: 1384216, mediaKind: 'movie' },
      password: 'secret',
      cleanupOnSuccess: true,
    })).toEqual({
      workflow_name: 'Film_2026',
      packages: ['1234567', '1234568'],
      preset: 'movie-standard',
      media_kind: 'movie',
      cleanup_on_success: true,
      tmdb: { tmdb_id: 1384216 },
      unrar: { password: 'secret' },
    });
  });

  it('keeps TaskFlow package identifiers opaque instead of requiring seven digits', () => {
    expect(composeQuickWorkflowPayload({
      workflowName: 'Opaque IDs',
      packageIds: ['pkg_01JDX9AZ-remote', 'pkg_01JDX9AZ-remote'],
      preset: 'movie-standard',
      metadata: { mode: 'validated', id: 42, mediaKind: 'movie' },
      password: '',
      cleanupOnSuccess: false,
    })).toMatchObject({
      packages: ['pkg_01JDX9AZ-remote'], cleanup_on_success: false,
    });
  });

  it('uses the documented title/year fallback only after an explicit fallback choice', () => {
    expect(composeQuickWorkflowPayload({
      workflowName: 'Fallback', packageIds: ['1234567'], preset: 'movie-standard',
      metadata: { mode: 'fallback', mediaKind: 'movie', title: 'Titolo', year: '2026' },
      password: '',
      cleanupOnSuccess: false,
    })).toMatchObject({
      preset: 'movie-standard', media_kind: 'movie', cleanup_on_success: false,
      tmdb: { title: 'Titolo', year: 2026 },
    });
  });

  it('rejects a missing preset instead of composing an incomplete Quick Workflow', () => {
    expect(() => composeQuickWorkflowPayload({
      workflowName: 'Missing preset', packageIds: ['1234567'],
      metadata: { mode: 'validated', id: 1, mediaKind: 'movie' },
      password: '', cleanupOnSuccess: true,
    } as never)).toThrow('preset TaskFlow');
  });

  it('still rejects a malformed explicitly selected preset', () => {
    expect(() => composeQuickWorkflowPayload({
      workflowName: 'Unsafe', packageIds: ['1234567'], preset: 'NOT VALID',
      metadata: { mode: 'validated', id: 1, mediaKind: 'movie' }, password: '',
      cleanupOnSuccess: true,
    })).toThrow('preset');
  });
});

