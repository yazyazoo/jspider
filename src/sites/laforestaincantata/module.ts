import { requireSiteDefinition } from '../catalog';
import type { SiteModule } from '../contracts';
import { laForestaAdapter } from './article';

export const laForestaModule: SiteModule = {
  definition: requireSiteDefinition('laforestaincantata'),
  article: laForestaAdapter,
};
